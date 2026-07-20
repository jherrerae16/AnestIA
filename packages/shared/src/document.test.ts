import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { docFieldSchema, documentSchema, fieldStateSchema } from './document';

describe('documentSchema — round-trip (PBT-02)', () => {
  const fieldArb = fc.record({
    valor: fc.option(fc.string(), { nil: null }),
    estado: fc.constantFrom('ok', 'pendiente_examen', 'no_reportado', 'no_disponible'),
    fuente: fc.option(fc.string(), { nil: null }),
  });

  it('parse(field) preserva el objeto para cualquier DocField válido', () => {
    fc.assert(
      fc.property(fieldArb, (f) => {
        const parsed = docFieldSchema.parse(f);
        expect(parsed.valor).toEqual(f.valor);
        expect(parsed.estado).toEqual(f.estado);
        expect(parsed.fuente).toEqual(f.fuente);
      }),
    );
  });

  it('fieldState sólo acepta los 4 estados (example)', () => {
    expect(fieldStateSchema.safeParse('inventado').success).toBe(false);
    expect(fieldStateSchema.safeParse('pendiente_examen').success).toBe(true);
  });

  it('documentSchema acepta examen_fisico pendiente (CS3, example)', () => {
    const doc = documentSchema.parse({
      identificacion: {},
      antecedentes: {},
      paraclinicos: {},
      examen_fisico: { signos_vitales: { valor: null, estado: 'pendiente_examen', fuente: null } },
      valoracion_plan: {},
    });
    expect(doc.examen_fisico.signos_vitales?.estado).toBe('pendiente_examen');
  });

  describe('CS5 — claves restringidas por sección (A-A3)', () => {
    const emptyDoc = { identificacion: {}, antecedentes: {}, paraclinicos: {}, examen_fisico: {}, valoracion_plan: {} };
    const field = { valor: 'X', estado: 'ok' as const, fuente: 'llm' };

    it('acepta las claves canónicas de identificacion (incluida imc)', () => {
      const r = documentSchema.safeParse({ ...emptyDoc, identificacion: { paciente: field, imc: field, asa: field } });
      expect(r.success).toBe(true);
    });

    it('RECHAZA una clave prohibida en identificacion', () => {
      const r = documentSchema.safeParse({ ...emptyDoc, identificacion: { campo_inventado: field } });
      expect(r.success).toBe(false);
    });

    it('RECHAZA una clave prohibida en antecedentes / examen_fisico / valoracion_plan', () => {
      expect(documentSchema.safeParse({ ...emptyDoc, antecedentes: { x_raro: field } }).success).toBe(false);
      expect(documentSchema.safeParse({ ...emptyDoc, examen_fisico: { x_raro: field } }).success).toBe(false);
      expect(documentSchema.safeParse({ ...emptyDoc, valoracion_plan: { x_raro: field } }).success).toBe(false);
    });

    it('paraclinicos SÍ acepta claves dinámicas (tipos de estudio)', () => {
      const r = documentSchema.safeParse({ ...emptyDoc, paraclinicos: { hemograma: field, coagulacion: field } });
      expect(r.success).toBe(true);
    });
  });
});
