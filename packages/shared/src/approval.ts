import type { DocumentJSON, DocField } from './document';
import { EXAM_FIELDS } from './clinical';

/** Campos de identificación obligatorios para poder aprobar. */
export const REQUIRED_ID_FIELDS = ['paciente', 'documento', 'procedimiento', 'asa'] as const;

/** Etiquetas legibles del examen, para nombrar lo que falta al bloquear la aprobación. */
const EXAM_LABELS: Record<string, string> = {
  peso_talla_imc: 'peso / talla / IMC',
  signos_vitales: 'signos vitales',
  via_aerea: 'vía aérea',
  cuello: 'cuello',
  cardiovascular_respiratorio: 'cardiovascular / respiratorio',
  abdomen: 'abdomen',
  extremidades: 'extremidades',
  snc: 'sistema nervioso central',
};

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
  if (Object.keys(exam).length === 0) {
    blockers.push('El examen físico está pendiente. Ingresa o confirma los valores antes de aprobar.');
  } else if (pending.length > 0) {
    // Nombrar los campos: los medidos (signos vitales, peso/talla) no los cubre la
    // atestación de examen normal y hay que teclearlos, así que decir sólo "pendiente"
    // deja al médico buscando qué falta.
    const nombres = pending.map(([k]) => EXAM_LABELS[k] ?? k).join(', ');
    blockers.push(`Falta registrar en el examen físico: ${nombres}. Son datos medidos: deben ingresarse.`);
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

/**
 * Campos del examen que exigen un INSTRUMENTO para conocerse: tensiómetro, pulsioxímetro,
 * báscula. No hay atestación posible sin medición — un "normal" aquí sería una cifra
 * concreta que nadie tomó, dentro de un documento firmado (CS3). Se teclean o no se aprueba.
 */
export const MEASURED_EXAM_FIELDS = ['signos_vitales', 'peso_talla_imc'] as const;

/** ¿El campo requiere medición instrumental (y por tanto no es atestable en bloque)? */
export function requiresMeasurement(key: string): boolean {
  return (MEASURED_EXAM_FIELDS as readonly string[]).includes(key);
}

/**
 * Hallazgos cualitativos del examen presencial. El anestesiólogo SÍ puede atestarlos de
 * memoria tras explorar al paciente: son observaciones, no lecturas de aparato.
 * `signos_vitales` y `peso_talla_imc` NO están aquí a propósito — ver MEASURED_EXAM_FIELDS.
 */
export const NORMAL_EXAM: Record<string, string> = {
  via_aerea: 'Mallampati I · AO >4 cm · DTM >6 cm',
  cuello: 'Móvil, sin masas',
  cardiovascular_respiratorio: 'Ruidos cardíacos rítmicos sin soplos; murmullo vesicular conservado',
  abdomen: 'Blando, no doloroso',
  extremidades: 'Sin edemas, pulsos presentes',
  snc: 'Alerta, orientado, sin déficit',
};

function okField(valor: string, fuente = 'anestesiologo'): DocField {
  return { valor, estado: 'ok', fuente };
}

/**
 * Atestación de examen presencial normal (CS3). Rellena SÓLO los hallazgos cualitativos que
 * el anestesiólogo puede confirmar de memoria tras explorar al paciente.
 *
 * Los signos vitales y el peso/talla NO se rellenan: son cifras que exigen instrumento, y
 * escribir "TA 120/80" sin haber medido pondría un dato fabricado en un documento firmado —
 * exactamente lo que prohíbe CS2. Quedan en `pendiente_examen`, lo que además bloquea la
 * aprobación (canApprove) hasta que el médico los teclee.
 */
export function applyExamNormal(fields: DocumentJSON): DocumentJSON {
  const examen_fisico: Record<string, DocField> = { ...(fields.examen_fisico ?? {}) };
  for (const key of EXAM_FIELDS) {
    if (requiresMeasurement(key)) {
      // Se respeta lo ya medido; si no hay medición, sigue pendiente.
      if (examen_fisico[key]?.estado !== 'ok') examen_fisico[key] = pendingExam();
      continue;
    }
    examen_fisico[key] = {
      valor: NORMAL_EXAM[key] ?? 'Sin hallazgos',
      estado: 'ok',
      fuente: 'anestesiologo:examen-normal-confirmado',
      nota: 'Confirmado como normal por el anestesiólogo tras examen presencial',
    };
  }
  return { ...fields, examen_fisico };
}

/** Campo del examen aún no medido. */
function pendingExam(): DocField {
  return { valor: null, estado: 'pendiente_examen', fuente: null };
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
