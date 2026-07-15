import { z } from 'zod';

export const questionTypeSchema = z.enum([
  'TEXTO_CORTO',
  'TEXTO_LARGO',
  'SELECCION_UNICA',
  'SELECCION_MULTIPLE',
  'FECHA',
  'NUMERO',
  'SI_NO',
  'ARCHIVO',
]);
export type QuestionTypeT = z.infer<typeof questionTypeSchema>;

/** Condicional simple: mostrar la pregunta sólo si otra (por order) tiene cierto valor. */
export const conditionalSchema = z
  .object({
    showIf: z.object({
      questionOrder: z.number().int().positive(),
      equals: z.string(),
    }),
  })
  .nullable()
  .optional();
export type Conditional = z.infer<typeof conditionalSchema>;

export const questionSchema = z.object({
  order: z.number().int().positive(),
  label: z.string().min(1).max(300),
  type: questionTypeSchema,
  required: z.boolean().default(false),
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
 * Motor condicional (pura). Una pregunta con `showIf` es visible sólo si la respuesta
 * de la pregunta referida (por order) es igual a `equals`. Sin condicional → siempre visible.
 * Comparación tolerante para SI_NO ('si'/'sí'/'no' normalizado).
 */
export function isVisible(
  q: Pick<QuestionDef, 'conditional'>,
  answers: Record<number, { value: unknown }>,
): boolean {
  const cond = q.conditional;
  if (!cond?.showIf) return true;
  const dep = answers[cond.showIf.questionOrder]?.value;
  return normalize(dep) === normalize(cond.showIf.equals);
}

function normalize(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos: 'sí' → 'si'
}
