export type LabFlag = 'NORMAL' | 'ALERTA' | 'CRITICO';
export type SexT = 'MASCULINO' | 'FEMENINO' | 'OTRO' | null;

/**
 * Tabla de sinónimos → analito canónico. Amplía según lo que devuelva la extracción.
 */
const SYNONYMS: Record<string, string> = {
  hemoglobina: 'Hemoglobina', hb: 'Hemoglobina', hgb: 'Hemoglobina',
  hematocrito: 'Hematocrito', hto: 'Hematocrito', hct: 'Hematocrito',
  plaquetas: 'Plaquetas', plt: 'Plaquetas',
  leucocitos: 'Leucocitos', wbc: 'Leucocitos', 'globulos blancos': 'Leucocitos',
  inr: 'INR',
  tp: 'TP', 'tiempo de protrombina': 'TP',
  tpt: 'TPT', ptt: 'TPT', 'tiempo de tromboplastina': 'TPT',
  creatinina: 'Creatinina', crea: 'Creatinina',
  glucemia: 'Glucemia', glucosa: 'Glucemia', glicemia: 'Glucemia',
};

function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Patrones de los informes reales, que no nombran el analito a secas: "RECUENTO TOTAL DE
 * PLAQUETAS", "CREATININA EN SUERO (SERICA)". Con igualdad exacta no se reconocían y
 * `flagLab` los daba por NORMAL sin evaluarlos — un valor crítico pasaba en silencio.
 *
 * El orden importa: gana el primero que coincida. Los patrones negativos (?!…) excluyen
 * analitos distintos que comparten palabra — "CREATININA ORINA" no es la creatinina sérica,
 * y "Leucocitos (sedimento)" del uroanálisis no es el recuento en sangre.
 */
const PATTERNS: [RegExp, string][] = [
  [/^(?!.*(orina|relacion|indice|\/)).*creatinina/, 'Creatinina'],
  [/(recuento (total )?de )?plaquetas|^plt/, 'Plaquetas'],
  [/^(?!.*(sedimento|estearasa|orina)).*(recuento de )?leucocitos|^wbc$|globulos blancos/, 'Leucocitos'],
  [/hemoglobina(?! corpuscular)|^hb$|^hgb$/, 'Hemoglobina'],
  [/glicemia|glucemia|glucosa en (suero|sangre)|^glucosa$/, 'Glucemia'],
  [/^(inr|isi)$|razon normalizada/, 'INR'],
];

/**
 * Devuelve el analito canónico o null si no se reconoce.
 * Primero igualdad exacta (sinónimos cortos), luego los patrones de los informes reales.
 */
export function canonicalAnalyte(name: string): string | null {
  const n = norm(name);
  const exact = SYNONYMS[n];
  if (exact) return exact;
  for (const [re, canonical] of PATTERNS) {
    if (re.test(n)) return canonical;
  }
  return null;
}

/** Extrae el primer número de un string ("15.9 g/dL" → 15.9, "244.000" → 244000). null si no hay. */
export function parseNumeric(value: string | number): number | null {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const s = String(value).trim();
  // Miles con punto: "244.000" → "244000" (3 dígitos tras el punto y sin decimales reales)
  const thousands = s.match(/^-?\d{1,3}(?:\.\d{3})+$/);
  if (thousands) {
    const n = parseInt(s.replace(/\./g, ''), 10);
    return isFinite(n) ? n : null;
  }
  const cleaned = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!cleaned) return null;
  const n = parseFloat(cleaned[0].replace(',', '.'));
  return isFinite(n) ? n : null;
}

/**
 * Rango de referencia interpretado desde el que el PROPIO examen imprime. El laboratorio ya
 * calculó el rango correcto para ese paciente (edad, sexo, método, altitud), así que se usa ESE
 * y no umbrales hardcodeados genéricos.
 * - `{ min, max }`: rango numérico (uno de los dos puede faltar en "< 200" / "> 40").
 * - `qualitative`: el rango es cualitativo ("Negativo", "No reactivo") → no se compara numérico.
 * - `null`: no se pudo interpretar → el analito se muestra sin marcar, con aviso al médico.
 */
