import { z } from 'zod';

/**
 * Motor de reglas del formulario descendente (Especificación de Datos Mínimos, §2 "Flujo que
 * recorrerá el paciente" y Flujograma §2-§3).
 *
 * Reemplaza el condicional de un solo `showIf` por un árbol declarativo: la composición vive en
 * DATOS (versionable, validable por Zod, enviable a Angular tal cual) y los HECHOS derivados —
 * edad, banda etaria, ruta, IMC, atributos de agenda — se calculan en CÓDIGO (`buildFacts`).
 * JSON puro no puede hacer aritmética de fechas; predicados en código no se pueden versionar.
 *
 * ── Dos problemas, dos caminos de código ────────────────────────────────────────────────
 * VISIBILIDAD (aquí) es binaria: si la dependencia no está respondida, el hijo todavía no se
 * muestra. RESOLUCIÓN DE VARIABLES DE ESCALA (`scales/resolve.ts`, Fase 3) es ternaria: sin
 * responder o "No sabe" es `desconocido` y deja la escala en `PENDIENTE`.
 *
 * Mezclarlos es exactamente cómo "No sabe" termina convertido en "No", que los tres documentos
 * del Dr. prohíben de forma explícita. `evaluateRule` NO se reutiliza para escalas.
 *
 * La protección estructural contra `No sabe → No` vive en la validación del diccionario
 * (`assertDictionaryValid`): se prohíbe `notEquals` sobre preguntas `SI_NO_NOSABE`, obligando a
 * escribir `{ op: 'in', value: ['no', 'no_sabe'] }` de forma explícita y consciente.
 */

/** Respuesta de tres estados. `no_sabe` NUNCA equivale a `no` (regla repetida en los 3 PDFs). */
export const TERNARIO = ['si', 'no', 'no_sabe'] as const;
export type Ternario = (typeof TERNARIO)[number];

/**
 * Normaliza para comparar: minúsculas, sin acentos, sin espacios extremos.
 * 'Sí' → 'si', 'No sabe' → 'no sabe'. Mismo criterio que usaba `preset.normalize`.
 */
export function normalizeValue(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Interpreta un valor como ternario. Devuelve null si no es una respuesta de tres estados
 * (p. ej. un texto libre o un número). Un campo vacío es `null`, NO `no`.
 */
export function normalizeTernary(v: unknown): Ternario | null {
  const s = normalizeValue(v);
  if (!s) return null;
  if (s === 'si' || s === 'true') return 'si';
  if (s === 'no' || s === 'false') return 'no';
  if (s === 'no sabe' || s === 'no_sabe' || s === 'nosabe') return 'no_sabe';
  return null;
}

// ── Hechos derivados ──────────────────────────────────────────────────────────────────────

/**
 * Bandas etarias de la Especificación §1 ("Edad derivada"). El paciente NUNCA selecciona su
 * grupo: se calcula desde la fecha de nacimiento contra la fecha del procedimiento.
 */
export const BANDA_ETARIA = [
  'NEONATO', // 0–28 días
  'LACTANTE', // 29 días – 2 años
  'NINO', // 3 – 12 años
  'ADOLESCENTE', // 13 – 17 años
  'ADULTO', // 18 – 49 años
  'ADULTO_50', // 50 – 64 años — aporta a STOP-Bang
  'ADULTO_65', // 65 – 74 años — activa FRAIL
  'ADULTO_75', // ≥ 75 años — FRAIL + edad para Caprini
] as const;
export type BandaEtaria = (typeof BANDA_ETARIA)[number];

/** Rutas del Flujograma §1 ("Derivación demográfica"). */
export const RUTA_CLINICA = [
  'PEDIATRICA',
  'ADULTO',
  'ADULTO_MAYOR',
  'OBSTETRICA_GINECOLOGICA',
] as const;
export type RutaClinica = (typeof RUTA_CLINICA)[number];

/**
 * Claves de hecho que una regla puede consultar. Los `px.*` provienen de la agenda quirúrgica
 * (Fase 2); antes de que exista `CaseSchedule` resuelven a `null` y toda regla que dependa de
 * ellos es falsa — que es el comportamiento correcto: sin agenda no se abre una rama que
 * depende del procedimiento.
 */
export const FACT_KEYS = [
  'edad_anios',
  'edad_meses',
  'banda_etaria',
  'ruta',
  'sexo_nacimiento',
  'imc',
  'responde_acudiente',
  'px.disponible',
  'px.especialidad',
  'px.modalidad',
  'px.prioridad',
  'px.sitio_quirurgico',
  'px.duracion_estimada',
  'px.alto_riesgo_rcri',
  'px.opioides_postop',
  'px.anestesia_probable',
  'doc.tiene_labs',
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

export type FactValue = string | number | boolean | null;
export type Facts = Partial<Record<FactKey, FactValue>>;

// ── Esquema de reglas ─────────────────────────────────────────────────────────────────────

export const answerOpSchema = z.enum([
  'equals',
  'notEquals',
  'in',
  'notIn',
  'includes', // multiselección contiene la opción
  'notIncludes',
  'answered', // tiene cualquier valor no vacío
  'unanswered',
  'gt',
  'gte',
  'lt',
  'lte',
]);
export type AnswerOp = z.infer<typeof answerOpSchema>;

export const factOpSchema = z.enum([
  'equals',
  'notEquals',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte',
  'isNull',
  'notNull',
]);
export type FactOp = z.infer<typeof factOpSchema>;

const ruleValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

export type Rule =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'answer'; code: string; op: AnswerOp; value?: string | number | boolean | string[] }
  | { kind: 'fact'; fact: FactKey; op: FactOp; value?: string | number | boolean | string[] }
  | { kind: 'all'; rules: Rule[] }
  | { kind: 'any'; rules: Rule[] }
  | { kind: 'not'; rule: Rule };

export const ruleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('never') }),
    z.object({
      kind: z.literal('answer'),
      code: z.string().min(1),
      op: answerOpSchema,
      value: ruleValueSchema.optional(),
    }),
    z.object({
      kind: z.literal('fact'),
      fact: z.enum(FACT_KEYS),
      op: factOpSchema,
      value: ruleValueSchema.optional(),
    }),
    z.object({ kind: z.literal('all'), rules: z.array(ruleSchema).min(1) }),
    z.object({ kind: z.literal('any'), rules: z.array(ruleSchema).min(1) }),
    z.object({ kind: z.literal('not'), rule: ruleSchema }),
  ]),
) as z.ZodType<Rule>;

