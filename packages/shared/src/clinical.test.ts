import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeIMC, enforceGuardrails, pesoTallaImcText, EXAM_FIELDS } from './clinical';
import type { DocumentJSON } from './document';

describe('computeIMC — oracle + invariantes (PBT)', () => {
  it('ORACLE: imc = kg/(cm/100)^2 redondeado a 1 decimal', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 300, noNaN: true }),
        fc.float({ min: 50, max: 250, noNaN: true }),
        (kg, cm) => {
          const expected = Math.round((kg / ((cm / 100) ** 2)) * 10) / 10;
          expect(computeIMC(kg, cm)).toBe(expected);
        },
      ),
    );
  });

  it('MONÓTONA en peso (misma talla, más peso ⇒ IMC ≥)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 200, noNaN: true }),
        fc.float({ min: 1, max: 200, noNaN: true }),
        fc.float({ min: 100, max: 220, noNaN: true }),
        (a, b, cm) => {
          const lo = Math.min(a, b), hi = Math.max(a, b);
          expect(computeIMC(hi, cm)!).toBeGreaterThanOrEqual(computeIMC(lo, cm)!);
        },
      ),
    );
  });

  it('ejemplo Uribe: 108kg/188cm → 30.6', () => {
    expect(computeIMC(108, 188)).toBe(30.6);
  });

  it('datos inválidos → null', () => {
    expect(computeIMC(0, 180)).toBeNull();
    expect(computeIMC(70, 0)).toBeNull();
  });
});

describe('enforceGuardrails — CS2/CS3/CS4 (PBT invariant)', () => {
  const base: DocumentJSON = {
    identificacion: { imc: { valor: '99', estado: 'ok', fuente: 'llm' } },
    antecedentes: {},
    paraclinicos: {},
    examen_fisico: {
      // el "LLM" intentó poblar valores normales — deben limpiarse
      signos_vitales: { valor: 'TA 120/80', estado: 'ok', fuente: 'llm' },
      via_aerea: { valor: 'Mallampati I', estado: 'ok', fuente: 'llm' },
    },
    valoracion_plan: {},
  };

  it('INVARIANTE: examen físico SIEMPRE pendiente_examen con valor null (CS3)', () => {
    const out = enforceGuardrails(base, 30.6);
    for (const key of EXAM_FIELDS) {
      expect(out.examen_fisico[key]?.estado).toBe('pendiente_examen');
      expect(out.examen_fisico[key]?.valor).toBeNull();
    }
  });

  it('IMC forzado al valor calculado por código (CS4)', () => {
    const out = enforceGuardrails(base, 30.6);
    expect(out.identificacion['imc']?.valor).toBe('30.6');
    expect(out.identificacion['imc']?.fuente).toBe('sistema:calculo');
  });

  it('INVARIANTE: ningún campo estado≠ok conserva valor inventado (CS2)', () => {
    const doc: DocumentJSON = {
      identificacion: { edad: { valor: 'inventada', estado: 'no_reportado', fuente: null } },
      antecedentes: {}, paraclinicos: {},
      examen_fisico: {}, valoracion_plan: {},
    };
    const out = enforceGuardrails(doc, null);
    expect(out.identificacion['edad']?.valor).toBeNull();
  });

  it('CS2: peso_talla_imc se fuerza a los datos reales; el 71/188 fabricado del modelo se descarta', () => {
    // El modelo devolvió peso/talla equivocados (71 kg / 1.88 m). El paciente puso 78/193.
    const doc: DocumentJSON = {
      identificacion: { peso_talla_imc: { valor: '71 kg / 1.88 m / 20.1 kg/m²', estado: 'ok', fuente: 'llm' } },
      antecedentes: {}, paraclinicos: {}, examen_fisico: {}, valoracion_plan: {},
    };
    const out = enforceGuardrails(doc, { imc: computeIMC(78, 193), pesoKg: 78, tallaCm: 193 });
    expect(out.identificacion['peso_talla_imc']?.valor).toBe('78 kg / 1.93 m / 20.9 kg/m²');
    expect(out.identificacion['peso_talla_imc']?.fuente).toBe('paciente; sistema:calculo');
    // El 71 y el 1.88 fabricados no sobreviven.
    expect(out.identificacion['peso_talla_imc']?.valor).not.toContain('71');
    expect(out.identificacion['peso_talla_imc']?.valor).not.toContain('1.88');
  });

  it('CS2: sin peso/talla reales, peso_talla_imc queda no_reportado (no se inventa)', () => {
    const doc: DocumentJSON = {
      identificacion: { peso_talla_imc: { valor: '90 kg / 1.80 m / 27.8 kg/m²', estado: 'ok', fuente: 'llm' } },
      antecedentes: {}, paraclinicos: {}, examen_fisico: {}, valoracion_plan: {},
    };
    const out = enforceGuardrails(doc, { imc: null, pesoKg: null, tallaCm: null });
    expect(out.identificacion['peso_talla_imc']?.valor).toBeNull();
    expect(out.identificacion['peso_talla_imc']?.estado).toBe('no_reportado');
  });
});

describe('pesoTallaImcText', () => {
  it('arma el texto con talla en metros y IMC', () => {
    expect(pesoTallaImcText(78, 193, 20.9)).toBe('78 kg / 1.93 m / 20.9 kg/m²');
  });
  it('sin IMC omite ese tramo', () => {
    expect(pesoTallaImcText(80, 175, null)).toBe('80 kg / 1.75 m');
  });
  it('datos faltantes o inválidos → null', () => {
    expect(pesoTallaImcText(null, 180, 25)).toBeNull();
    expect(pesoTallaImcText(70, 0, 25)).toBeNull();
  });
});

describe('enforceGuardrails — escalas', () => {
  it('no borra las escalas al reconstruir el documento', () => {
    // Regresión: `enforceGuardrails` arma el resultado clave por clave; al añadir `escalas` al
    // contrato sin añadirla aquí, el documento salía siempre sin escalas.
    const escala = {
      escala: 'ARISCAT', nombre: 'ARISCAT — riesgo pulmonar', version: 'ARISCAT@1',
      cortesVersion: null, estado: 'PENDIENTE' as const, puntaje: null, categoria: null,
      variables: [], faltantes: ['SpO2 preoperatoria'], motivo: null,
    };
    const doc = {
      identificacion: {}, antecedentes: {}, paraclinicos: {},
      examen_fisico: {}, valoracion_plan: {}, escalas: [escala],
    };
    const out = enforceGuardrails(doc as never, { imc: null, pesoKg: null, tallaCm: null });
    expect(out.escalas).toHaveLength(1);
    expect(out.escalas?.[0]?.escala).toBe('ARISCAT');
  });
});
