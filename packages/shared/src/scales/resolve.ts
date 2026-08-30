import { normalizeTernary, normalizeValue, type Ternario } from '../rules';
import { getMulti, getNumber, getText, includesOption, isAnswered } from '../answers';
import type { FormAnswers } from '../form';
import type { VariableEscala } from './types';

/**
 * Resolución de variables de escala — CS9.
 *
 * **Este es un camino de código DISTINTO al de visibilidad.** `evaluateRule` decide si mostrar
 * una pregunta y es binario: sin responder, no se muestra el hijo. Aquí, en cambio, una variable
 * sin responder o en "No sabe" es `desconocido`, y eso deja la escala en `PENDIENTE`.
 *
 * Mezclarlos es exactamente cómo "No sabe" acaba convertido en "No" dentro de un puntaje.
 */

/** Una variable resuelta, o la razón por la que no se pudo. */
export type Resuelto<T> = { ok: true; valor: T; variable: VariableEscala } | { ok: false; falta: string };

/**
 * Fuentes admisibles para una variable de escala.
 *
 * Lista BLANCA, no negra: lo que no está aquí, no entra. Un dato derivado o estimado por el
 * sistema no puede alimentar un puntaje — el caso concreto que motivó la regla es la SpO2, que
 * el sistema llegó a proponer como "≥ 96 %" de referencia y que ARISCAT habría consumido como
 * si alguien la hubiera medido.
 */
const PREFIJOS_ADMITIDOS = [
  'formulario:', 'agenda:', 'lab:', 'documento:', 'sistema:calculo',
  // Con y sin sufijo: el examen manual se guarda como `anestesiologo` a secas, y la atestación
  // de examen normal como `anestesiologo:examen-normal-confirmado`. Ambas son mediciones suyas.
  'anestesiologo',
];

/** ¿Esta procedencia puede sustentar una variable de escala? */
export function fuenteAdmisible(fuente: string | null | undefined): boolean {
  if (!fuente) return false;
  return PREFIJOS_ADMITIDOS.some((p) => fuente.startsWith(p));
}

/**
 * Campos que SÓLO puede aportar el anestesiólogo, midiendo.
 *
 * La Especificación es explícita: la SpO2 "nunca se infiere"; vía aérea, CFS y ASA definitiva
 * "no se autoadministran". Si alguno de estos llega con otra procedencia, no se usa.
 */
export const SOLO_CLINICO = ['spo2', 'tension_arterial', 'frecuencia_cardiaca', 'frecuencia_respiratoria',
  'via_aerea', 'cfs', 'asa_definitiva'] as const;

/** ¿La variable exige medición del clínico? */
export function exigeClinico(origen: string): boolean {
  const o = normalizeValue(origen);
  return SOLO_CLINICO.some((c) => o.includes(c));
}

/**
 * Comprueba CS9 sobre una variable ya construida. Devuelve el motivo del rechazo, o null.
 *
 * Se aplica en un ÚNICO punto para las ocho escalas: si cada evaluador comprobara su propia
 * procedencia, bastaría con que uno se olvidara.
 */
export function violaCS9(v: VariableEscala): string | null {
  if (!fuenteAdmisible(v.fuente)) {
    return `${v.nombre}: procedencia no admisible para una escala (${v.fuente}).`;
  }
  if (exigeClinico(v.origen) && !v.fuente.startsWith('anestesiologo')) {
    return `${v.nombre}: debe medirla el anestesiólogo; no se infiere (${v.fuente}).`;
  }
  return null;
}

// ── Lectores del formulario ───────────────────────────────────────────────────────────────

/** Respuesta de tres estados. "No sabe" y el blanco NO son "no": dejan la escala pendiente. */
export function ternaria(
  answers: FormAnswers,
  code: string,
  nombre: string,
): Resuelto<boolean> {
  const t: Ternario | null = normalizeTernary(answers[code]?.value);
  if (t == null || t === 'no_sabe') return { ok: false, falta: nombre };
  return {
    ok: true,
    valor: t === 'si',
    variable: { nombre, origen: code, valor: t === 'si', fuente: `formulario:${code}` },
  };
}