/** Regla siempre visible — azúcar para el diccionario. */
export const SIEMPRE: Rule = { kind: 'always' };

// ── Evaluación ────────────────────────────────────────────────────────────────────────────

/** Lo mínimo que el motor necesita de una respuesta. */
export interface AnswerLike {
  value: string | number | boolean | string[] | null;
}

export interface RuleContext {
  /** Respuestas indexadas por código (`ID01`, `AP01#hipertension_arterial`). */
  answers: Readonly<Record<string, AnswerLike | undefined>>;
  facts: Facts;
}

/** ¿La respuesta tiene contenido? Un arreglo vacío o un string vacío NO cuentan. */
export function hasValue(a: AnswerLike | undefined): boolean {
  if (a == null || a.value == null) return false;
  if (Array.isArray(a.value)) return a.value.length > 0;
  if (typeof a.value === 'string') return a.value.trim() !== '';
  return true;
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(normalizeValue);
  return [normalizeValue(v)];
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = Number(String(v ?? '').replace(',', '.'));
  return isFinite(n) ? n : null;
}

function compareNumeric(op: 'gt' | 'gte' | 'lt' | 'lte', left: unknown, right: unknown): boolean {
  const a = asNumber(left);
  const b = asNumber(right);
  if (a == null || b == null) return false;
  return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
}

function evalAnswer(rule: Extract<Rule, { kind: 'answer' }>, ctx: RuleContext): boolean {
  const a = ctx.answers[rule.code];
  const present = hasValue(a);
  if (rule.op === 'answered') return present;
  if (rule.op === 'unanswered') return !present;
  // Sin respuesta, ninguna comparación de contenido es verdadera. En particular `notEquals` NO
  // se cumple por ausencia: un blanco no afirma nada (CS2 — un blanco nunca produce negación).
  if (!present) return false;

  const actual = a!.value;
  switch (rule.op) {
    case 'equals':
      return asList(actual).length === 1 && normalizeValue(actual) === normalizeValue(rule.value);
    case 'notEquals':
      return normalizeValue(actual) !== normalizeValue(rule.value);
    case 'in':
      return asList(rule.value).includes(normalizeValue(actual));
    case 'notIn':
      return !asList(rule.value).includes(normalizeValue(actual));
    case 'includes': {
      const have = asList(actual);
      return asList(rule.value).some((want) => have.includes(want));
    }
    case 'notIncludes': {
      const have = asList(actual);
      return !asList(rule.value).some((want) => have.includes(want));
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareNumeric(rule.op, actual, rule.value);
    default:
      return false;
  }
}

function evalFact(rule: Extract<Rule, { kind: 'fact' }>, ctx: RuleContext): boolean {
  const actual = ctx.facts[rule.fact] ?? null;
  if (rule.op === 'isNull') return actual == null;
  if (rule.op === 'notNull') return actual != null;
  // Un hecho desconocido no satisface ninguna comparación — tampoco `notEquals`. Sin agenda no
  // se abre una rama que depende del procedimiento.
  if (actual == null) return false;

  switch (rule.op) {
    case 'equals':
      return normalizeValue(actual) === normalizeValue(rule.value);
    case 'notEquals':
      return normalizeValue(actual) !== normalizeValue(rule.value);
    case 'in':
      return asList(rule.value).includes(normalizeValue(actual));
    case 'notIn':
      return !asList(rule.value).includes(normalizeValue(actual));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareNumeric(rule.op, actual, rule.value);
    default:
      return false;
  }
}

/** Evalúa una regla de VISIBILIDAD. Binaria por diseño — ver el encabezado del archivo. */
export function evaluateRule(rule: Rule, ctx: RuleContext): boolean {
  switch (rule.kind) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'answer':
      return evalAnswer(rule, ctx);
    case 'fact':
      return evalFact(rule, ctx);
    case 'all':
      return rule.rules.every((r) => evaluateRule(r, ctx));
    case 'any':
      return rule.rules.some((r) => evaluateRule(r, ctx));
    case 'not':
      return !evaluateRule(rule.rule, ctx);
  }
}

