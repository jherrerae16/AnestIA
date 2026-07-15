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
});
