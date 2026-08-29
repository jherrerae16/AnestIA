import { z } from 'zod';

/**
 * Contrato de las escalas de riesgo perioperatorio.
 *
 * Documento de módulos del Dr. Luquetta, §1 "Matriz de activación": cada escala termina en uno
 * de cuatro estados y conserva las variables exactas que sustentan el resultado.
 */

export const SCALE_KEYS = [
  'DASI', 'STOP_BANG', 'APFEL', 'FRAIL', 'CAPRINI', 'RCRI', 'ARISCAT', 'POVOC',
] as const;
export type ScaleKey = (typeof SCALE_KEYS)[number];

/**
 * Los cuatro estados de la Especificación §17.
 *
 * - `NO_INDICADA`: el perfil o el procedimiento no cumplen criterios de activación.
 * - `PENDIENTE`: falta una variable indispensable. **No bloquea la aprobación**: bloquear
 *   presionaría al médico a inventar el dato para destrabar el PDF, que es el modo de falla que
 *   CS3 existe para prevenir, invertido.
 * - `CALCULADA`: variables completas, coherentes y validadas.
 * - `REVISION_CLINICA`: discordancia o criterio profesional necesario. Sin resolver **sí**
 *   bloquea: significa que el motor determinístico encontró una contradicción.
 */
export const ESTADOS_ESCALA = ['NO_INDICADA', 'PENDIENTE', 'CALCULADA', 'REVISION_CLINICA'] as const;
export type EstadoEscala = (typeof ESTADOS_ESCALA)[number];

/**
 * Una variable de escala, con su procedencia.
 *
 * `fuente` no es decorativa: CS9 exige que una variable sólo sea admisible si viene de la lista
 * blanca (formulario, agenda, laboratorio validado, anestesiólogo o cálculo del sistema). Un
 * valor derivado o estimado por el sistema NO puede alimentar una escala.
 */
export const variableSchema = z.object({
  /** Nombre clínico de la variable ("Ronquido", "Hemoglobina", "Sitio quirúrgico"). */
  nombre: z.string().min(1),
  /** Código o referencia de origen: `ID03`, `PX07`, `lab:hemoglobina`. */
  origen: z.string().min(1),
  /** Valor usado, ya normalizado. `null` si no se pudo resolver. */
  valor: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  fuente: z.string().min(1),
  /** Puntos que aportó al total, cuando la escala es aditiva. */
  puntos: z.number().optional(),
});
export type VariableEscala = z.infer<typeof variableSchema>;

export const scaleResultSchema = z.object({
  escala: z.enum(SCALE_KEYS),
  /** Versión del instrumento: `DASI@1`. Un puntaje sin versión no es reproducible. */
  version: z.string().min(1),
  /** Versión de la tabla de cortes usada. `null` mientras no haya categoría. */
  cortesVersion: z.string().nullable(),
  estado: z.enum(ESTADOS_ESCALA),
  /** Puntaje bruto. `null` salvo en `CALCULADA`. */
  puntaje: z.number().nullable(),
  /**
   * Categoría interpretada ("Riesgo alto"). `null` mientras los puntos de corte no estén
   * validados institucionalmente: el puntaje existe, la interpretación se retiene.
   */
  categoria: z.string().nullable(),
  variables: z.array(variableSchema),
  /** Variables indispensables que faltan, en lenguaje de humano. */
  faltantes: z.array(z.string()),
  /** Por qué quedó `NO_INDICADA` o `REVISION_CLINICA`. */
  motivo: z.string().nullable(),
});
export type ScaleResult = z.infer<typeof scaleResultSchema>;

/** Nombre legible de cada escala, para el documento y la pantalla del médico. */
export const NOMBRE_ESCALA: Record<ScaleKey, string> = {
  DASI: 'DASI — capacidad funcional',
  STOP_BANG: 'STOP-Bang — apnea del sueño',
  APFEL: 'Apfel — náuseas y vómito posoperatorios',
  FRAIL: 'FRAIL — fragilidad',
  CAPRINI: 'Caprini — riesgo tromboembólico',
  RCRI: 'RCRI — riesgo cardíaco',
  ARISCAT: 'ARISCAT — riesgo pulmonar',
  POVOC: 'POVOC — vómito posoperatorio pediátrico',
};

export const ETIQUETA_ESTADO: Record<EstadoEscala, string> = {
  NO_INDICADA: 'No indicada',
  PENDIENTE: 'Pendiente',
  CALCULADA: 'Calculada',
  REVISION_CLINICA: 'Revisión clínica',
};

/** Constructores para que cada evaluador no repita la forma del resultado. */
export function noIndicada(escala: ScaleKey, version: string, motivo: string): ScaleResult {
  return {
    escala, version, cortesVersion: null, estado: 'NO_INDICADA',
    puntaje: null, categoria: null, variables: [], faltantes: [], motivo,
  };
}

export function pendiente(
  escala: ScaleKey,
  version: string,
  variables: VariableEscala[],
  faltantes: string[],
): ScaleResult {
  return {
    escala, version, cortesVersion: null, estado: 'PENDIENTE',
    puntaje: null, categoria: null, variables, faltantes, motivo: null,
  };
}

export function revisionClinica(
  escala: ScaleKey,
  version: string,
  variables: VariableEscala[],
  motivo: string,
): ScaleResult {
  return {
    escala, version, cortesVersion: null, estado: 'REVISION_CLINICA',
    puntaje: null, categoria: null, variables, faltantes: [], motivo,
  };
}
