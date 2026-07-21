import { describe, it, expect } from 'vitest';
import { stripUndeclaredGlp1 } from './anthropic';

/**
 * GLP-1 (#3 de la revisión del médico): el motor real debe omitir la fila `glp1` cuando el
 * paciente no declaró uso, igual que el stub. El schema fijo siempre trae la clave; este helper
 * la quita cuando no aplica.
 */
describe('stripUndeclaredGlp1', () => {
  const base = {
    patologicos: { valor: 'HTA', estado: 'ok', fuente: 'formulario:P13' },
    glp1: { valor: null, estado: 'no_reportado', fuente: null },
  };

  it('no declarado → quita la fila glp1', () => {
    const out = stripUndeclaredGlp1(base, false);
    expect('glp1' in out).toBe(false);
    expect('patologicos' in out).toBe(true); // el resto intacto
  });

  it('declarado → conserva la fila glp1', () => {
    const declaredRow = {
      patologicos: base.patologicos,
      glp1: { valor: 'Uso declarado de semaglutida', estado: 'ok', fuente: 'derivado:IA' },
    };
    const out = stripUndeclaredGlp1(declaredRow, true);
    expect('glp1' in out).toBe(true);
    expect(out.glp1.valor).toContain('semaglutida');
  });

  it('no declarado y sin fila glp1 → no falla', () => {
    const out = stripUndeclaredGlp1({ patologicos: base.patologicos }, false);
    expect('glp1' in out).toBe(false);
  });
});
