import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { canApprove, applyExamNormal, requiresMeasurement, MEASURED_EXAM_FIELDS } from './approval';
import { EXAM_FIELDS } from './clinical';
import type { DocumentJSON } from './document';

function baseFields(examPending: boolean, idComplete: boolean): DocumentJSON {
  const id: DocumentJSON['identificacion'] = idComplete
    ? {
        paciente: { valor: 'Ana', estado: 'ok', fuente: 'P1' },
        documento: { valor: '123', estado: 'ok', fuente: 'P2' },
        procedimiento: { valor: 'Cx', estado: 'ok', fuente: 'P9' },
        asa: { valor: 'II', estado: 'ok', fuente: 'IA' },
      }
    : { paciente: { valor: 'Ana', estado: 'ok', fuente: 'P1' } };
  const examen_fisico: DocumentJSON['examen_fisico'] = {};
  for (const k of EXAM_FIELDS) {
    examen_fisico[k] = examPending
      ? { valor: null, estado: 'pendiente_examen', fuente: null }
      : { valor: 'normal', estado: 'ok', fuente: 'anestesiologo' };
  }
  return { identificacion: id, antecedentes: {}, paraclinicos: {}, examen_fisico, valoracion_plan: {} };
}

describe('canApprove — regla bloqueante (PBT invariant)', () => {
  it('INVARIANTE: examen pendiente O identificación incompleta ⇒ NO aprobable', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (examPending, idComplete) => {
        const check = canApprove(baseFields(examPending, idComplete));
        if (examPending || !idComplete) {
          expect(check.ok).toBe(false);
          expect(check.blockers.length).toBeGreaterThan(0);
        } else {
          expect(check.ok).toBe(true);
          expect(check.blockers).toEqual([]);
        }
      }),
    );
  });

  it('examen pendiente → blocker de examen (example)', () => {
    const check = canApprove(baseFields(true, true));
    expect(check.ok).toBe(false);
    expect(check.blockers.some((b) => b.includes('examen físico'))).toBe(true);
  });
});

describe('applyExamNormal', () => {
  it('confirma los hallazgos cualitativos con trazabilidad de la atestación', () => {
    const withNormal = applyExamNormal(baseFields(true, true));
    for (const k of EXAM_FIELDS) {
      if (requiresMeasurement(k)) continue;
      expect(withNormal.examen_fisico[k]?.estado).toBe('ok');
      // CS3: la fuente deja trazabilidad de que fue una atestación explícita, no "normal por defecto".
      expect(withNormal.examen_fisico[k]?.fuente).toBe('anestesiologo:examen-normal-confirmado');
    }
  });

  // CS2: el corazón de esta regla. Un clic no puede escribir "TA 120/80" en un documento
  // firmado cuando nadie puso un tensiómetro.
  it('NUNCA inventa cifras: signos vitales y peso/talla siguen pendientes', () => {
    const withNormal = applyExamNormal(baseFields(true, true));
    for (const k of MEASURED_EXAM_FIELDS) {
      expect(withNormal.examen_fisico[k]?.estado).toBe('pendiente_examen');
      expect(withNormal.examen_fisico[k]?.valor).toBeNull();
    }
    expect(JSON.stringify(withNormal)).not.toContain('120/80');
  });

  it('no se puede aprobar sólo con la atestación: falta lo medido', () => {
    const withNormal = applyExamNormal(baseFields(true, true));
    const check = canApprove(withNormal);
    expect(check.ok).toBe(false);
    expect(check.blockers.some((b) => b.includes('signos vitales'))).toBe(true);
  });

  it('con los valores medidos ya ingresados, la atestación los respeta y se puede aprobar', () => {
    const base = baseFields(true, true);
    base.examen_fisico['signos_vitales'] = { valor: 'TA 138/86 · FC 88', estado: 'ok', fuente: 'anestesiologo' };
    base.examen_fisico['peso_talla_imc'] = { valor: '76 kg / 1.95 m', estado: 'ok', fuente: 'anestesiologo' };
    const withNormal = applyExamNormal(base);
    expect(withNormal.examen_fisico['signos_vitales']?.valor).toBe('TA 138/86 · FC 88');
    expect(canApprove(withNormal).ok).toBe(true);
  });
});

describe('canApprove — escalas', () => {
  const examenCompleto = Object.fromEntries(
    ['signos_vitales','via_aerea','cuello','cardiovascular_respiratorio','abdomen','extremidades','snc','peso_talla_imc']
      .map((k) => [k, { valor: 'Normal', estado: 'ok' as const, fuente: 'anestesiologo:confirmado' }]),
  );
  const base = {
    identificacion: {
      paciente: { valor: 'Ana', estado: 'ok' as const, fuente: 'formulario:ID01' },
      documento: { valor: '123', estado: 'ok' as const, fuente: 'formulario:ID02' },
      procedimiento: { valor: 'Rinoplastia', estado: 'ok' as const, fuente: 'agenda:PX01' },
      asa: { valor: 'ASA I', estado: 'ok' as const, fuente: 'derivado:IA' },
    },
    antecedentes: {}, paraclinicos: {}, examen_fisico: examenCompleto, valoracion_plan: {},
  };
  const escala = (over: Record<string, unknown> = {}) => ({
    escala: 'ARISCAT', nombre: 'ARISCAT — riesgo pulmonar', version: 'ARISCAT@1',
    cortesVersion: null, estado: 'PENDIENTE' as const, puntaje: null, categoria: null,
    variables: [], faltantes: ['SpO2 preoperatoria'], motivo: null, ...over,
  });

  it('una escala PENDIENTE no impide aprobar', () => {
    // Bloquear presionaría al médico a inventar la variable que falta para destrabar el PDF.
    const r = canApprove({ ...base, escalas: [escala()] } as never);
    expect(r.ok).toBe(true);
  });

  it('una REVISION_CLINICA sin resolver sí bloquea', () => {
    const r = canApprove({
      ...base,
      escalas: [escala({ estado: 'REVISION_CLINICA', faltantes: [], motivo: 'Discordancia en la SpO2.' })],
    } as never);
    expect(r.ok).toBe(false);
    expect(r.blockers.join()).toMatch(/revisión clínica/i);
  });

  it('una escala CALCULADA con faltantes es incoherente y bloquea', () => {
    const r = canApprove({
      ...base,
      escalas: [escala({ estado: 'CALCULADA', puntaje: 12, faltantes: ['Hemoglobina'] })],
    } as never);
    expect(r.ok).toBe(false);
    expect(r.blockers.join()).toMatch(/incoherente/i);
  });

  it('sin escalas, la aprobación se comporta como antes', () => {
    expect(canApprove(base as never).ok).toBe(true);
  });
});