export interface RefRange {
  min: number | null;
  max: number | null;
  qualitative: boolean;
}

/**
 * Interpreta el rango de referencia impreso en el examen. Cubre los formatos comunes de
 * laboratorios colombianos. Devuelve null si no logra interpretarlo (fail-visible, no fail-a-umbral).
 */
export function parseRefRange(raw: string | null | undefined): RefRange | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;
  const n = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Cualitativo: "negativo", "no reactivo", "positivo", "ausente" → no se compara numérico.
  // Sin \b de cierre: "negativo" = "negativ"+"o" no tiene boundary tras la raíz.
  if (/(negativ|positiv|reactiv|ausente|presente|no se detect)/.test(n) && !/\d/.test(n)) {
    return { min: null, max: null, qualitative: true };
  }

  // Un número decimal con coma o punto (captura el primero de cada extremo).
  const num = '(-?\\d+(?:[.,]\\d+)?)';
  const toNum = (x: string) => parseFloat(x.replace(',', '.'));

  // "< 200" / "menor a 200" / "hasta 200" / "≤ 200" → solo tope superior.
  let m = n.match(new RegExp(`^(?:<|≤|<=|menor(?:\\s+(?:a|de|que))?|hasta|inferior(?:\\s+a)?)\\s*${num}`));
  if (m && m[1]) return { min: null, max: toNum(m[1]), qualitative: false };

  // "> 40" / "mayor a 40" / "≥ 40" / "superior a 40" → solo piso inferior.
  m = n.match(new RegExp(`^(?:>|≥|>=|mayor(?:\\s+(?:a|de|que))?|superior(?:\\s+a)?|minimo(?:\\s+de)?)\\s*${num}`));
  if (m && m[1]) return { min: toNum(m[1]), max: null, qualitative: false };

  // Rango "12.0 - 17.0", guion normal o largo (– —), con o sin unidades pegadas al final.
  m = n.match(new RegExp(`${num}\\s*(?:-|–|—|a|hasta)\\s*${num}`));
  if (m && m[1] && m[2]) {
    const a = toNum(m[1]);
    const b = toNum(m[2]);
    return { min: Math.min(a, b), max: Math.max(a, b), qualitative: false };
  }

  return null; // formato no reconocido → fail-visible
}

/** Resultado del flagging: la marca + por qué (para el aviso visible cuando el rango no se leyó). */
export interface FlagResult {
  flag: LabFlag;
  /** true = el rango de referencia impreso no se pudo interpretar; el médico verifica manual. */
  rangeUnparsed: boolean;
}

/**
 * Marca un laboratorio comparando su valor contra el RANGO IMPRESO EN EL PROPIO EXAMEN
 * (refRange). NO usa umbrales hardcodeados: cada examen trae su rango correcto para ese paciente.
 *
 * - Valor fuera del rango impreso → ALERTA. (No hay distinción CRITICO por rango: el examen no
 *   marca "crítico"; el médico juzga la severidad con el valor visible.)
 * - Rango cualitativo o valor no numérico → NORMAL sin comparar.
 * - Rango ausente o ilegible → NORMAL + `rangeUnparsed:true` (aviso visible, nunca se inventa).
 */
export function flagLab(refRangeRaw: string | null | undefined, valueRaw: string | number): FlagResult {
  const rr = parseRefRange(refRangeRaw);
  if (rr == null) {
    // Sin rango impreso o ilegible: no se marca, pero se avisa para verificación manual.
    return { flag: 'NORMAL', rangeUnparsed: true };
  }
  if (rr.qualitative) return { flag: 'NORMAL', rangeUnparsed: false };

  const v = parseNumeric(valueRaw);
  if (v == null) return { flag: 'NORMAL', rangeUnparsed: false };

  const bajoMin = rr.min != null && v < rr.min;
  const sobreMax = rr.max != null && v > rr.max;
  return { flag: bajoMin || sobreMax ? 'ALERTA' : 'NORMAL', rangeUnparsed: false };
}