/** Opción de una selección única. `null` si no respondió. */
export function opcion(answers: FormAnswers, code: string, nombre: string): Resuelto<string> {
  const v = getText(answers, code).trim();
  if (!v || normalizeValue(v) === 'no sabe') return { ok: false, falta: nombre };
  return { ok: true, valor: v, variable: { nombre, origen: code, valor: v, fuente: `formulario:${code}` } };
}

/** Número del formulario (peso, talla, circunferencia de cuello…). */
export function numero(answers: FormAnswers, code: string, nombre: string): Resuelto<number> {
  const n = getNumber(answers, code);
  if (n == null) return { ok: false, falta: nombre };
  return { ok: true, valor: n, variable: { nombre, origen: code, valor: n, fuente: `formulario:${code}` } };
}

/** ¿La multiselección incluye alguna de estas opciones? Responder es obligatorio para resolver. */
export function incluyeAlguna(
  answers: FormAnswers,
  code: string,
  opciones: string[],
  nombre: string,
): Resuelto<boolean> {
  if (!isAnswered(answers, code)) return { ok: false, falta: nombre };
  const hay = includesOption(answers, code, opciones);
  return { ok: true, valor: hay, variable: { nombre, origen: code, valor: hay, fuente: `formulario:${code}` } };
}

/** ¿Alguno de estos acordeones incluye alguna de estas patologías? */
export function tienePatologia(
  answers: FormAnswers,
  codigosAcordeon: readonly string[],
  opciones: string[],
  nombre: string,
): Resuelto<boolean> {
  const respondioAlguno = codigosAcordeon.some((c) => isAnswered(answers, c));
  if (!respondioAlguno) return { ok: false, falta: nombre };
  const hay = codigosAcordeon.some((c) => includesOption(answers, c, opciones));
  return {
    ok: true,
    valor: hay,
    variable: { nombre, origen: codigosAcordeon.join(','), valor: hay, fuente: 'formulario:AG01-AG11' },
  };
}

/** Un hecho ya derivado por el sistema (edad, IMC). `sistema:calculo` es fuente admisible. */
export function derivado<T extends string | number | boolean>(
  valor: T | null | undefined,
  nombre: string,
  origen: string,
): Resuelto<T> {
  if (valor == null) return { ok: false, falta: nombre };
  return { ok: true, valor, variable: { nombre, origen, valor, fuente: 'sistema:calculo' } };
}

/** Un dato de la agenda quirúrgica. */
export function deAgenda<T extends string | number | boolean>(
  valor: T | null | undefined,
  nombre: string,
  codigo: string,
): Resuelto<T> {
  if (valor == null) return { ok: false, falta: nombre };
  return { ok: true, valor, variable: { nombre, origen: codigo, valor, fuente: `agenda:${codigo}` } };
}

/** Un valor de laboratorio validado. */
export function deLaboratorio(
  valor: number | null | undefined,
  nombre: string,
  analito: string,
): Resuelto<number> {
  if (valor == null) return { ok: false, falta: nombre };
  return { ok: true, valor, variable: { nombre, origen: `lab:${analito}`, valor, fuente: `lab:${analito}` } };
}

/**
 * Junta variables resueltas. Devuelve las que se pudieron obtener y las que faltan.
 *
 * Aplica CS9 a cada una: una variable con procedencia inadmisible NO se cuenta como resuelta,
 * pasa a faltante. Así una escala nunca puntúa con un dato que nadie midió.
 */
export function recolectar(items: Resuelto<unknown>[]): {
  variables: VariableEscala[];
  faltantes: string[];
  violaciones: string[];
} {
  const variables: VariableEscala[] = [];
  const faltantes: string[] = [];
  const violaciones: string[] = [];

  for (const it of items) {
    if (!it.ok) {
      faltantes.push(it.falta);
      continue;
    }
    const mal = violaCS9(it.variable);
    if (mal) {
      violaciones.push(mal);
      faltantes.push(it.variable.nombre);
      continue;
    }
    variables.push(it.variable);
  }
  return { variables, faltantes, violaciones };
}

/** Puntos de una variable booleana. Azúcar para las escalas aditivas. */
export function puntuar(v: VariableEscala, puntos: number): VariableEscala {
  return { ...v, puntos: v.valor === true ? puntos : 0 };
}

/** Suma los puntos asignados. */
export function total(variables: VariableEscala[]): number {
  return variables.reduce((acc, v) => acc + (v.puntos ?? 0), 0);
}

export { getMulti };
