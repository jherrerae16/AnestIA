import { TIPOS_TERNARIOS } from '../preset';
import {
  BANDA_ETARIA,
  RUTA_CLINICA,
  baseCode,
  referencedCodes,
  type Rule,
  type VisibilityNode,
} from '../rules';
import {
  ANESTESIAS,
  DURACIONES,
  ESPECIALIDADES,
  MODALIDADES,
  PRIORIDADES,
  SITIOS_ARISCAT,
} from '../schedule';
import { GRUPOS_PATOLOGIAS, PATOLOGIA_POR_SLUG, SLUG_POR_LABEL } from './groups';
import { QUESTION_DICTIONARY, CODIGOS_SISTEMA } from './questions';
import { dictQuestionSchema, type DictQuestion, type SeccionKey } from './types';

export * from './types';
export * from './codes';
export * from './groups';
export { QUESTION_DICTIONARY, CODIGOS_SISTEMA } from './questions';

/** Índice código → pregunta. */
export const QUESTION_BY_CODE: ReadonlyMap<string, DictQuestion> = new Map(
  QUESTION_DICTIONARY.map((q) => [q.code, q] as const),
);

export function byCode(code: string): DictQuestion | undefined {
  return QUESTION_BY_CODE.get(baseCode(code));
}

export function bySeccion(seccion: SeccionKey): DictQuestion[] {
  return QUESTION_DICTIONARY.filter((q) => q.seccion === seccion);
}

/** Preguntas que SÍ se le muestran al paciente (todo lo que no es dato de sistema). */
export function preguntasDelPaciente(): DictQuestion[] {
  return QUESTION_DICTIONARY.filter((q) => q.obligacion !== 'S');
}

/** Vista mínima para el motor de visibilidad. */
export function visibilityNodes(): VisibilityNode[] {
  return QUESTION_DICTIONARY.map((q) => ({ code: q.code, activacion: q.activacion ?? null }));
}

/**
 * Valida el diccionario completo. Se corre en test y al arrancar el worker: un diccionario mal
 * formado produce documentos con fuentes equivocadas, que es exactamente el fallo que este
 * rediseño existe para eliminar.
 *
 * Devuelve la lista de errores (vacía = válido). Puro, para poder testearlo.
 */
