import type { QuestionDef } from './preset';
import {
  hasValue,
  normalizeTernary,
  referencedCodes,
  visibleCodes,
  type AnswerLike,
  type Facts,
} from './rules';
import type { FormAnswers } from './form';
import { controlesFaltantes, instanciasDe } from './dictionary/instancias';

/**
 * Motor de presentación del formulario: qué se muestra, en qué pantalla y qué falta.
 *
 * Vive aquí y no en el componente de Angular a propósito. Es la lógica con riesgo clínico
 * (qué preguntas ve el paciente, qué se da por respondido) y `apps/web` no tiene tests; en
 * `packages/shared` corre con el resto de la suite. El componente queda como renderizador.
 */

/** Una pantalla del recorrido: una pregunta, o un grupo corto relacionado. */
export interface Screen {
  seccion: string;
  /** Módulo o grupo que comparten las preguntas de la pantalla, si aplica. */
  modulo: string | null;
  questions: QuestionDef[];
  /**
   * Instancias de una pregunta repetible (`AP01` por cada enfermedad marcada). Vacío en las
   * pantallas normales. La clave de respuesta es `code#slug`, no `code`.
   */
  instancias?: { key: string; label: string }[];
}

/**
 * Máximo de preguntas por pantalla. La Especificación pide "una pregunta o un grupo corto por
 * pantalla, botones grandes y lenguaje no técnico": doce ítems de Caprini en una pantalla no es
 * un grupo corto.
 */
export const MAX_POR_PANTALLA = 4;

/** Tipos que ocupan una pantalla entera: traen muchas opciones o filas propias. */
const SIEMPRE_SOLOS = ['ACORDEON_MULTIPLE', 'REPETIDOR', 'ARCHIVO'];

/**
 * Códigos de los que depende alguna otra pregunta. Van SOLOS en su pantalla: responderlos
 * abre o cierra ramas, y hacerlo a mitad de una pantalla compartida haría que aparecieran y
 * desaparecieran preguntas alrededor del dedo del paciente.
 */
function codigosCompuerta(questions: readonly QuestionDef[]): Set<string> {
  const out = new Set<string>();
  for (const q of questions) {
    if (q.conditional) for (const c of referencedCodes(q.conditional)) out.add(c);
  }
  return out;
}

/**
 * Reparte las preguntas visibles en pantallas. Agrupa las consecutivas que comparten sección y
 * módulo (los 12 ítems del DASI, las tres de STOP-Bang…), en tandas cortas.
 */
export function buildScreens(
  questions: readonly QuestionDef[],
  answers: FormAnswers,
  facts: Facts = {},
): Screen[] {
  const visibles = visibleQuestions(questions, answers, facts);
  const compuertas = codigosCompuerta(questions);
  const screens: Screen[] = [];
  let ultimaSola = false;

  for (const q of visibles) {
    const modulo = q.modulo ?? q.grupo ?? null;
    const sola = SIEMPRE_SOLOS.includes(q.type) || compuertas.has(q.code);
    const last = screens[screens.length - 1];

    // Se agrupan las consecutivas de la misma sección y módulo. Sin agrupar por sección, los
    // doce datos de identificación ocupaban doce pantallas: cumple la letra de la spec y
    // maltrata al paciente.
    const puedeAgrupar =
      !sola &&
      !ultimaSola &&
      last != null &&
      last.seccion === (q.seccion ?? 'otros') &&
      last.modulo === modulo &&
      last.questions.length < MAX_POR_PANTALLA;

    // Una pregunta repetible se expande en una pantalla propia con una instancia por enfermedad
    // marcada. La Especificación §5 pide el control "para cada enfermedad seleccionada": una
    // sola respuesta para el conjunto no distingue la hipertensión controlada de la diabetes
    // que no lo está, y esa diferencia cambia el ASA y el plan.
    if (q.repiteSobre) {
      const instancias = instanciasDe(q.code, answers);
      if (instancias.length === 0) { ultimaSola = true; continue; }
      screens.push({
        seccion: q.seccion ?? 'otros', modulo, questions: [q],
        instancias: instancias.map((i) => ({ key: i.key, label: i.label })),
      });
      ultimaSola = true;
      continue;
    }

    if (puedeAgrupar) last!.questions.push(q);
    else screens.push({ seccion: q.seccion ?? 'otros', modulo, questions: [q] });
    ultimaSola = sola;
  }
  return screens;
}

