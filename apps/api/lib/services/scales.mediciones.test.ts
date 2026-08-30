import { describe, it, expect } from 'vitest';
import { extraerMediciones } from './scales.service';

/**
 * Lectura de las mediciones del clínico desde el texto libre del examen físico.
 *
 * El anestesiólogo escribe los signos vitales en una línea, y de ahí salen dos variables de
 * escala: la SpO2 (ARISCAT) y la circunferencia del cuello (STOP-Bang). Un patrón laxo se
 * atascaba en el "2" de "SatO2" y ARISCAT quedaba pendiente para siempre aunque el médico ya
 * hubiera medido.
 */
const conFuente = (valor: string, fuente = 'anestesiologo') => ({
  examen_fisico: { signos_vitales: { valor, estado: 'ok', fuente } },
});

describe('mediciones del clínico', () => {
  it('reconoce las variantes con que se escribe la saturación', () => {
    const casos: [string, number][] = [
      ['TA 128/78 mmHg · FC 72 lpm · SatO2 94 % · T 36.5 °C', 94],
      ['SpO2 97%', 97],
      ['SpO₂ 99 %', 99],
      ['Saturación 91 %', 91],
      ['SatO₂ 96 %', 96],
      ['sao2: 88%', 88],
      ['Sat 95%', 95],
    ];
    for (const [texto, esperado] of casos) {
      expect(extraerMediciones(conFuente(texto)).spo2, texto).toBe(esperado);
    }
  });

  it('lee la circunferencia del cuello', () => {
    expect(extraerMediciones(conFuente('Cuello 42 cm, sin masas')).cuello).toBe(42);
  });

  it('IGNORA el valor si no lo midió el anestesiólogo (CS9)', () => {
    // El sistema llegó a proponer "SatO₂ ≥ 96 %" como referencia. Ese valor no puede alimentar
    // ARISCAT: la Especificación exige que la SpO2 se mida.
    expect(extraerMediciones(conFuente('SatO2 96 %', 'sistema:estimado-ia')).spo2).toBeNull();
    expect(extraerMediciones(conFuente('SatO2 96 %', 'derivado:IA')).spo2).toBeNull();
  });

  it('ignora un campo que no esté en estado ok', () => {
    const pendiente = { examen_fisico: { signos_vitales: { valor: 'SatO2 96 %', estado: 'estimado_ia', fuente: 'anestesiologo' } } };
    expect(extraerMediciones(pendiente).spo2).toBeNull();
  });

  it('acepta tanto "anestesiologo" como "anestesiologo:algo"', () => {
    expect(extraerMediciones(conFuente('SatO2 94 %', 'anestesiologo')).spo2).toBe(94);
    expect(extraerMediciones(conFuente('SatO2 94 %', 'anestesiologo:examen-normal-confirmado')).spo2).toBe(94);
  });

  it('devuelve null sin reventar con entradas raras', () => {
    expect(extraerMediciones(null).spo2).toBeNull();
    expect(extraerMediciones({}).spo2).toBeNull();
    expect(extraerMediciones(conFuente('Sin datos')).spo2).toBeNull();
  });
});