export function validateDictionary(dict: readonly DictQuestion[] = QUESTION_DICTIONARY): string[] {
  const errors: string[] = [];
  const seenCodes = new Set<string>();
  const seenOrders = new Set<number>();
  const codes = new Set(dict.map((q) => q.code));

  for (const q of dict) {
    const parsed = dictQuestionSchema.safeParse(q);
    if (!parsed.success) {
      errors.push(`${q.code}: esquema inválido — ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    }

    if (seenCodes.has(q.code)) errors.push(`Código duplicado: ${q.code}`);
    seenCodes.add(q.code);

    if (seenOrders.has(q.order)) errors.push(`${q.code}: orden duplicado (${q.order})`);
    seenOrders.add(q.order);

    // Las referencias del árbol de reglas deben existir, o la rama nunca se abre.
    if (q.activacion) {
      for (const ref of referencedCodes(q.activacion)) {
        if (!codes.has(ref)) errors.push(`${q.code}: su regla referencia un código inexistente (${ref})`);
        if (ref === q.code) errors.push(`${q.code}: su regla se referencia a sí misma`);
      }
      errors.push(...ternaryGuard(q, q.activacion, dict));
      errors.push(...negacionGuard(q, q.activacion));
      errors.push(...valoresDeHechoGuard(q, q.activacion));
    }

    if (q.repiteSobre && !codes.has(q.repiteSobre)) {
      errors.push(`${q.code}: repiteSobre apunta a un código inexistente (${q.repiteSobre})`);
    }

    // Un dato de sistema jamás debe tener regla de activación del formulario: no se pregunta.
    if (q.obligacion === 'S' && q.activacion) {
      errors.push(`${q.code}: es dato de sistema y no puede tener regla de activación`);
    }

    // Los tipos con opciones cerradas necesitan opciones.
    const necesitaOpciones = ['SELECCION_UNICA', 'SELECCION_MULTIPLE', 'ACORDEON_MULTIPLE', 'SI_NO_NOSABE'];
    if (necesitaOpciones.includes(q.type) && (q.opciones == null || q.opciones.length === 0)) {
      errors.push(`${q.code}: el tipo ${q.type} exige opciones`);
    }
    if (q.type === 'REPETIDOR' && (q.campos == null || q.campos.length === 0)) {
      errors.push(`${q.code}: un REPETIDOR exige campos`);
    }
    if (q.type === 'ACORDEON_MULTIPLE' && !q.grupo) {
      errors.push(`${q.code}: un ACORDEON_MULTIPLE exige grupo`);
    }
  }

  // El grafo de activación debe ser acíclico, o el punto fijo nunca abre esas preguntas.
  errors.push(...detectCycles(dict));

  return errors;
}

/**
 * "No sabe" nunca puede volverse "No".
 *
 * Prohíbe `notEquals` sobre una pregunta de tres estados: `{op:'notEquals', value:'si'}` se
 * cumple tanto con `no` como con `no_sabe`, y ahí es donde el tercer estado se colapsa en
 * silencio. El autor debe escribir la intención de forma explícita:
 * `{op:'in', value:['no','no_sabe']}` si de verdad quiere ambos, o `{op:'equals', value:'no'}`
 * si quiere solo la negación. Es la regla de los tres PDFs convertida en propiedad verificable.
 */
function ternaryGuard(q: DictQuestion, rule: Rule, dict: readonly DictQuestion[]): string[] {
  const out: string[] = [];
  const esTernaria = (code: string) => {
    const target = dict.find((d) => d.code === code);
    return target != null && TIPOS_TERNARIOS.includes(target.type);
  };

  const walk = (r: Rule): void => {
    switch (r.kind) {
      case 'answer':
        if ((r.op === 'notEquals' || r.op === 'notIn' || r.op === 'notIncludes') && esTernaria(r.code)) {
          out.push(
            `${q.code}: usa "${r.op}" sobre ${r.code}, que es de tres estados. ` +
              `Una negación colapsa "no sabe" en "no". Escriba la intención de forma explícita ` +
              `(p. ej. { op: 'in', value: ['no', 'no_sabe'] }).`,
          );
        }
        break;
      case 'all':
      case 'any':
        r.rules.forEach(walk);
        break;
      case 'not':
        walk(r.rule);
        break;
    }
  };
  walk(rule);
  return out;
}

/**
 * Valores admitidos por cada hecho de conjunto cerrado.
 *
 * Las reglas comparan contra el valor del ENUM que envía la agenda (`ABDOMINAL_SUPERIOR`), no
 * contra su etiqueta en español ("Abdominal superior"). Escribir la etiqueta no rompe nada
 * visible: simplemente la rama no se abre nunca. Ya pasó con el sitio quirúrgico y la duración.
 */
const VALORES_DE_HECHO: Partial<Record<string, readonly string[]>> = {
  'px.especialidad': ESPECIALIDADES,
  'px.modalidad': MODALIDADES,
  'px.prioridad': PRIORIDADES,
  'px.sitio_quirurgico': SITIOS_ARISCAT,
  'px.duracion_estimada': DURACIONES,
  'px.anestesia_probable': ANESTESIAS,
  banda_etaria: BANDA_ETARIA,
  ruta: RUTA_CLINICA,
};

/** Comprueba que las reglas sobre hechos cerrados usen valores del enum, no etiquetas. */
function valoresDeHechoGuard(q: DictQuestion, rule: Rule): string[] {
  const out: string[] = [];
  const walk = (r: Rule): void => {
    switch (r.kind) {
      case 'fact': {
        const admitidos = VALORES_DE_HECHO[r.fact];
        if (admitidos && r.value != null) {
          const usados = Array.isArray(r.value) ? r.value : [String(r.value)];
          for (const v of usados) {
            if (!admitidos.includes(String(v))) {
              out.push(
                `${q.code}: compara ${r.fact} contra "${v}", que no es un valor válido. ` +
                  `Usa el enum (${admitidos.join(' | ')}); una etiqueta traducida hace que la ` +
                  `rama no se abra nunca, sin error visible.`,
              );
            }
          }
        }
        break;
      }
      case 'all':
      case 'any':
        r.rules.forEach(walk);
        break;
      case 'not':
        walk(r.rule);
        break;
    }
  };
  walk(rule);
  return out;
}

/**
 * Prohíbe envolver una comparación de respuesta en un `not`.
 *
 * Una pregunta SIN RESPONDER hace falsa cualquier comparación de contenido; el `not` la invierte
 * a verdadera y la rama se abre antes de que el paciente conteste. Pasó de verdad: el bloque del
 * acudiente aparecía para todo el mundo y el DASI completo se abría desde el primer paso.
 *
 * Los operadores negativos (`notEquals`, `notIn`, `notIncludes`) SÍ son seguros: tratan la
 * ausencia como falso, que es lo correcto.
 */
function negacionGuard(q: DictQuestion, rule: Rule): string[] {
  const out: string[] = [];
  const walk = (r: Rule): void => {
    switch (r.kind) {
      case 'not':
        if (r.rule.kind === 'answer') {
          out.push(
            `${q.code}: envuelve una comparación de ${r.rule.code} en un "not". Una pregunta sin ` +
              `responder haría cierta la negación y la rama se abriría sola. Usa el operador ` +
              `negativo (notIn / notEquals / notIncludes), que trata la ausencia como falso.`,
          );
        }
        walk(r.rule);
        break;
      case 'all':
      case 'any':
        r.rules.forEach(walk);
        break;
    }
  };
  walk(rule);
  return out;
}

/** Detecta ciclos en el grafo pregunta → preguntas de las que depende su activación. */
function detectCycles(dict: readonly DictQuestion[]): string[] {
  const deps = new Map<string, string[]>();
  for (const q of dict) {
    deps.set(q.code, q.activacion ? [...referencedCodes(q.activacion)] : []);
  }
  const estado = new Map<string, 'visitando' | 'listo'>();
  const errors: string[] = [];

  const visit = (code: string, path: string[]): void => {
    const s = estado.get(code);
    if (s === 'listo') return;
    if (s === 'visitando') {
      errors.push(`Ciclo de activación: ${[...path, code].join(' → ')}`);
      return;
    }
    estado.set(code, 'visitando');
    for (const d of deps.get(code) ?? []) visit(d, [...path, code]);
    estado.set(code, 'listo');
  };

  for (const q of dict) visit(q.code, []);
  return errors;
}

/**
 * Compara las filas de `Question` sembradas contra el diccionario en código.
 *
 * Las dos pueden divergir: el diccionario vive en TypeScript y las filas se materializan en el
 * seed, así que cambiar una regla sin re-sembrar deja la BD sirviendo la versión anterior. Pasó
 * durante la Fase 2: se corrigió la activación del DASI y el formulario siguió abriéndolo para
 * todos, porque la regla vieja seguía en la base.
 *
 * Devuelve las diferencias (vacío = coherente).
 */
export function diffPresetVsDiccionario(
  filas: readonly { code: string; conditional?: unknown; label?: string }[],
): string[] {
  const out: string[] = [];
  const enBd = new Map(filas.map((f) => [f.code, f]));

  for (const q of QUESTION_DICTIONARY) {
    const fila = enBd.get(q.code);
    if (!fila) {
      out.push(`${q.code} está en el diccionario pero no en la base. Falta re-sembrar.`);
      continue;
    }
    const esperada = JSON.stringify(q.activacion ?? null);
    const enBase = JSON.stringify(fila.conditional ?? null);
    if (esperada !== enBase) {
      out.push(`${q.code}: la regla de activación de la base no coincide con el diccionario.`);
    }
  }
  for (const code of enBd.keys()) {
    if (!QUESTION_BY_CODE.has(code)) {
      out.push(`${code} está en la base pero ya no en el diccionario. Falta re-sembrar.`);
    }
  }
  return out;
}

/** Lanza si el diccionario no es válido. Para el arranque del worker. */
export function assertDictionaryValid(): void {
  const errors = validateDictionary();
  if (errors.length > 0) {
    throw new Error(`Diccionario de preguntas inválido:\n- ${errors.join('\n- ')}`);
  }
}

/** Slug de una etiqueta de patología, para construir claves de instancia `AP01#<slug>`. */
export function slugDePatologia(label: string): string | undefined {
  return SLUG_POR_LABEL.get(label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

export { GRUPOS_PATOLOGIAS, PATOLOGIA_POR_SLUG };
