import { z } from 'zod';
import { evaluateRule, ruleSchema, type Facts, type RuleContext } from './rules';

export const questionTypeSchema = z.enum([
  'TEXTO_CORTO',
  'TEXTO_LARGO',
  'SELECCION_UNICA',
  'SELECCION_MULTIPLE',
  'FECHA',
  'NUMERO',
  'SI_NO',
  'ARCHIVO',
  // ── Tipos de la especificación del Dr. Luquetta ──────────────────────────────────────
  /**
   * Sí / No / No sabe. `SI_NO` es binario y no puede expresar el tercer estado que los tres
   * documentos exigen: "'No sabe', campo vacío o documento ilegible nunca se convierte en 'No'".
   */
  'SI_NO_NOSABE',
  /** Un grupo de antecedentes en acordeón, con "Ninguna" excluyente (Especificación §5). */
  'ACORDEON_MULTIPLE',
  /** Lista repetible con campos estructurados (medicamentos: nombre, dosis, última dosis…). */
  'REPETIDOR',
  'FECHA_HORA',
  // Tipos con semántica de entrada propia. Existen para que el formulario deje de adivinar
  // por el TEXTO de la etiqueta (hoy `isPhone`/`isDocument` hacen regex sobre el label, así
  // que reescribir una pregunta cambia cómo se renderiza).
  'TELEFONO',
  'CORREO',
  'DOCUMENTO_ID',
]);
export type QuestionTypeT = z.infer<typeof questionTypeSchema>;

/** Tipos que admiten respuesta de tres estados. Ver `assertDictionaryValid`. */
export const TIPOS_TERNARIOS: readonly QuestionTypeT[] = ['SI_NO_NOSABE'];

/**
 * Regla de activación. Sustituye al condicional de un solo `showIf` por el árbol declarativo
 * de `rules.ts`: la especificación necesita componer sobre edad, agenda, multiselección,
 * síntomas y datos documentales, y una sola igualdad de string no alcanza.
 */
export const conditionalSchema = ruleSchema.nullable().optional();
export type Conditional = z.infer<typeof conditionalSchema>;

export const questionSchema = z.object({
  /** Código estable de la especificación. Es la clave de las respuestas y de la trazabilidad. */
  code: z.string().regex(/^[A-Z]{1,3}\d{1,2}$/),
  /** Orden de presentación. SOLO display. */
  order: z.number().int().positive(),
  label: z.string().min(1).max(300),
  type: questionTypeSchema,
  required: z.boolean().default(false),
  obligacion: z.enum(['O', 'C', 'S', 'V']).default('C'),
  seccion: z.string().nullable().optional(),
  grupo: z.string().nullable().optional(),
  modulo: z.string().nullable().optional(),
  ayuda: z.string().nullable().optional(),
  alimenta: z.array(z.string()).default([]),
  repiteSobre: z.string().nullable().optional(),
  campos: z.array(z.unknown()).nullable().optional(),
  validacion: z.record(z.unknown()).nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  conditional: conditionalSchema,
});
export type QuestionDef = z.infer<typeof questionSchema>;

export const presetSchema = z.object({
  name: z.string().min(1).max(120),
  questions: z.array(questionSchema).min(1),
});
export type PresetDef = z.infer<typeof presetSchema>;

/**
 * Visibilidad de UNA pregunta. Binaria por diseño — ver el encabezado de `rules.ts`: la
 * resolución de variables de escala es un problema distinto y tiene su propio camino.
 *
 * Para el conjunto completo hay que usar `visibleCodes`, que itera al punto fijo: una pregunta
 * puede depender de otra condicional, y las respuestas de ramas cerradas no deben contar.
 */
export function isVisible(
  q: Pick<QuestionDef, 'conditional'>,
  answers: Readonly<Record<string, { value: unknown } | undefined>>,
  facts: Facts = {},
): boolean {
  const rule = q.conditional;
  if (rule == null) return true;
  return evaluateRule(rule, {
    answers: answers as RuleContext['answers'],
    facts,
  });
}
