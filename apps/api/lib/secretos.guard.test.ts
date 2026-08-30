import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda de secretos.
 *
 * La auditoría (C-5) marcó la `ANTHROPIC_API_KEY` en claro en `.env`. El hecho comprobado es que
 * `.env` **nunca** entró al repositorio: `.gitignore` lo excluye y no aparece en el historial.
 * Lo que faltaba era que eso siguiera siendo cierto mañana.
 *
 * Estos tests fallan si alguien:
 *  - trackea un `.env` o el directorio `.secrets/`;
 *  - deja una clave con forma de secreto dentro de un archivo versionado;
 *  - afloja `.gitignore`.
 *
 * Un secreto commiteado no se arregla borrándolo después: queda en el historial y hay que rotar
 * la credencial. Por eso la guarda es preventiva y corre en cada `npm test`.
 */

const RAIZ = join(__dirname, '../../..');

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' });
}

/** Archivos versionados hoy. */
function trackeados(): string[] {
  return git('ls-files').split('\n').filter(Boolean);
}

describe('secretos — nada sensible entra al repositorio', () => {
  it('ningún .env está versionado (salvo el ejemplo)', () => {
    const env = trackeados().filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith('.env.example'));
    expect(env).toEqual([]);
  });

  it('el directorio .secrets/ no está versionado', () => {
    expect(trackeados().filter((f) => f.startsWith('.secrets/'))).toEqual([]);
  });

  it('.gitignore sigue cubriendo env y secretos', () => {
    const gi = readFileSync(join(RAIZ, '.gitignore'), 'utf8');
    for (const patron of ['.env', '.secrets/', 'storage/']) {
      expect(gi).toContain(patron);
    }
  });

  it('ningún archivo versionado contiene una clave con forma de secreto', () => {
    // Formas reales, no heurísticas vagas: una key de Anthropic, una clave privada PEM y el
    // bloque de una service account de Google. Buscar "password" a secas daría falsos positivos
    // en cada comentario del repo y la guarda se acabaría desactivando.
    const FORMAS: ReadonlyArray<readonly [string, RegExp]> = [
      ['clave de Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
      ['clave privada PEM', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
      ['service account de Google', /"type"\s*:\s*"service_account"/],
    ];
    const hallazgos: string[] = [];
    for (const f of trackeados()) {
      if (f.endsWith('secretos.guard.test.ts')) continue; // este archivo describe las formas
      let contenido: string;
      try {
        if (statSync(join(RAIZ, f)).size > 2_000_000) continue; // binarios grandes: no son código
        contenido = readFileSync(join(RAIZ, f), 'utf8');
      } catch {
        continue;
      }
      for (const [nombre, re] of FORMAS) {
        // Se reporta el archivo y el tipo de hallazgo, NUNCA el valor encontrado: el mensaje de
        // un test acaba en logs de CI.
        if (re.test(contenido)) hallazgos.push(`${f} → ${nombre}`);
      }
    }
    expect(hallazgos).toEqual([]);
  });
});
