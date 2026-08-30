import { z } from 'zod';
import type { ScheduleFacts } from './facts';

/**
 * Agenda quirúrgica — `PX01`–`PX11` de la Especificación §4.
 *
 * Estos datos NO se le preguntan al paciente. La spec es explícita: *"El paciente no debe
 * decidir si una cirugía es de alto riesgo, cuánto durará o qué tipo de incisión tendrá. Estas
 * variables son responsabilidad de la programación y del anestesiólogo."*
 *
 * Son enums y no texto libre porque los consumen ARISCAT (sitio, duración, urgencia), RCRI
 * (alto riesgo) y Caprini (modalidad, especialidad, duración): una escala no puede depender de
 * que alguien escriba "abdominal alto" igual dos veces.
 */

export const ESPECIALIDADES = [
  'ORL', 'PLASTICA', 'GENERAL', 'BARIATRICA', 'GINECOLOGIA', 'ORTOPEDIA', 'COLUMNA',
  // Oftalmología faltaba y es especialidad quirúrgica frecuente; además POVOC necesita
  // distinguir la cirugía de estrabismo, que es oftalmológica.
  'OFTALMOLOGIA',
  'CARDIOVASCULAR', 'UROLOGIA', 'MAXILOFACIAL', 'ENDOSCOPIA', 'OTRA',
] as const;
export const MODALIDADES = ['AMBULATORIA', 'HOSPITALIZACION', 'NO_DEFINIDA'] as const;
export const PRIORIDADES = ['ELECTIVA', 'URGENTE', 'EMERGENCIA'] as const;
export const SITIOS_ARISCAT = ['PERIFERICO', 'ABDOMINAL_SUPERIOR', 'INTRATORACICO'] as const;
export const DURACIONES = ['MENOR_2H', 'ENTRE_2_Y_3H', 'MAYOR_3H', 'NO_DEFINIDA'] as const;
export const ANESTESIAS = ['GENERAL', 'REGIONAL', 'SEDACION', 'LOCAL', 'COMBINADA', 'POR_DEFINIR'] as const;

export type Especialidad = (typeof ESPECIALIDADES)[number];
export type Modalidad = (typeof MODALIDADES)[number];
export type Prioridad = (typeof PRIORIDADES)[number];
export type SitioAriscat = (typeof SITIOS_ARISCAT)[number];
export type DuracionEstimada = (typeof DURACIONES)[number];
export type AnestesiaProbable = (typeof ANESTESIAS)[number];

/** Etiquetas para la UI del anestesiólogo. */
export const ETIQUETAS_AGENDA = {
  especialidad: {
    ORL: 'ORL', PLASTICA: 'Plástica', GENERAL: 'General', BARIATRICA: 'Bariátrica',
    GINECOLOGIA: 'Ginecología', ORTOPEDIA: 'Ortopedia', COLUMNA: 'Columna',
    CARDIOVASCULAR: 'Cardiovascular', UROLOGIA: 'Urología', MAXILOFACIAL: 'Maxilofacial',
    OFTALMOLOGIA: 'Oftalmología', ENDOSCOPIA: 'Endoscopia', OTRA: 'Otra',
  } as Record<Especialidad, string>,
  modalidad: {
    AMBULATORIA: 'Ambulatoria', HOSPITALIZACION: 'Hospitalización', NO_DEFINIDA: 'No definida',
  } as Record<Modalidad, string>,
  prioridad: {
    ELECTIVA: 'Electiva', URGENTE: 'Urgente', EMERGENCIA: 'Emergencia',
  } as Record<Prioridad, string>,
  sitioQuirurgico: {
    PERIFERICO: 'Periférico', ABDOMINAL_SUPERIOR: 'Abdominal superior',
    INTRATORACICO: 'Intratorácico',
  } as Record<SitioAriscat, string>,
  duracionEstimada: {
    MENOR_2H: 'Menos de 2 h', ENTRE_2_Y_3H: 'Entre 2 y 3 h', MAYOR_3H: 'Más de 3 h',
    NO_DEFINIDA: 'No definida',
  } as Record<DuracionEstimada, string>,
  anestesiaProbable: {
    GENERAL: 'General', REGIONAL: 'Regional', SEDACION: 'Sedación', LOCAL: 'Local',
    COMBINADA: 'Combinada', POR_DEFINIR: 'Por definir',
  } as Record<AnestesiaProbable, string>,
} as const;