// ── Conjunto visible y limpieza de respuestas ocultas ─────────────────────────────────────

/** Separador de instancia para repetidores: `AP01#hipertension_arterial`, `GL03#1`. */
export const INSTANCE_SEP = '#';

/** Código base de una clave de respuesta. `AP01#hipertension` → `AP01`; `ID01` → `ID01`. */
export function baseCode(key: string): string {
  const i = key.indexOf(INSTANCE_SEP);
  return i === -1 ? key : key.slice(0, i);
}

/** Lo mínimo que el motor necesita de una pregunta para decidir visibilidad. */
export interface VisibilityNode {
  code: string;
  /** Regla de activación. Ausente o `always` → siempre visible. */
  activacion?: Rule | null;
}

/**
 * Conjunto de códigos visibles, al punto fijo. Una pregunta puede depender de otra condicional,
 * así que se itera: se parte de las incondicionales y se agrega, en cada vuelta, toda pregunta
 * cuya regla se cumple usando ÚNICAMENTE las respuestas de preguntas ya visibles.
 *
 * Restringir el contexto a lo visible es lo que impide que una respuesta huérfana —de una rama
 * que el paciente abrió y luego cerró— mantenga vivo a un nieto. El conjunto crece de forma
 * monótona y está acotado por el tamaño del diccionario, así que termina siempre.
 */
export function visibleCodes(nodes: readonly VisibilityNode[], ctx: RuleContext): Set<string> {
  const visible = new Set<string>();
  const pending = nodes.slice();

  // Contexto restringido: solo respuestas cuyo código base ya es visible.
  const restricted = (): RuleContext => {
    const answers: Record<string, AnswerLike | undefined> = {};
    for (const [key, a] of Object.entries(ctx.answers)) {
      if (visible.has(baseCode(key))) answers[key] = a;
    }
    return { answers, facts: ctx.facts };
  };

  let grew = true;
  while (grew) {
    grew = false;
    const scope = restricted();
    for (let i = pending.length - 1; i >= 0; i--) {
      const n = pending[i]!;
      const rule = n.activacion ?? SIEMPRE;
      if (evaluateRule(rule, scope)) {
        visible.add(n.code);
        pending.splice(i, 1);
        grew = true;
      }
    }
  }
  return visible;
}

/**
 * Borra las respuestas de preguntas que ya no están visibles. Idempotente: `visibleCodes` ignora
 * por construcción las respuestas ocultas, así que una segunda pasada no encuentra nada más.
 *
 * Sin esto, responder "Sí" → escribir el detalle → cambiar a "No" deja el detalle guardado y se
 * envía igual, que es lo que hoy dispara las contradicciones del auditor sobre datos fantasma.
 */
export function pruneHiddenAnswers<T extends AnswerLike>(
  nodes: readonly VisibilityNode[],
  answers: Readonly<Record<string, T | undefined>>,
  facts: Facts,
): Record<string, T> {
  const visible = visibleCodes(nodes, { answers, facts });
  const out: Record<string, T> = {};
  for (const [key, a] of Object.entries(answers)) {
    if (a !== undefined && visible.has(baseCode(key))) out[key] = a;
  }
  return out;
}

/** Códigos de pregunta que una regla consulta. Para validar el grafo y derivar contradicciones. */
export function referencedCodes(rule: Rule, out: Set<string> = new Set()): Set<string> {
  switch (rule.kind) {
    case 'answer':
      out.add(rule.code);
      break;
    case 'all':
    case 'any':
      rule.rules.forEach((r) => referencedCodes(r, out));
      break;
    case 'not':
      referencedCodes(rule.rule, out);
      break;
  }
  return out;
}
