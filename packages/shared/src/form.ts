import { z } from 'zod';
import { questionTypeSchema, type QuestionDef, type QuestionTypeT } from './preset';
import { normalizeTernary, TERNARIO, visibleCodes, type Facts } from './rules';

/** Una respuesta: valor + el tipo declarado (para trazabilidad/validación). */
export const answerSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
  type: questionTypeSchema,
});
export type Answer = z.infer<typeof answerSchema>;

/**
 * Respuestas del paciente: mapa CÓDIGO → answer. Guardado en `FormResponse.answers`.
 *
 * La clave es el código de la especificación (`ID01`, `CF01`, `SB03`), no la posición. Antes
 * era el `order`, y eso hacía que insertar una pregunta reasignara en silencio el significado
 * de todas las siguientes — con la trazabilidad (`formulario:P18` para alergias que en realidad
 * eran P16) rota sin que nada fallara.
 *
 * Admite sufijo de instancia para repetidores: `AP01#hipertension_arterial`, `GL03#1`.
 */
export const answerKeySchema = z.string().regex(/^[A-Z]{1,3}\d{1,2}(#[a-z0-9_-]{1,48})?$/);
export const formAnswersSchema = z.record(answerKeySchema, answerSchema);
export type FormAnswers = z.infer<typeof formAnswersSchema>;

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

/** Aplica `validacion` (min, max, patrón) de una pregunta. */
function validarReglas(q: QuestionDef, value: unknown): string[] {
  const v = q.validacion;
  if (v == null) return [];
  const out: string[] = [];
  const texto = Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();

  const min = typeof v['min'] === 'number' ? v['min'] : null;
  const max = typeof v['max'] === 'number' ? v['max'] : null;
  if (min != null || max != null) {
    const n = Number(texto.replace(',', '.'));
    const unidad = typeof v['unidad'] === 'string' ? ` ${v['unidad']}` : '';
    if (!isFinite(n)) {
      out.push(`La pregunta ${q.code} espera un número.`);
    } else if ((min != null && n < min) || (max != null && n > max)) {
      out.push(
        `La pregunta ${q.code} está fuera del rango esperado ` +
          `(${min ?? '—'}–${max ?? '—'}${unidad}): recibió ${texto}.`,
      );
    }
  }

  const patron = typeof v['patron'] === 'string' ? v['patron'] : null;
  if (patron && texto && !new RegExp(patron).test(texto)) {
    out.push(`La pregunta ${q.code} tiene un formato inválido: "${texto}".`);
  }
  return out;
}

/** Tipos cuya respuesta debe pertenecer al conjunto declarado. */
const TIPOS_CERRADOS: readonly QuestionTypeT[] = [
  'SELECCION_UNICA',
  'SELECCION_MULTIPLE',
  'ACORDEON_MULTIPLE',
  'SI_NO_NOSABE',
  'SI_NO',
];

/** Opción excluyente de los acordeones: marcarla desmarca todo lo demás. */
const OPCIONES_EXCLUYENTES = ['ninguna de las anteriores', 'ninguno', 'ninguna', 'no'];

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Valida las respuestas contra el cuestionario:
 * - respeta el árbol de reglas (una pregunta oculta no es obligatoria)
 * - las obligatorias visibles deben tener valor
 * - las opciones marcadas deben pertenecer al conjunto declarado
 * - "Ninguna" es excluyente
 * - un dato de sistema nunca puede venir del formulario del paciente
 *
 * Las tres últimas no existían: `validateAnswers` sólo comprobaba presencia. La exclusividad
 * en particular DEBE validarse en el servidor — una carga con `["Ninguna","Hipertensión"]`
 * calcularía una escala sobre una contradicción.
 *
 * Pura → testeable.
 */
export function validateAnswers(
  questions: QuestionDef[],
  answers: FormAnswers,
  facts: Facts = {},
): string[] {
  const errors: string[] = [];
  const visibles = visibleCodes(
    questions.map((q) => ({ code: q.code, activacion: q.conditional ?? null })),
    { answers, facts },
  );

  for (const q of questions) {
    // Un dato de agenda o del anestesiólogo jamás se acepta desde el formulario público.
    if (q.obligacion === 'S' && answers[q.code] != null) {
      errors.push(`${q.code} es un dato de agenda y no puede enviarse desde el formulario.`);
      continue;
    }
    if (!visibles.has(q.code)) continue;

    const a = answers[q.code];
    const empty =
      a == null ||
      a.value == null ||
      a.value === '' ||
      (Array.isArray(a.value) && a.value.length === 0);

    if (q.required && empty) {
      errors.push(`La pregunta ${q.code} ("${q.label}") es obligatoria.`);
      continue;
    }
    // Sin respuesta no hay nada que validar. Una pregunta opcional en blanco es válida.
    if (empty || a == null) continue;

    // Reglas declaradas en el diccionario: rango numérico y patrón de texto. Se persistían en
    // `Question.validacion` pero no las aplicaba nadie, así que un peso de 900 kg o un documento
    // con letras pasaban al documento clínico sin que nada chistara.
    errors.push(...validarReglas(q, a.value));

    // La pertenencia sólo aplica a tipos con conjunto CERRADO de respuestas. Un texto libre o
    // un número pueden traer `options` como metadato (p. ej. los tipos de documento de ID02) y
    // eso no convierte la respuesta en una opción a validar.
    if (!TIPOS_CERRADOS.includes(q.type) || q.options == null || q.options.length === 0) {
      continue;
    }

    const marcadas = Array.isArray(a.value) ? a.value : [String(a.value)];

    // Las preguntas de tres estados guardan el valor CANÓNICO (`si` | `no` | `no_sabe`), no la
    // etiqueta. Así, si la especificación reescribe "No sabe" como "No lo sé", los datos ya
    // guardados siguen significando lo mismo. Se validan contra el conjunto canónico.
    if (q.type === 'SI_NO_NOSABE' || q.type === 'SI_NO') {
      const validos: readonly string[] = q.type === 'SI_NO_NOSABE' ? TERNARIO : ['si', 'no'];
      for (const m of marcadas) {
        if (normalizeTernary(m) == null || !validos.includes(normalizeTernary(m)!)) {
          errors.push(`La pregunta ${q.code} recibió un valor no permitido: "${m}".`);
        }
      }
      continue;
    }

    const permitidas = new Set(q.options.map(norm));

    for (const m of marcadas) {
      // "Otra: <texto libre>" es una respuesta legítima con detalle del paciente.
      if (norm(m).startsWith('otra') || norm(m).startsWith('otro')) continue;
      if (!permitidas.has(norm(m))) {
        errors.push(`La pregunta ${q.code} recibió una opción no permitida: "${m}".`);
      }
    }

    if (marcadas.length > 1) {
      const excluyente = marcadas.find((m) => OPCIONES_EXCLUYENTES.includes(norm(m)));
      if (excluyente) {
        errors.push(
          `La pregunta ${q.code} marca "${excluyente}" junto con otras opciones. ` +
            `"Ninguna" es excluyente.`,
        );
      }
    }
  }
  return errors;
}
