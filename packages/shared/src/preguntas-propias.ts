import { z } from 'zod';
import { QUESTION_BY_CODE } from './dictionary';

/**
 * Preguntas propias del anestesiólogo.
 *
 * El diccionario de la Especificación **no es editable**: de él se generan el seed, el bloque de
 * preguntas del prompt clínico, la trazabilidad (`formulario:CF01`) y las variables de las ocho
 * escalas. Cambiar un ítem desde una pantalla desincronizaría las cuatro cosas en silencio.
 *
 * Lo que sí falta es que el médico pueda preguntar lo suyo — "¿trajo sus exámenes anteriores?",
 * "¿quién lo acompaña el día de la cirugía?". Eso vive aquí, con tres límites que lo hacen
 * seguro:
 *
 * 1. **Código propio reservado** (`PR01`…`PR99`). Ningún prefijo del diccionario es `PR`, así que
 *    una pregunta propia no puede pisar la trazabilidad de una del Dr.
 * 2. **Nunca alimenta una escala.** No tiene `alimenta` ni regla de activación: es informativa.
 *    Una escala se calcula con las variables que la Especificación nombra, no con lo que alguien
 *    añada por su cuenta (CS9).
 * 3. **Tipos acotados.** Sin repetidores, acordeones ni archivos: esos llevan semántica de la
 *    Especificación (instancias por enfermedad, "Ninguna" excluyente, adjuntos del caso).
 */

/** Prefijo reservado. Se comprueba contra el diccionario real en `validarPropias`. */
export const PREFIJO_PROPIA = 'PR';

/** Orden a partir del cual van las preguntas propias: siempre después del diccionario. */
export const ORDEN_BASE_PROPIA = 900;

/** Los tipos que puede elegir el médico. */
export const TIPOS_PROPIA = [
  'SI_NO',
  'SI_NO_NOSABE',
  'SELECCION_UNICA',
  'SELECCION_MULTIPLE',
  'TEXTO_CORTO',
  'TEXTO_LARGO',
  'NUMERO',
  'FECHA',
] as const;
export type TipoPropia = (typeof TIPOS_PROPIA)[number];

export const ETIQUETA_TIPO_PROPIA: Record<TipoPropia, string> = {
  SI_NO: 'Sí / No',
  SI_NO_NOSABE: 'Sí / No / No sabe',
  SELECCION_UNICA: 'Una opción',
  SELECCION_MULTIPLE: 'Varias opciones',
  TEXTO_CORTO: 'Texto corto',
  TEXTO_LARGO: 'Texto largo',
  NUMERO: 'Número',
  FECHA: 'Fecha',
};

export const preguntaPropiaSchema = z
  .object({
    code: z.string().regex(/^PR\d{1,2}$/, 'El código de una pregunta propia es PR seguido de un número.'),
    label: z.string().trim().min(3, 'La pregunta necesita un enunciado.').max(300),
    type: z.enum(TIPOS_PROPIA),
    /** Texto de apoyo bajo la pregunta, en lenguaje de paciente. */
    ayuda: z.string().trim().max(300).nullable().optional(),
    required: z.boolean().default(false),
    /** Opciones, sólo para los dos tipos de selección. */
    options: z.array(z.string().trim().min(1)).max(30).nullable().optional(),
  })
  .superRefine((q, ctx) => {
    const necesitaOpciones = q.type === 'SELECCION_UNICA' || q.type === 'SELECCION_MULTIPLE';
    const tiene = (q.options ?? []).length > 0;
    if (necesitaOpciones && !tiene) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Una pregunta de selección necesita al menos una opción.' });
    }
    if (!necesitaOpciones && tiene) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Este tipo de pregunta no lleva opciones.' });
    }
    if (tiene && new Set(q.options!.map((o) => o.toLowerCase())).size !== q.options!.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Hay opciones repetidas.' });
    }
  });
export type PreguntaPropia = z.infer<typeof preguntaPropiaSchema>;

export const preguntasPropiasSchema = z.array(preguntaPropiaSchema).max(30);

/**
 * Valida el conjunto. Devuelve los errores en lenguaje del médico, no del validador.
 *
 * Comprueba lo que un esquema por ítem no puede ver: códigos repetidos entre sí y colisión con
 * el diccionario real — la garantía de que `PR` está libre se verifica aquí, no se asume.
 */
export function validarPropias(propias: readonly PreguntaPropia[]): string[] {
  const errores: string[] = [];
  const vistos = new Set<string>();

  for (const q of propias) {
    if (vistos.has(q.code)) errores.push(`El código ${q.code} está repetido.`);
    vistos.add(q.code);
    if (QUESTION_BY_CODE.has(q.code)) {
      errores.push(`${q.code} ya es una pregunta de la Especificación y no se puede reutilizar.`);
    }
  }
  return errores;
}

/** Siguiente código libre. Los códigos no se reciclan: un `PR03` borrado no vuelve a usarse. */
export function siguienteCodigoPropio(existentes: readonly { code: string }[]): string {
  const usados = new Set(existentes.map((q) => q.code));
  for (let i = 1; i <= 99; i++) {
    const code = `${PREFIJO_PROPIA}${String(i).padStart(2, '0')}`;
    if (!usados.has(code)) return code;
  }
  throw new Error('No quedan códigos libres para preguntas propias (máximo 99).');
}

/** Una pregunta propia → la forma que consume el formulario del paciente. */
export function propiaAQuestionDef(q: PreguntaPropia, indice: number) {
  return {
    code: q.code,
    order: ORDEN_BASE_PROPIA + indice,
    label: q.label,
    type: q.type,
    required: q.required ?? false,
    // Condicional: una propia obligatoria bloquearía el envío por algo que no está en la
    // Especificación. `required` sigue marcándola con asterisco en la pantalla.
    obligacion: 'C' as const,
    seccion: null,
    grupo: null,
    modulo: null,
    ayuda: q.ayuda ?? null,
    // Nunca alimenta una escala, y nunca lleva regla de activación: se le muestra a todos.
    alimenta: [] as string[],
    repiteSobre: null,
    campos: null,
    validacion: null,
    options: q.options ?? null,
    conditional: null,
  };
}
