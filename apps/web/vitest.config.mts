import { defineConfig } from 'vitest/config';

/**
 * Tests de `apps/web`.
 *
 * Hasta ahora este workspace no tenía ninguno, con el argumento de que la lógica vive en
 * `packages/shared`. Es cierto a medias: `buildScreens`, `pruneHiddenAnswers` y `summaryRows`
 * están allí y cubiertos, pero los bugs que de verdad mordieron al paciente fueron de RENDER —
 * el repetidor que mandaba la dosis a otra fila, `ARCHIVO` cayendo a un input de texto — y ésos
 * no los ve ningún test de `shared`.
 *
 * Se usa el compilador JIT de Angular, no AOT: todas las plantillas de este proyecto son
 * cadenas en línea (`template:` dentro del `@Component`), así que el compilador las resuelve en
 * tiempo de ejecución y no hace falta el plugin de build. Menos toolchain que mantener.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
  esbuild: {
    // Los decoradores de Angular (`@Component`) tienen que sobrevivir a la transpilación.
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
  },
  resolve: {
    alias: { '@anestia/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname },
  },
});