/** Preguntas visibles, en orden de presentación. */
export function visibleQuestions(
  questions: readonly QuestionDef[],
  answers: FormAnswers,
  facts: Facts = {},
): QuestionDef[] {
  const set = visibleCodes(
    questions.map((q) => ({ code: q.code, activacion: q.conditional ?? null })),
    { answers: answers as Readonly<Record<string, AnswerLike | undefined>>, facts },
  );
  return questions.filter((q) => set.has(q.code)).sort((a, b) => a.order - b.order);
}

/** Motivo por el que una fila aparece en el resumen final. */
export type MotivoResumen = 'falta' | 'no_sabe' | 'inconsistente';

export interface SummaryRow {
  code: string;
  label: string;
  seccion: string;
  motivo: MotivoResumen;
  detalle: string;
}

const EXCLUYENTES = ['ninguna de las anteriores', 'ninguno', 'ninguna'];

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Filas del resumen previo al envío.
 *
 * La Especificación es explícita: "el sistema muestra exclusivamente campos faltantes o
 * inconsistentes; nunca obliga a repetir todo el cuestionario". Así que esto NO devuelve el
 * formulario entero — sólo lo que falta, lo que quedó en "No sabe" (que no es una negación y
 * el anestesiólogo debe poder verlo) y las contradicciones detectables en el cliente.
 */
export function summaryRows(
  questions: readonly QuestionDef[],
  answers: FormAnswers,
  facts: Facts = {},
): SummaryRow[] {
  const rows: SummaryRow[] = [];

  for (const q of visibleQuestions(questions, answers, facts)) {
    const a = answers[q.code];
    const respondida = hasValue(a as AnswerLike | undefined);

    // Una repetible no se juzga por su clave base: lo que falta es el control de cada
    // enfermedad marcada, con su nombre, para que el paciente sepa cuál le falta.
    if (q.repiteSobre) {
      for (const i of controlesFaltantes(answers)) {
        rows.push({
          code: i.key, label: `${q.label} — ${i.label}`, seccion: q.seccion ?? 'otros',
          motivo: 'falta', detalle: 'Falta responder',
        });
      }
      continue;
    }

    if (q.required && !respondida) {
      rows.push({
        code: q.code, label: q.label, seccion: q.seccion ?? 'otros',
        motivo: 'falta', detalle: 'Falta responder',
      });
      continue;
    }
    if (!respondida) continue;

    if (normalizeTernary(a?.value) === 'no_sabe' || norm(a?.value) === 'no sabe') {
      rows.push({
        code: q.code, label: q.label, seccion: q.seccion ?? 'otros',
        motivo: 'no_sabe',
        detalle: 'Respondió "No sabe" — el anestesiólogo lo verificará',
      });
      continue;
    }

    // "Ninguna" marcada junto con otra opción. El servidor lo rechaza; mostrarlo aquí evita
    // que el paciente llegue al envío y reciba un error sin saber dónde.
    const v = a?.value;
    if (Array.isArray(v) && v.length > 1) {
      const excluyente = v.find((o) => EXCLUYENTES.includes(norm(o)));
      if (excluyente) {
        rows.push({
          code: q.code, label: q.label, seccion: q.seccion ?? 'otros',
          motivo: 'inconsistente',
          detalle: `Marcó "${excluyente}" junto con otras opciones`,
        });
      }
    }
  }
  return rows;
}

/** ¿Se puede enviar? Sólo bloquean los faltantes; "No sabe" es una respuesta válida. */
export function puedeEnviar(rows: readonly SummaryRow[]): boolean {
  return !rows.some((r) => r.motivo === 'falta' || r.motivo === 'inconsistente');
}

/** Progreso sobre las obligatorias visibles (0-100). */
export function progreso(
  questions: readonly QuestionDef[],
  answers: FormAnswers,
  facts: Facts = {},
): { respondidas: number; total: number; pct: number } {
  const req = visibleQuestions(questions, answers, facts).filter((q) => q.required);
  const respondidas = req.filter((q) => hasValue(answers[q.code] as AnswerLike | undefined)).length;
  const total = req.length;
  return { respondidas, total, pct: total ? Math.round((respondidas / total) * 100) : 0 };
}
