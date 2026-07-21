import { describe, it, expect } from 'vitest';
import { effectiveFlagForProse } from './clinical.service';

/**
 * Flag efectivo para la prosa de paraclínicos (Tanda C / Opción 1). Definición precisa acordada:
 *  - médico marcó → manda su veredicto.
 *  - no marcó, rango legible → manda el del sistema.
 *  - no marcó, rango ILEGIBLE → se EXCLUYE de la prosa (null): ni normal ni alteración.
 */
describe('effectiveFlagForProse', () => {
  it('médico marcó ALERTA → ALERTA (sobre veredicto del sistema)', () => {
    expect(effectiveFlagForProse({ flag: 'NORMAL', manualFlag: 'ALERTA', rangeUnparsed: false })).toBe('ALERTA');
  });

  it('médico marcó NORMAL sobre un ilegible → NORMAL (verificó)', () => {
    expect(effectiveFlagForProse({ flag: 'NORMAL', manualFlag: 'NORMAL', rangeUnparsed: true })).toBe('NORMAL');
  });

  it('médico NO marcó, rango legible → veredicto del sistema', () => {
    expect(effectiveFlagForProse({ flag: 'ALERTA', manualFlag: null, rangeUnparsed: false })).toBe('ALERTA');
    expect(effectiveFlagForProse({ flag: 'NORMAL', manualFlag: null, rangeUnparsed: false })).toBe('NORMAL');
  });

  it('médico NO marcó, rango ILEGIBLE → null (se excluye de la prosa)', () => {
    expect(effectiveFlagForProse({ flag: 'NORMAL', manualFlag: null, rangeUnparsed: true })).toBeNull();
  });
});
