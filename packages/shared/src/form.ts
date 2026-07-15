import { z } from 'zod';
import { questionTypeSchema, isVisible, type QuestionDef } from './preset';

/** Una respuesta: valor + el tipo declarado (para trazabilidad/validación). */
export const answerSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
  type: questionTypeSchema,
});
export type Answer = z.infer<typeof answerSchema>;

/** Respuestas del paciente: mapa questionOrder → answer. Guardado en FormResponse.answers. */
export const formAnswersSchema = z.record(
  z.string().regex(/^\d+$/), // clave = order como string (JSON)
  answerSchema,
);
export type FormAnswers = z.infer<typeof formAnswersSchema>;

export const createCaseSchema = z.object({
  presetId: z.string().min(1),
  procedure: z.string().max(300).optional(),
});

export const uploadMetaSchema = z.object({
  type: z.enum(['HEMOGRAMA', 'COAGULACION', 'ECG', 'ECOCARDIOGRAMA', 'OTRO']).default('OTRO'),
});

export const MAX_FILES_PER_CASE = 10;
export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

/**
 * Valida un conjunto de respuestas contra las preguntas del preset:
 * - respeta condicionales (una pregunta oculta no es obligatoria)
 * - obligatorias visibles deben tener valor
 * Devuelve lista de errores (vacía = válido). Pura → testeable.
 */
export function validateAnswers(
  questions: QuestionDef[],
  answers: Record<number, Answer>,
): string[] {
  const errors: string[] = [];
  for (const q of questions) {
    const visible = isVisible(q, answers);
    if (!visible) continue;
    const a = answers[q.order];
    const empty =
      a == null ||
      a.value == null ||
      a.value === '' ||
      (Array.isArray(a.value) && a.value.length === 0);
    if (q.required && empty) {
      errors.push(`La pregunta ${q.order} ("${q.label}") es obligatoria.`);
    }
  }
  return errors;
}
