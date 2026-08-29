import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { formatRepeater, getClinicalText, getRepeater } from './answers';

/**
 * Guardas de la migración a claves por código.
 *
 * El compilador no puede ayudar aquí: `formAnswersSchema` es un `z.record` con clave validada
 * por regex, y Zod la ensancha a `Record<string, Answer>`. Es decir, `answers['15']` sigue
 * tipando. Estas dos reglas cubren ese hueco.
 */

const ROOT = join(import.meta.dirname, '../../..');
const DIRS = ['apps/api/lib', 'apps/api/app', 'apps/web/src', 'packages/shared/src', 'prisma'];

/** Archivos permitidos: el módulo de accesores y sus tests. */
const EXENTOS = ['packages/shared/src/answers.ts', 'packages/shared/src/answers.guard.test.ts'];

function sourceFiles(): { path: string; rel: string }[] {
  const out: { path: string; rel: string }[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e === 'node_modules' || e === 'dist' || e === '.next' || e === '.angular') continue;
      const full = join(dir, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (e.endsWith('.ts')) out.push({ path: full, rel: relative(ROOT, full) });
    }
  };
  for (const d of DIRS) walk(join(ROOT, d));
  return out;
}

describe('claves de respuesta', () => {
  const files = sourceFiles();

  it('encuentra los archivos fuente a inspeccionar', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('nadie indexa las respuestas con la numeración posicional anterior', () => {
    // `answers['15']` significaba "la pregunta número 15". Insertar una pregunta reasignaba en
    // silencio el significado de todas las siguientes y rompía la trazabilidad sin que nada
    // fallara. Cualquier reaparición es una regresión.
    const culpables: string[] = [];
    for (const f of files) {
      if (EXENTOS.includes(f.rel)) continue;
      const src = readFileSync(f.path, 'utf8');
      for (const [i, line] of src.split('\n').entries()) {
        if (/answers(\(\))?\[['"`]\d+['"`]\]/.test(line)) {
          culpables.push(`${f.rel}:${i + 1}`);
        }
      }
    }
    expect(culpables, `Indexación posicional de respuestas en:\n${culpables.join('\n')}`).toEqual([]);
  });

  it('el motor clínico ya no cita fuentes con la numeración anterior', () => {
    // Una `fuente: 'formulario:P14'` en un documento firmado apunta a una pregunta que ya no
    // existe: la trazabilidad —el punto de CS2— queda inservible.
    const culpables: string[] = [];
    for (const f of files) {
      if (EXENTOS.includes(f.rel) || f.rel.endsWith('.test.ts')) continue;
      const src = readFileSync(f.path, 'utf8');
      for (const [i, line] of src.split('\n').entries()) {
        // Los comentarios pueden mencionar la numeración vieja para explicar por qué se fue.
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        if (/['"`][^'"`]*formulario:P\d/.test(line)) culpables.push(`${f.rel}:${i + 1}`);
      }
    }
    expect(culpables, `Citas con numeración vieja en:\n${culpables.join('\n')}`).toEqual([]);
  });
});

describe('repetidores', () => {
  const answers = {
    RX02: {
      type: 'REPETIDOR' as const,
      value: [
        JSON.stringify({ nombre: 'Losartán', dosis: '50 mg', frecuencia: 'cada 12 h' }),
        JSON.stringify({ nombre: 'Semaglutida', dosis: '1 mg', frecuencia: 'semanal' }),
      ],
    },
  };

  it('devuelve las filas como objetos', () => {
    const filas = getRepeater(answers, 'RX02');
    expect(filas).toHaveLength(2);
    expect(filas[0]!['nombre']).toBe('Losartán');
    expect(filas[1]!['frecuencia']).toBe('semanal');
  });

  it('los formatea en prosa legible, nunca como JSON', () => {
    const texto = formatRepeater(answers, 'RX02');
    expect(texto).toBe('Losartán 50 mg, cada 12 h · Semaglutida 1 mg, semanal');
    expect(texto).not.toContain('{');
    expect(texto).not.toContain('"');
  });

  it('getClinicalText desenvuelve el repetidor — el documento firmado no puede llevar JSON', () => {
    expect(getClinicalText(answers, 'RX02')).not.toContain('{');
    expect(getClinicalText(answers, 'RX02')).toContain('Losartán');
  });

  it('el nombre del fármaco queda buscable para la detección de GLP-1', () => {
    // Con el JSON crudo, `detectGLP1` buscaba "semaglutida" entre llaves y comillas.
    expect(getClinicalText(answers, 'RX02').toLowerCase()).toContain('semaglutida');
  });

  it('tolera una fila que venga como texto suelto', () => {
    const viejo = { RX02: { type: 'REPETIDOR' as const, value: ['Ibuprofeno 400 mg'] } };
    expect(formatRepeater(viejo, 'RX02')).toBe('Ibuprofeno 400 mg');
  });

  it('descarta filas vacías', () => {
    const conVacia = {
      RX02: { type: 'REPETIDOR' as const, value: [JSON.stringify({ nombre: '' }), JSON.stringify({ nombre: 'Aspirina' })] },
    };
    expect(getRepeater(conVacia, 'RX02')).toHaveLength(1);
  });
});
