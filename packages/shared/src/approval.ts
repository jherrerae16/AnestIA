import type { DocumentJSON, DocField } from './document';
import { EXAM_FIELDS } from './clinical';

/** Campos de identificación obligatorios para poder aprobar. */
export const REQUIRED_ID_FIELDS = ['paciente', 'documento', 'procedimiento', 'asa'] as const;

export interface ApprovalCheck {
  ok: boolean;
  blockers: string[];
}

/**
 * Regla BLOQUEANTE de aprobación (CS3/CS1). No aprobable si:
 *  - algún campo del examen físico sigue en 'pendiente_examen', o
 *  - falta un campo de identificación obligatorio.
 * Pura → testeable y re-evaluada en el servidor (no burlable desde el cliente).
 */
export function canApprove(fields: DocumentJSON): ApprovalCheck {
  const blockers: string[] = [];

  const exam = fields.examen_fisico ?? {};
  const pending = Object.entries(exam).filter(([, f]) => f?.estado === 'pendiente_examen');
  if (Object.keys(exam).length === 0 || pending.length > 0) {
    blockers.push('El examen físico está pendiente. Ingresa o confirma los valores antes de aprobar.');
  }

  const id = fields.identificacion ?? {};
  for (const key of REQUIRED_ID_FIELDS) {
    const f = id[key];
    if (!f || f.estado !== 'ok' || f.valor == null || f.valor === '') {
      blockers.push(`Falta el campo obligatorio "${key}".`);
    }
  }

  return { ok: blockers.length === 0, blockers };
}

/** Valores normales estándar del examen físico (confirmación activa del anestesiólogo). */
export const NORMAL_EXAM: Record<string, string> = {
  signos_vitales: 'TA 120/80 mmHg · FC 72 lpm · FR 16 rpm · SatO2 98%',
  via_aerea: 'Mallampati I · AO >4 cm · DTM >6 cm',
  cuello: 'Móvil, sin masas',
  cardiovascular_respiratorio: 'Ruidos cardíacos rítmicos sin soplos; murmullo vesicular conservado',
  abdomen: 'Blando, no doloroso',
  extremidades: 'Sin edemas, pulsos presentes',
  snc: 'Alerta, orientado, sin déficit',
  peso_talla_imc: 'Según datos del formulario',
};

function okField(valor: string, fuente = 'anestesiologo'): DocField {
  return { valor, estado: 'ok', fuente };
}

/**
 * Rellena el examen físico con valores normales COMO ATESTACIÓN EXPLÍCITA del anestesiólogo
 * (CS3): NO son "normales por defecto" ni inferidos por la IA. La fuente y la nota dejan
 * trazabilidad de que fue una confirmación activa de examen presencial normal; requiere que
 * el llamador (servidor) exija la atestación del médico. Cada valor sigue siendo editable
 * campo a campo antes de aprobar.
 */
export function applyExamNormal(fields: DocumentJSON): DocumentJSON {
  const examen_fisico: Record<string, DocField> = {};
  for (const key of EXAM_FIELDS) {
    examen_fisico[key] = {
      valor: NORMAL_EXAM[key] ?? 'Sin hallazgos',
      estado: 'ok',
      fuente: 'anestesiologo:examen-normal-confirmado',
      nota: 'Confirmado como normal por el anestesiólogo tras examen presencial',
    };
  }
  return { ...fields, examen_fisico };
}

/** Aplica una edición puntual a un campo (sección.clave). */
export function applyEdit(
  fields: DocumentJSON,
  section: keyof DocumentJSON,
  key: string,
  value: string,
): DocumentJSON {
  const sec = { ...(fields[section] as Record<string, DocField>) };
  const prev = sec[key];
  sec[key] = { valor: value, estado: 'ok', fuente: prev?.fuente ?? 'anestesiologo', nota: 'editado por el anestesiólogo' };
  return { ...fields, [section]: sec };
}
