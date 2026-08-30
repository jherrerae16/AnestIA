import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda contra clases de plantilla sin estilo.
 *
 * `apps/web` no tiene tests, y el compilador de Angular no comprueba que una clase usada en la
 * plantilla exista en la hoja de estilos. Ese hueco dejó pasar tres defectos seguidos que sólo
 * aparecieron al abrir el navegador: los acordeones se pintaban como cajas de 19 px con el texto
 * desbordado, el input de archivos quedaba invisible porque el CSS lo oculta a la espera de un
 * `<label>`, y la pantalla de agradecimiento salía en línea sin centrar.
 *
 * El test es tosco a propósito (parseo por regex, no un analizador de CSS), pero atrapa
 * exactamente esa clase de error, que es la que se escapa.
 */

const COMPONENTES = ['apps/web/src/app/pages/patient-form.page.ts'];

/** Clases que aporta el estilo global, no el componente. */
const GLOBALES = new Set<string>([]);

function extraer(src: string): { definidas: Set<string>; usadas: Set<string> } {
  const iStyles = src.indexOf('styles: [`');
  const iTplMark = src.indexOf('`],\n  template:');
  const iTpl = src.indexOf('template: `');
  const iFin = src.lastIndexOf('`,\n})');

  const estilos = src.slice(iStyles + 10, iTplMark);
  const plantilla = src.slice(iTpl + 11, iFin);

  const definidas = new Set(Array.from(estilos.matchAll(/\.([a-zA-Z][\w-]*)/g), (m) => m[1]!));

  const usadas = new Set<string>();
  for (const m of plantilla.matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1]!.split(/\s+/)) if (c && !c.includes('{{')) usadas.add(c);
  }
  // `[class]="'sum-tag ' + row.motivo"` → parte literal
  for (const m of plantilla.matchAll(/\[class\]="'([^']+)'/g)) {
    for (const c of m[1]!.split(/\s+/)) if (c) usadas.add(c);
  }
  // `[class.sel]="…"`
  for (const m of plantilla.matchAll(/\[class\.([\w-]+)\]/g)) usadas.add(m[1]!);

  return { definidas, usadas };
}

describe('estilos del componente', () => {
  for (const rel of COMPONENTES) {
    it(`${rel}: toda clase usada tiene una regla CSS`, () => {
      const ruta = join(import.meta.dirname, '../../..', rel);
      const { definidas, usadas } = extraer(readFileSync(ruta, 'utf8'));

      const huerfanas = [...usadas].filter((c) => !definidas.has(c) && !GLOBALES.has(c)).sort();
      expect(
        huerfanas,
        `Clases sin estilo en ${rel}:\n  ${huerfanas.join('\n  ')}\n\n` +
          `Una clase inventada no rompe la compilación: rompe la pantalla, y sólo se ve abriendo ` +
          `el navegador. Usa las clases que ya existen o añade su regla.`,
      ).toEqual([]);
    });

    it(`${rel}: la plantilla no lleva backticks`, () => {
      // El template vive dentro de un template literal de JS: un backtick en un comentario
      // HTML lo cierra a media plantilla y el componente deja de compilar, con errores que
      // apuntan a cualquier otro sitio. Pasó dos veces escribiendo comentarios en Markdown.
      const src = readFileSync(join(import.meta.dirname, '../../..', rel), 'utf8');
      const iTpl = src.indexOf('template: `');
      const iFin = src.lastIndexOf('`,\n})');
      const plantilla = src.slice(iTpl + 11, iFin);
      expect(plantilla.includes('`'), 'Hay un backtick dentro de la plantilla').toBe(false);
    });

    it(`${rel}: los bucles anidados no reutilizan $index sin alias`, () => {
      // En un @for anidado, el bucle interno SOMBREA el $index del externo. Con el repetidor
      // de medicamentos eso hacía que cada campo escribiera en una fila distinta: la dosis
      // acababa en el medicamento siguiente y aparecían filas vacías.
      const src = readFileSync(join(import.meta.dirname, '../../..', rel), 'utf8');
      const iTpl = src.indexOf('template: `');
      const plantilla = src.slice(iTpl + 11, src.lastIndexOf('`,\n})'));
      const externos = [...plantilla.matchAll(/@for\s*\([^)]*track\s+\$index\s*\)/g)];
      for (const m of externos) {
        const resto = plantilla.slice(m.index! + m[0].length, m.index! + m[0].length + 2500);
        const hayAnidado = /@for\s*\(/.test(resto);
        if (hayAnidado) {
          expect(
            m[0].includes('let '),
            `Un @for con bucle anidado usa $index sin alias:\n  ${m[0]}\n` +
              `Declara un alias (let filaIdx = $index) o el bucle interno lo sombrea.`,
          ).toBe(true);
        }
      }
    });

    it(`${rel}: el input de archivo conserva su label`, () => {
      // El CSS oculta `.drop input` (1px, opacity 0) y depende de un `<label for>` visible.
      // Sin él, al paciente se le pide subir un examen y no hay nada que pulsar.
      const src = readFileSync(join(import.meta.dirname, '../../..', rel), 'utf8');
      if (!src.includes('type="file"')) return;
      expect(src).toMatch(/class="drop-label"/);
    });
  }
});
