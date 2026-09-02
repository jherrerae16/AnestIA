import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { resolverPromptMaestro } from './anthropic';

/**
 * El prompt maestro se resolvía como `process.cwd()/../../docs/…`, un número fijo de saltos
 * desde donde se hubiera arrancado el proceso. Funcionaba con el worker —que arranca en
 * `apps/api`— y reventaba con ENOENT en cuanto algo llamaba al motor clínico desde la raíz del
 * repositorio: buscaba `docs/` dos niveles por encima del sitio equivocado.
 *
 * Salió corriendo el pipeline completo a mano, no en un test: la generación del documento se
 * cayó entera. Estos tests fijan que la ruta ya no dependa del directorio de arranque.
 */

const RAIZ = resolve(__dirname, '../../..');

describe('prompt maestro del motor clínico', () => {
  it('se encuentra desde la raíz del repositorio', async () => {
    await expect(resolverPromptMaestro(RAIZ)).resolves.toContain('docs/prompt-maestro-v2.md');
  });

  it('se encuentra desde apps/api, que es donde arranca el worker', async () => {
    await expect(resolverPromptMaestro(resolve(RAIZ, 'apps/api'))).resolves.toContain(
      'docs/prompt-maestro-v2.md',
    );
  });

  it('se encuentra desde un directorio hondo del proyecto', async () => {
    await expect(resolverPromptMaestro(resolve(RAIZ, 'apps/api/lib/services'))).resolves.toContain(
      'docs/prompt-maestro-v2.md',
    );
  });

  it('la ruta resuelta es siempre la misma, venga de donde venga', async () => {
    const desdeRaiz = await resolverPromptMaestro(RAIZ);
    const desdeApi = await resolverPromptMaestro(resolve(RAIZ, 'apps/api'));
    expect(desdeApi).toBe(desdeRaiz);
  });

  it('fuera del proyecto falla con un mensaje que dice qué pasa', async () => {
    // Un ENOENT crudo no le dice a nadie que el motor clínico se quedó sin su prompt.
    await expect(resolverPromptMaestro('/tmp')).rejects.toThrow(/prompt maestro/i);
  });
});
