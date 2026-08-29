import { computeIMC } from './clinical';
import {
  normalizeValue,
  type BandaEtaria,
  type Facts,
  type RutaClinica,
  type AnswerLike,
} from './rules';

/**
 * Hechos derivados que consumen las reglas del formulario (Especificación §1 "Edad derivada",
 * Flujograma §1 "Derivación demográfica").
 *
 * Todo aquí es puro y sin reloj: la fecha de referencia entra explícita, igual que en
 * `computeAge`. Un hecho que dependiera de `Date.now()` haría que la misma respuesta abriera
 * ramas distintas según cuándo se evalúe — y el documento es médico-legal.
 */

/** Edad en meses completos a una fecha de referencia. null si falta o es implausible. */
export function computeAgeMonths(
  birthISO: string | null | undefined,
  refISO: string | null | undefined,
): number | null {
  if (!birthISO || !refISO) return null;
  const d = new Date(birthISO);
  const ref = new Date(refISO);
  if (isNaN(d.getTime()) || isNaN(ref.getTime())) return null;
  let months = (ref.getFullYear() - d.getFullYear()) * 12 + (ref.getMonth() - d.getMonth());
  if (ref.getDate() < d.getDate()) months--;
  return months >= 0 && months < 130 * 12 ? months : null;
}

/** Días completos entre dos fechas. Necesario para separar neonato (0–28 d) de lactante. */
export function computeAgeDays(
  birthISO: string | null | undefined,
  refISO: string | null | undefined,
): number | null {
  if (!birthISO || !refISO) return null;
  const d = new Date(birthISO);
  const ref = new Date(refISO);
  if (isNaN(d.getTime()) || isNaN(ref.getTime())) return null;
  const days = Math.floor((ref.getTime() - d.getTime()) / 86_400_000);
  return days >= 0 && days < 130 * 366 ? days : null;
}

/**
 * Banda etaria de la Especificación §1. El paciente NUNCA la elige: se deriva.
 * 0–28 d neonato · 29 d–2 a lactante · 3–12 a niño · 13–17 adolescente · 18–49 adulto ·
 * 50–64 adulto ≥50 (aporta a STOP-Bang) · 65–74 adulto mayor (activa FRAIL) · ≥75 (FRAIL + Caprini).
 */
export function bandaEtaria(days: number | null, years: number | null): BandaEtaria | null {
  if (days != null && days <= 28) return 'NEONATO';
  if (years == null) return null;
  if (years < 3) return 'LACTANTE';
  if (years <= 12) return 'NINO';
  if (years <= 17) return 'ADOLESCENTE';
  if (years <= 49) return 'ADULTO';
  if (years <= 64) return 'ADULTO_50';
  if (years <= 74) return 'ADULTO_65';
  return 'ADULTO_75';
}

/**
 * Ruta clínica. La ginecoobstétrica NO se deriva del sexo: la Especificación es explícita en que
 * la posibilidad de embarazo se pregunta "solo cuando biológicamente y clínicamente sea
 * pertinente", y el Flujograma advierte que el sexo registrado al nacer "no debe crear por sí
 * solo una ruta extensa". Por eso el sexo abre preguntas (GO01…), no una ruta.
 */
export function rutaClinica(banda: BandaEtaria | null): RutaClinica | null {
  if (banda == null) return null;
  if (banda === 'NEONATO' || banda === 'LACTANTE' || banda === 'NINO' || banda === 'ADOLESCENTE') {
    return 'PEDIATRICA';
  }
  if (banda === 'ADULTO_65' || banda === 'ADULTO_75') return 'ADULTO_MAYOR';
  return 'ADULTO';
}

/** Atributos de la agenda quirúrgica (`PX01–PX11`). Todo opcional: en Fase 1 llega vacío. */
export interface ScheduleFacts {
  especialidad?: string | null;
  modalidad?: string | null;
  prioridad?: string | null;
  sitioQuirurgico?: string | null;
  duracionEstimada?: string | null;
  altoRiesgoRcri?: boolean | null;
  opioidesPostop?: boolean | null;
  anestesiaProbable?: string | null;
}

export interface BuildFactsInput {
  answers: Readonly<Record<string, AnswerLike | undefined>>;
  /** Agenda quirúrgica. `null` mientras no exista `CaseSchedule` (Fase 2). */
  schedule?: ScheduleFacts | null;
  /** Fecha del procedimiento, o de la valoración. La edad se calcula contra ella. */
  refDateISO: string | null;
  /** Códigos del diccionario de los que salen los hechos antropométricos y de identidad. */
  codes?: {
    fechaNacimiento: string;
    sexoNacimiento: string;
    peso: string;
    talla: string;
    quienResponde: string;
  };
}

const DEFAULT_CODES = {
  fechaNacimiento: 'ID03',
  sexoNacimiento: 'ID04',
  peso: 'ID10',
  talla: 'ID11',
  quienResponde: 'ID07',
} as const;

function text(a: AnswerLike | undefined): string {
  if (a == null || a.value == null) return '';
  if (Array.isArray(a.value)) return a.value.join(', ');
  return String(a.value).trim();
}

function num(a: AnswerLike | undefined): number | null {
  const s = text(a).replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) && n > 0 ? n : null;
}

/** Construye los hechos derivados. Puro. */
export function buildFacts(input: BuildFactsInput): Facts {
  const c = input.codes ?? DEFAULT_CODES;
  const a = input.answers;

  const birth = text(a[c.fechaNacimiento]) || null;
  const months = computeAgeMonths(birth, input.refDateISO);
  const days = computeAgeDays(birth, input.refDateISO);
  const years = months == null ? null : Math.floor(months / 12);
  const banda = bandaEtaria(days, years);

  const pesoKg = num(a[c.peso]);
  const tallaCm = num(a[c.talla]);
  const imc = pesoKg != null && tallaCm != null ? computeIMC(pesoKg, tallaCm) : null;

  const quienResponde = normalizeValue(text(a[c.quienResponde]));
  const s = input.schedule ?? null;

  return {
    edad_anios: years,
    edad_meses: months,
    banda_etaria: banda,
    ruta: rutaClinica(banda),
    sexo_nacimiento: normalizeValue(text(a[c.sexoNacimiento])) || null,
    imc,
    // "Paciente" responde por sí mismo; cualquier otra opción es acudiente. En ruta pediátrica
    // la Especificación §14 exige registrar quién respondió cada dato.
    responde_acudiente: quienResponde ? quienResponde !== 'paciente' : null,
    'px.disponible': s != null,
    'px.especialidad': s?.especialidad ?? null,
    'px.modalidad': s?.modalidad ?? null,
    'px.prioridad': s?.prioridad ?? null,
    'px.sitio_quirurgico': s?.sitioQuirurgico ?? null,
    'px.duracion_estimada': s?.duracionEstimada ?? null,
    'px.alto_riesgo_rcri': s?.altoRiesgoRcri ?? null,
    'px.opioides_postop': s?.opioidesPostop ?? null,
    'px.anestesia_probable': s?.anestesiaProbable ?? null,
    'doc.tiene_labs': null,
  };
}
