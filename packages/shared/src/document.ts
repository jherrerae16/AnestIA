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
 * documentSchema — SKELETON en U0. Se completa por secciones en U3 (Motor clínico),
 * fiel al Diseño Oficial (identificacion, antecedentes, paraclinicos, examen_fisico, valoracion_plan).
 * Aquí sólo se fija la forma anidada por-sección con campos DocField para poder compartir el tipo.
 */
export const documentSchema = z.object({
  identificacion: z.record(docFieldSchema).default({}),
  antecedentes: z.record(docFieldSchema).default({}),
  paraclinicos: z.record(docFieldSchema).default({}),
  examen_fisico: z.record(docFieldSchema).default({}),
  valoracion_plan: z.record(docFieldSchema).default({}),
});
export type DocumentJSON = z.infer<typeof documentSchema>;
