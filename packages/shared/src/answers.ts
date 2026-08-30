import { INSTANCE_SEP, baseCode, normalizeTernary, normalizeValue, type Ternario } from './rules';
import type { Answer, FormAnswers } from './form';

/**
 * Acceso a las respuestas del paciente.
 *
 * **Este es el ÚNICO módulo con permiso de indexar `answers` directamente.** El resto del
 * sistema pasa por estos accesores. La razón es la trazabilidad: antes las respuestas se leían
 * por posición (`answers['15']`) desde seis archivos distintos, así que insertar una pregunta
 * reasignaba silenciosamente el significado de todas las siguientes. Ahora la clave es el
 * código de la especificación (`RX02`) y el acceso está centralizado.
 *
 * Un test verifica que nadie más escriba `answers['…']` fuera de aquí.
 */

/** Texto plano de una respuesta. Multiselección → lista separada por comas. '' si no hay. */
export function getText(answers: FormAnswers, code: string): string {
  const v = answers[code]?.value;
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v).trim();
}

/** Número de una respuesta, tolerando coma decimal. null si no es un número válido. */
export function getNumber(answers: FormAnswers, code: string): number | null {
  const s = getText(answers, code).replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Opciones marcadas de una multiselección. Siempre un arreglo (vacío si no hay respuesta). */
export function getMulti(answers: FormAnswers, code: string): string[] {
  const v = answers[code]?.value;
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter((x) => x.trim() !== '');
  const s = String(v).trim();
  return s ? [s] : [];
}

/**
 * Estado de una respuesta de tres estados. `null` = sin responder.
 *
 * Nunca colapsa: un campo vacío devuelve `null`, NO `'no'`. Quien consuma esto debe decidir
 * explícitamente qué hacer con `null` y con `'no_sabe'` — son cosas distintas y la
 * especificación prohíbe tratarlas como negación.
 */
export function getTernary(answers: FormAnswers, code: string): Ternario | null {
  return normalizeTernary(answers[code]?.value);
}

/** ¿Respondió "Sí" de forma explícita? */
export function isYes(answers: FormAnswers, code: string): boolean {
  return getTernary(answers, code) === 'si';
}

/**
 * ¿Respondió "No" de forma explícita?
 *
 * "No sabe" y un blanco devuelven `false`. Es la implementación de CS2: sólo se escribe
 * "Niega X" cuando el paciente lo negó — un blanco nunca produce una negación.
 */
export function isNo(answers: FormAnswers, code: string): boolean {
  return getTernary(answers, code) === 'no';
}

/** ¿Respondió "No sabe"? Estado propio: ni afirmación ni negación. */
export function isUnknown(answers: FormAnswers, code: string): boolean {
  return getTernary(answers, code) === 'no_sabe';
}

/** ¿Tiene contenido? Un arreglo vacío o un string en blanco no cuentan. */
export function isAnswered(answers: FormAnswers, code: string): boolean {
  const v = answers[code]?.value;
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

/**
 * Instancias de un repetidor: `AP01#hipertension_arterial` → `{ hipertension_arterial: … }`.
 * Sirve tanto para los repetidores por opción marcada como para los indexados (`GL03#1`).
 */
export function getInstances(answers: FormAnswers, code: string): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  const prefix = code + INSTANCE_SEP;
  for (const [key, a] of Object.entries(answers)) {
    if (a !== undefined && key.startsWith(prefix)) out[key.slice(prefix.length)] = a;
  }
  return out;
}

/** Todas las claves presentes cuyo código base es `code` (con y sin instancia). */
export function keysFor(answers: FormAnswers, code: string): string[] {
  return Object.keys(answers).filter((k) => baseCode(k) === code);
}

/** ¿La multiselección incluye alguna de estas opciones? Compara sin acentos ni mayúsculas. */
export function includesOption(
  answers: FormAnswers,
  code: string,
  options: string | string[],
): boolean {
  const want = (Array.isArray(options) ? options : [options]).map(normalizeValue);
  const have = getMulti(answers, code).map(normalizeValue);
  return want.some((w) => have.includes(w));
}

/**
 * Filas de un `REPETIDOR` (medicamentos de `RX02`, por ejemplo).
 *
 * El valor se guarda como un arreglo de objetos serializados, para que cada fila conserve sus
 * campos (nombre, dosis, frecuencia, vía, última dosis) en vez de aplanarse a texto libre —
 * que es justo lo que la Especificación quiere evitar. Se tolera una fila que sea texto suelto
 * por si viene de una captura anterior.
 */
export function getRepeater(answers: FormAnswers, code: string): Record<string, string>[] {
  return getMulti(answers, code)
    .map((raw) => {
      try {
        const o: unknown = JSON.parse(raw);
        return o && typeof o === 'object' && !Array.isArray(o)
          ? (o as Record<string, string>)
          : { nombre: raw };
      } catch {
        return { nombre: raw };
      }
    })
    .filter((o) => Object.values(o).some((v) => String(v ?? '').trim() !== ''));
}

/**
 * Un repetidor en prosa legible: `"Losartán 50 mg, cada 12 h · Metformina 850 mg"`.
 *
 * SIN esto, el documento clínico imprimía el JSON crudo (`{"nombre":"Losartán"}`) en un texto
 * que firma el anestesiólogo, y la detección de GLP-1 buscaba el nombre del fármaco dentro de
 * las llaves.
 */
export function formatRepeater(answers: FormAnswers, code: string): string {
  return getRepeater(answers, code)
    .map((fila) => {
      const { nombre, ...resto } = fila;
      const detalles = Object.values(resto)
        .map((v) => String(v ?? '').trim())
        .filter(Boolean);
      return [String(nombre ?? '').trim(), detalles.join(', ')].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join(' · ');
}

/**
 * Texto de una respuesta para uso clínico: igual que `getText`, pero desenvuelve los
 * repetidores. Es el que deben usar el motor y el auditor.
 */
export function getClinicalText(answers: FormAnswers, code: string): string {
  const a = answers[code];
  if (a?.type === 'REPETIDOR') return formatRepeater(answers, code);
  return getText(answers, code);
}

/** Cita de fuente para el documento clínico: `formulario:CF01`. Es el contrato de CS2. */
export function fuenteDe(code: string): string {
  return `formulario:${code}`;
}

/** Cita de varias preguntas: `formulario:AP00, AG01`. */
export function fuenteDeVarias(codes: readonly string[]): string {
  return `formulario:${codes.join(', ')}`;
}
