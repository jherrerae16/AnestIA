import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { canApprove, applyExamNormal } from './approval';
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
  it('limpia el estado pendiente: tras aplicar, canApprove no bloquea por examen', () => {
    const withNormal = applyExamNormal(baseFields(true, true));
    for (const k of EXAM_FIELDS) {
      expect(withNormal.examen_fisico[k]?.estado).toBe('ok');
      expect(withNormal.examen_fisico[k]?.fuente).toBe('anestesiologo');
    }
    expect(canApprove(withNormal).ok).toBe(true);
  });
});
