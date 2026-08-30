import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda de los scripts de test de cada workspace.
 *
 * `apps/web` tuvo durante meses este script:
 *
 *     "test": "echo 'sin tests web todavía — cobertura en apps/api y packages/shared' && exit 0"
 *
 * `npm test` en la raíz pasaba en verde con cero tests de web. Un `exit 0` no se distingue de
 * una suite que pasa: el tablero decía lo mismo en los dos casos. Este test falla si alguno de
 * los tres workspaces vuelve a "pasar" sin ejecutar nada.
 */

const RAIZ = join(__dirname, '../../..');
const WORKSPACES = ['apps/api', 'apps/web', 'packages/shared'];

describe('cada workspace corre tests de verdad', () => {
  for (const ws of WORKSPACES) {
    it(`${ws} ejecuta vitest`, () => {
      const pkg = JSON.parse(readFileSync(join(RAIZ, ws, 'package.json'), 'utf8'));
      const script = String(pkg.scripts?.test ?? '');
      expect(script, `${ws} no tiene script de test`).not.toBe('');
      expect(script, `${ws} "pasa" sin ejecutar nada`).not.toMatch(/exit 0|^echo/);
      expect(script).toContain('vitest');
    });
  }
});
