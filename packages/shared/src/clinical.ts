import type { DocumentJSON, DocField } from './document';

export const PROMPT_MAESTRO_VERSION = 'prompt-maestro-v2';

/** Campos del examen físico que SIEMPRE quedan pendientes (CS3). */
export const EXAM_FIELDS = [
  'signos_vitales',
  'via_aerea',
  'cuello',
  'cardiovascular_respiratorio',
  'abdomen',
  'extremidades',
  'snc',
  'peso_talla_imc',
] as const;

export interface ClinicalInput {
  caseId: string;
  answers: Record<string, { value: unknown; type: string }>;
  labs: { analyte: string; value: string; unit?: string | null; flag: string; sourceRef?: string | null }[];
  glp1: { declared: boolean; drug?: string };
  imc: number | null;
}

/** IMC determinístico (kg / m^2), 1 decimal. Convierte cm→m. null si datos inválidos. */
export function computeIMC(pesoKg: number, tallaCm: number): number | null {
  if (!isFinite(pesoKg) || !isFinite(tallaCm) || pesoKg <= 0 || tallaCm <= 0) return null;
  const m = tallaCm / 100;
  const imc = pesoKg / (m * m);
  if (!isFinite(imc)) return null;
  return Math.round(imc * 10) / 10;
}

/**
 * Sugerencia de ASA determinística simple, a partir de comorbilidades declaradas.
 * MARCADA como derivada — debe verificarla el anestesiólogo (CS4). No sustituye al LLM.
 */
export function suggestASA(comorbilidades: string[]): { grado: string; justificacion: string } {
  const c = comorbilidades.map((x) => x.toLowerCase());
  const severe = ['insuficiencia renal', 'infarto', 'hipertensión pulmonar', 'epoc'];
  const mild = ['hta', 'diabetes', 'asma', 'hipotiroidismo', 'apnea del sueño'];
  const hasSevere = c.some((x) => severe.some((s) => x.includes(s)));
  const hasMild = c.some((x) => mild.some((s) => x.includes(s)));
  if (hasSevere) return { grado: 'III', justificacion: 'Enfermedad sistémica grave declarada (derivado, verificar).' };
  if (hasMild) return { grado: 'II', justificacion: 'Enfermedad sistémica leve controlada declarada (derivado, verificar).' };
  return { grado: 'I', justificacion: 'Sin comorbilidades declaradas (derivado, verificar).' };
}

function pending(): DocField {
  return { valor: null, estado: 'pendiente_examen', fuente: null };
}

/**
 * Guardarraíles post-generación (CS2/CS3/CS4). Segunda línea sobre el schema:
 * - examen físico: TODOS los campos → pendiente_examen, valor=null (nunca "normales").
 * - IMC: se fuerza al valor calculado por código.
 * - cualquier campo con estado≠'ok' → valor=null (no inventar).
 */
export function enforceGuardrails(doc: DocumentJSON, imc: number | null): DocumentJSON {
  const out: DocumentJSON = {
    identificacion: { ...doc.identificacion },
    antecedentes: { ...doc.antecedentes },
    paraclinicos: { ...doc.paraclinicos },
    examen_fisico: {},
    valoracion_plan: { ...doc.valoracion_plan },
  };

  // Examen físico SIEMPRE pendiente (CS3).
  for (const key of EXAM_FIELDS) out.examen_fisico[key] = pending();

  // IMC por código (CS4).
  if (imc != null) {
    out.identificacion['imc'] = { valor: String(imc), estado: 'ok', fuente: 'sistema:calculo' };
  }

  // Ningún campo con estado≠ok con valor inventado (CS2).
  for (const section of ['identificacion', 'antecedentes', 'paraclinicos', 'valoracion_plan'] as const) {
    for (const [k, f] of Object.entries(out[section])) {
      if (f.estado !== 'ok' && f.valor != null) {
        out[section][k] = { ...f, valor: null };
      }
    }
  }
  return out;
}
