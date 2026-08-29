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
  /** Peso/talla reales del paciente (ID10/ID11), fuerzan peso_talla_imc por código (CS2). */
  pesoKg: number | null;
  tallaCm: number | null;
  /** Edad en años (ID03 contra la fecha del procedimiento). */
  edad?: number | null;
  /** Datos de la agenda quirúrgica (PX01, PX03). No salen del formulario. */
  procedimiento?: string | null;
  /** PX02 — el diagnóstico preoperatorio lo aporta la programación, no el paciente. */
  diagnosticoPreop?: string | null;
  fechaProcedimiento?: string | null;
}

/**
 * Edad en años a una fecha de referencia (p. ej. la fecha de cirugía P10), sin usar Date.now
 * para no depender del reloj del proceso. `birthISO`/`refISO` en formato de fecha parseable.
 * Devuelve null si faltan datos o el resultado es implausible (<0 o ≥130).
 */
export function computeAge(birthISO: string | null | undefined, refISO: string | null | undefined): number | null {
  if (!birthISO || !refISO) return null;
  const d = new Date(birthISO);
  const ref = new Date(refISO);
  if (isNaN(d.getTime()) || isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
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

/** Signos antropométricos que el código conoce con certeza (respuestas del paciente + cálculo). */
export interface Vitals {
  imc: number | null;
  pesoKg?: number | null;
  tallaCm?: number | null;
  /** Edad en años (de P3), para estimar signos vitales de referencia. */
  edad?: number | null;
  /**
   * Si true y el perfil no tiene comorbilidades, `signos_vitales` sale en `estimado_ia`
   * (referencia por edad/IMC, etiquetada, que bloquea la aprobación). Si false → pendiente.
   */
  estimarSignos?: boolean;
}

/**
 * Signos vitales de REFERENCIA esperados para un adulto sano según su edad/IMC. NO es una
 * medición: es un estimado de tamizaje que el sistema propone para que el anestesiólogo lo
 * confirme o corrija (CS3 — se marca "estimado — sin medir" y bloquea la aprobación). Devuelve
 * null si faltan datos mínimos (edad) o el perfil no es adulto (los rangos pediátricos difieren).
 */
export function estimateSignosVitales(edad: number | null | undefined, imc: number | null): string | null {
  if (edad == null || !isFinite(edad) || edad < 15 || edad > 120) return null;
  // Rangos de normalidad del adulto (referencia, no lectura de aparato).
  const fc = '60–100 lpm';
  const ta = '110–130 / 70–85 mmHg';
  const fr = '12–20 rpm';
  const sat = '≥ 96 % (aire ambiente)';
  const temp = '36.0–37.0 °C';
  const nota = imc != null && imc >= 30 ? ' (IMC elevado: vigilar vía aérea y saturación)' : '';
  return `FC ${fc} · TA ${ta} · FR ${fr} · SatO₂ ${sat} · T ${temp}${nota}`;
}

/**
 * Construye el texto "peso / talla / IMC" desde los datos reales (paciente + cálculo).
 * Ej: "78 kg / 1.93 m / 20.9 kg/m²". Devuelve null si faltan peso o talla.
 */
export function pesoTallaImcText(pesoKg: number | null | undefined, tallaCm: number | null | undefined, imc: number | null): string | null {
  if (pesoKg == null || tallaCm == null || !isFinite(pesoKg) || !isFinite(tallaCm) || pesoKg <= 0 || tallaCm <= 0) {
    return null;
  }
  const m = (tallaCm / 100).toFixed(2);
  const imcTxt = imc != null ? ` / ${imc} kg/m²` : '';
  return `${pesoKg} kg / ${m} m${imcTxt}`;
}

/**
 * Guardarraíles post-generación (CS2/CS3/CS4). Segunda línea sobre el schema:
 * - examen físico: TODOS los campos → pendiente_examen, valor=null (nunca "normales").
 * - peso/talla/IMC: se FUERZAN a las respuestas reales del paciente + cálculo (nunca lo que
 *   el modelo "recuerde" — así no aparece un 71/188 fabricado sobre un 78/193 real).
 * - IMC suelto: se fuerza al valor calculado por código.
 * - cualquier campo con estado≠'ok' → valor=null (no inventar).
 *
 * `vitals` acepta un número (retrocompat: sólo IMC) o el objeto completo con peso/talla.
 */
export function enforceGuardrails(doc: DocumentJSON, vitals: Vitals | number | null): DocumentJSON {
  const v: Vitals = typeof vitals === 'number' || vitals == null ? { imc: vitals ?? null } : vitals;

  const out: DocumentJSON = {
    identificacion: { ...doc.identificacion },
    antecedentes: { ...doc.antecedentes },
    paraclinicos: { ...doc.paraclinicos },
    examen_fisico: {},
    valoracion_plan: { ...doc.valoracion_plan },
    // Las escalas pasan intactas: las calcula el código, no el modelo, así que no hay nada que
    // guardar aquí. Reconstruir el documento clave por clave y olvidarlas las borraba entero.
    escalas: doc.escalas ?? [],
  };

  // Examen físico SIEMPRE pendiente (CS3).
  for (const key of EXAM_FIELDS) out.examen_fisico[key] = pending();

  // Signos vitales: si se pidió estimar y el perfil lo permite, se proponen valores de
  // REFERENCIA en standby (estado 'estimado_ia'). NO es una medición — se etiqueta y sigue
  // bloqueando la aprobación hasta que el anestesiólogo lo confirme o teclee lo medido (CS3).
  if (v.estimarSignos) {
    const sv = estimateSignosVitales(v.edad, v.imc);
    if (sv != null) {
      out.examen_fisico['signos_vitales'] = { valor: sv, estado: 'estimado_ia', fuente: 'sistema:estimado-ia' };
    }
  }

  // IMC suelto por código (CS4).
  if (v.imc != null) {
    out.identificacion['imc'] = { valor: String(v.imc), estado: 'ok', fuente: 'sistema:calculo' };
  }

  // peso_talla_imc de identificación: texto armado por código desde el peso/talla reales del
  // paciente (CS2). El modelo NO decide estos números. Si faltan datos, queda no_reportado.
  const ptiKey = 'peso_talla_imc';
  if (ptiKey in out.identificacion) {
    const txt = pesoTallaImcText(v.pesoKg, v.tallaCm, v.imc);
    out.identificacion[ptiKey] = txt != null
      ? { valor: txt, estado: 'ok', fuente: 'paciente; sistema:calculo' }
      : { valor: null, estado: 'no_reportado', fuente: null };
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
