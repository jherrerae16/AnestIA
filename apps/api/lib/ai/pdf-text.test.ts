import { describe, it, expect } from 'vitest';
import { looksLikeLabText } from './pdf-text';

/**
 * looksLikeLabText decide, por código y sin modelo, si el texto embebido sirve o hay que
 * escalar a visión. Es la puerta de la cascada: un falso positivo mandaría a Haiku un texto
 * basura; un falso negativo pagaría visión de más.
 */
describe('looksLikeLabText — capa 1 vs fallback a visión', () => {
  const labText =
    'HISTORIA: 1042246572 PACIENTE: HERRERA JUAN\n' +
    'HEMOGRAMA\nHEMOGLOBINA 15.9 g/dl 13.0 - 17.0 30/05/2026\n' +
    'HEMATOCRITO 46.5 % 40.0 - 52.0\nRECUENTO DE PLAQUETAS 267 x10^3/uL\n' +
    'GLICEMIA 101.0 mg/dl 70 - 100\nTSH 4.17 uUI/ml 0.4 - 4.0';

  it('un informe con analitos y unidades → usable (capa 1 resuelve)', () => {
    expect(looksLikeLabText(labText).usable).toBe(true);
  });

  it('texto vacío o casi vacío → fallback (sin_texto)', () => {
    expect(looksLikeLabText('')).toEqual({ usable: false, reason: 'sin_texto' });
    expect(looksLikeLabText('   \n  ').usable).toBe(false);
  });

  it('glifos rotos de un escaneo → fallback (ilegible)', () => {
    // Lo que produce un PDF-imagen sin capa de texto: caracteres no imprimibles.
    const roto = '�� M i c r o s o f t '.repeat(60);
    const v = looksLikeLabText(roto);
    expect(v.usable).toBe(false);
    expect(['ilegible', 'no_parece_lab']).toContain(v.reason);
  });

  it('texto largo pero sin ningún valor de laboratorio → fallback (no_parece_lab)', () => {
    // Un consentimiento o un ECG: prosa sin "número + unidad clínica".
    const prosa =
      'Consentimiento informado para procedimiento anestésico. El paciente declara haber ' +
      'sido informado de los riesgos y acepta el procedimiento programado. '.repeat(8);
    const v = looksLikeLabText(prosa);
    expect(v.usable).toBe(false);
    expect(v.reason).toBe('no_parece_lab');
  });

  it('reconoce varias unidades clínicas comunes', () => {
    const relleno = ' Rango de referencia normal segun el metodo empleado en el laboratorio clinico de la sede.';
    for (const u of ['5.2 mmol/L', '13.5 g/dL', '4500 /uL', '88 fl', '30 mg/dl', '4.1 uUI/ml']) {
      const t = 'LABORATORIO CLINICO — INFORME DE RESULTADOS\nPACIENTE: PRUEBA\nANALITO ' + u + relleno.repeat(2);
      expect(looksLikeLabText(t).usable).toBe(true);
    }
  });
});
