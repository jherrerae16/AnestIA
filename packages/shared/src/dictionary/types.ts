import { z } from 'zod';
import { questionTypeSchema, type QuestionTypeT } from '../preset';
import { ruleSchema, type Rule } from '../rules';

/**
 * Tipos del diccionario de preguntas (Especificación de Datos Mínimos, leyenda de la página 1
 * y "Cómo interpretar las fuentes" del documento de módulos).
 *
 * Este diccionario es la FUENTE ÚNICA DE VERDAD del formulario. De él se generan las filas de
 * `Question`, el bloque de preguntas que se inyecta al prompt clínico, las secciones de la UI y
 * la tabla de `docs/form-mapping.md`. Antes esos cuatro se mantenían a mano y se desincronizaban:
 * el propio comentario de `anthropic.ts` explica el síntoma —"sin esto cita fuentes equivocadas
 * (`formulario:P18` para alergias, que en realidad es P16)"— y ya había drift real entre las dos
 * copias de `ID_FIELDS`.
 */

/** Obligatoriedad. Leyenda de la Especificación, página 1. */
export const obligacionSchema = z.enum([
  'O', // Obligatorio para continuar.
  'C', // Condicional: aparece solo si se activa.
  'S', // Dato del sistema, agenda o documento; NO se pregunta al paciente.
  'V', // Debe ser verificado por el anestesiólogo.
]);
export type Obligacion = z.infer<typeof obligacionSchema>;

/** Quién aporta el dato. "Cómo interpretar las fuentes", documento de módulos, página 1. */
export const fuenteDatoSchema = z.enum([
  'P', // Paciente o acudiente.
  'S', // Sistema o agenda: precargado o derivado; no se vuelve a preguntar.
  'D', // Documento: laboratorio o informe extraído y validado.
  'C', // Clínico: medición o juicio profesional presencial.
]);
export type FuenteDato = z.infer<typeof fuenteDatoSchema>;

/** Escalas que un ítem puede alimentar. */
export const ESCALAS = [
  'DASI',
  'STOP_BANG',
  'APFEL',
  'FRAIL',
  'CAPRINI',
  'RCRI',
  'ARISCAT',
  'POVOC',
] as const;
export type EscalaKey = (typeof ESCALAS)[number];

/** Secciones del formulario, en el orden en que las recorre el paciente (Flujograma §1). */
export const SECCIONES = [
  'identificacion',
  'gineco_obstetrico',
  'procedimiento',
  'antecedentes',
  'medicamentos',
  'alergias_anestesia',
  'habitos',
  'capacidad_funcional',
  'sueno_nauseas',
  'fragilidad',
  'tromboembolico',
  'pediatrico',
  'documentos',
] as const;
export type SeccionKey = (typeof SECCIONES)[number];

/** Campo de un `REPETIDOR` (p. ej. cada medicamento de `RX02`). */
export interface CampoRepetidor {
  key: string;
  label: string;
  type: QuestionTypeT;
  opciones?: readonly string[];
  requerido?: boolean;
}

export interface DictQuestion {
  /** Código estable de la spec. Es la unidad de trazabilidad: el motor cita `formulario:CF01`. */
  code: string;
  /** Orden de presentación. SOLO display — ya no es trazabilidad. */
  order: number;
  /** Texto exacto que define la spec. */
  label: string;
  type: QuestionTypeT;
  obligacion: Obligacion;
  fuente: FuenteDato;
  seccion: SeccionKey;
  /** Grupo de acordeón (`GRUPOS_PATOLOGIAS[].key`) cuando aplica. */
  grupo?: string;
  /** Módulo condicional al que pertenece: `glp1`, `anticoagulantes`, `stop_bang`… */
  modulo?: string;
  opciones?: readonly string[];
  /** Regla de activación. Ausente → siempre visible dentro de su ruta. */
  activacion?: Rule;
  /** Escalas que consumen este ítem. Documental y verificable por test. */
  alimenta?: readonly EscalaKey[];
  /** Texto de apoyo en lenguaje no técnico, bajo la etiqueta. */
  ayuda?: string;
  /** Código cuya multiselección genera las instancias (`AP01` repite sobre `AP00`). */
  repiteSobre?: string;
  /** Campos estructurados de un `REPETIDOR`. */
  campos?: readonly CampoRepetidor[];
  validacion?: { min?: number; max?: number; unidad?: string; patron?: string };
}

export const campoRepetidorSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: questionTypeSchema,
  opciones: z.array(z.string()).optional(),
  requerido: z.boolean().optional(),
});

/** Formato de código: 1-3 letras + 1-2 dígitos (`ID01`, `D7`, `SB03`, `PX11`). */
export const questionCodeSchema = z.string().regex(/^[A-Z]{1,3}\d{1,2}$/);

export const dictQuestionSchema: z.ZodType<DictQuestion> = z.object({
  code: questionCodeSchema,
  order: z.number().int().positive(),
  label: z.string().min(1).max(300),
  type: questionTypeSchema,
  obligacion: obligacionSchema,
  fuente: fuenteDatoSchema,
  seccion: z.enum(SECCIONES),
  grupo: z.string().optional(),
  modulo: z.string().optional(),
  opciones: z.array(z.string()).optional(),
  activacion: ruleSchema.optional(),
  alimenta: z.array(z.enum(ESCALAS)).optional(),
  ayuda: z.string().optional(),
  repiteSobre: questionCodeSchema.optional(),
  campos: z.array(campoRepetidorSchema).optional(),
  validacion: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      unidad: z.string().optional(),
      patron: z.string().optional(),
    })
    .optional(),
}) as z.ZodType<DictQuestion>;