/**
 * Contrato de la agenda. Sólo `procedimiento` es obligatorio: el resto puede llenarse después,
 * y mientras falte, las escalas que dependen de él quedan pendientes en vez de calcularse mal.
 */
export const scheduleSchema = z.object({
  /** PX01 */
  procedimiento: z.string().min(2).max(300),
  /** PX02 — no se le exige al paciente conocerlo. */
  diagnosticoPreop: z.string().max(300).nullish(),
  /** PX03 — la edad y la ruta clínica se derivan contra esta fecha. */
  fechaHora: z.string().nullish(),
  /** PX04 */
  especialidad: z.enum(ESPECIALIDADES).nullish(),
  /** PX05 */
  modalidad: z.enum(MODALIDADES).nullish(),
  /** PX06 */
  prioridad: z.enum(PRIORIDADES).nullish(),
  /** PX07 */
  sitioQuirurgico: z.enum(SITIOS_ARISCAT).nullish(),
  /** PX08 */
  duracionEstimada: z.enum(DURACIONES).nullish(),
  /** PX09 — null significa "pendiente de clasificación", no "no". */
  altoRiesgoRcri: z.boolean().nullish(),
  /** PX10 */
  anestesiaProbable: z.enum(ANESTESIAS).nullish(),
  /** PX11 — null significa "por definir"; lo fija el plan anestésico. */
  opioidesPostop: z.boolean().nullish(),
});
export type ScheduleDef = z.infer<typeof scheduleSchema>;

/** Crear un caso: preset + agenda. La agenda entra completa desde el principio. */
export const createCaseSchema = z.object({
  presetId: z.string().min(1),
  schedule: scheduleSchema,
  /** Paciente conocido cuyos datos se precargan (evita repreguntar lo ya disponible). */
  patientId: z.string().nullish(),
});
export type CreateCaseDef = z.infer<typeof createCaseSchema>;

/**
 * Agenda → hechos que consumen las reglas del formulario y, después, las escalas.
 *
 * Se pasan como los valores de enum, no como etiquetas: las reglas del diccionario comparan
 * contra ellos y una etiqueta traducida rompería la activación en silencio.
 */
export function scheduleToFacts(s: ScheduleDef | null | undefined): ScheduleFacts | null {
  if (s == null) return null;
  return {
    especialidad: s.especialidad ?? null,
    modalidad: s.modalidad ?? null,
    prioridad: s.prioridad ?? null,
    sitioQuirurgico: s.sitioQuirurgico ?? null,
    duracionEstimada: s.duracionEstimada ?? null,
    altoRiesgoRcri: s.altoRiesgoRcri ?? null,
    opioidesPostop: s.opioidesPostop ?? null,
    anestesiaProbable: s.anestesiaProbable ?? null,
  };
}

/**
 * Variables de agenda que aún faltan, con el nombre que entiende un humano. Alimenta el aviso
 * de "esta escala está pendiente por falta de X" en vez de dejar la escala muda.
 */
export function faltantesDeAgenda(s: ScheduleDef | null | undefined): string[] {
  if (s == null) return ['toda la programación quirúrgica'];
  const faltan: string[] = [];
  if (!s.fechaHora) faltan.push('fecha del procedimiento');
  if (!s.especialidad) faltan.push('especialidad');
  if (!s.modalidad || s.modalidad === 'NO_DEFINIDA') faltan.push('modalidad');
  if (!s.prioridad) faltan.push('prioridad');
  if (!s.sitioQuirurgico) faltan.push('sitio quirúrgico (ARISCAT)');
  if (!s.duracionEstimada || s.duracionEstimada === 'NO_DEFINIDA') faltan.push('duración estimada');
  if (s.altoRiesgoRcri == null) faltan.push('clasificación de riesgo cardiovascular (RCRI)');
  if (!s.anestesiaProbable || s.anestesiaProbable === 'POR_DEFINIR') faltan.push('anestesia probable');
  if (s.opioidesPostop == null) faltan.push('opioides posoperatorios previstos');
  return faltan;
}
