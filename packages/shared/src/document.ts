import { z } from 'zod';

/**
 * Contrato de campo del documento clínico (Prompt Maestro D.8).
 * Cada campo lleva valor + estado + fuente. Nunca se puebla `valor` si el estado no es 'ok'
 * con un dato inventado — regla anti-alucinación (CS2/CS3).
 */
export const fieldStateSchema = z.enum([
  'ok',
  'pendiente_examen',
  'no_reportado',
  'no_disponible',
]);
export type FieldState = z.infer<typeof fieldStateSchema>;

/** Un campo del documento. `valor` puede ser null cuando el estado no es 'ok'. */
export const docFieldSchema = z.object({
  valor: z.string().nullable(),
  estado: fieldStateSchema,
  fuente: z.string().nullable(),
  alerta: z.boolean().optional(),
  nota: z.string().optional(),
});
export type DocField = z.infer<typeof docFieldSchema>;

/**
 * Claves permitidas por sección (Diseño Oficial). Son el contrato: el documento no puede
 * poblar campos fuera de esta lista (CS5 — "cualquier salida que pueble campos prohibidos se
 * rechaza"). Antes esto sólo se forzaba dentro del provider Anthropic; ahora vale en el borde
 * compartido (`documentSchema.parse`), así protege cualquier documento, venga de donde venga.
 *
 * `paraclinicos` es la excepción: sus claves son los TIPOS de estudio realmente extraídos
 * (hemograma, coagulacion, …), variables por caso, así que esa sección queda abierta.
 */
export const ALLOWED_ID_FIELDS = [
  'paciente', 'documento', 'edad_sexo', 'peso_talla_imc', 'imc', 'procedimiento',
  'fecha_procedimiento', 'fecha_valoracion', 'capacidad_funcional', 'tipo_cirugia',
  'condicion_actual', 'diagnostico_preoperatorio', 'asa',
] as const;
export const ALLOWED_ANTECEDENTES_FIELDS = [
  'patologicos', 'quirurgicos', 'medicamentos', 'glp1', 'alergias',
  'transfusionales', 'protesis_dental', 'habitos', 'grupo_sanguineo',
] as const;
export const ALLOWED_EXAM_FIELDS = [
  'signos_vitales', 'via_aerea', 'cuello', 'cardiovascular_respiratorio',
  'abdomen', 'extremidades', 'snc', 'peso_talla_imc',
] as const;
export const ALLOWED_PLAN_FIELDS = ['concepto', 'plan', 'recomendaciones'] as const;

/**
 * Record de DocField cuyas claves están restringidas a `allowed`. Rechaza (con mensaje claro)
 * cualquier clave no prevista — el cierre de CS5 en el borde compartido.
 */
function sectionSchema(allowed: readonly string[]) {
  const set = new Set(allowed);
  return z.record(docFieldSchema).refine(
    (obj) => Object.keys(obj).every((k) => set.has(k)),
    (obj) => ({ message: `Campo(s) no permitido(s): ${Object.keys(obj).filter((k) => !set.has(k)).join(', ')}` }),
  );
}

/**
 * documentSchema — contrato del documento clínico, fiel al Diseño Oficial. Secciones con
 * claves restringidas (CS5) salvo `paraclinicos` (claves dinámicas por tipo de estudio).
 */
export const documentSchema = z.object({
  identificacion: sectionSchema(ALLOWED_ID_FIELDS).default({}),
  antecedentes: sectionSchema(ALLOWED_ANTECEDENTES_FIELDS).default({}),
  paraclinicos: z.record(docFieldSchema).default({}),
  examen_fisico: sectionSchema(ALLOWED_EXAM_FIELDS).default({}),
  valoracion_plan: sectionSchema(ALLOWED_PLAN_FIELDS).default({}),
});
export type DocumentJSON = z.infer<typeof documentSchema>;
