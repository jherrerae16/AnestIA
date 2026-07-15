import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeIMC, enforceGuardrails, EXAM_FIELDS } from './clinical';
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
});
