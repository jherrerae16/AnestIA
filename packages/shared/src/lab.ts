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
 * Reglas de flag DETERMINÍSTICAS (sin LLM). Umbrales DEFAULT — PENDIENTE de validación
 * clínica del Dr. Luquetta antes de producción. Configurables aquí.
 * Devuelve NORMAL para analitos sin regla (BR-2.5) o valores no numéricos.
 */
export function flagLab(analyteRaw: string, valueRaw: string | number, sex: SexT): LabFlag {
  const analyte = canonicalAnalyte(analyteRaw);
  const v = parseNumeric(valueRaw);
  if (analyte == null || v == null) return 'NORMAL';

  switch (analyte) {
    case 'Hemoglobina': {
      const low = sex === 'FEMENINO' ? 12 : 13;
      if (v < low || v > 17) return 'ALERTA';
      return 'NORMAL';
    }
    case 'Plaquetas': {
      // valores suelen venir en miles o en absoluto; normalizamos a absoluto
      const abs = v < 1000 ? v * 1000 : v;
      if (abs < 100000) return 'CRITICO';
      if (abs < 150000) return 'ALERTA';
      return 'NORMAL';
    }
    case 'INR':
      return v > 1.4 ? 'ALERTA' : 'NORMAL';
    case 'Leucocitos': {
      const abs = v < 100 ? v * 1000 : v;
      if (abs < 4000 || abs > 11000) return 'ALERTA';
      return 'NORMAL';
    }
    case 'Creatinina':
      return v > 1.3 ? 'ALERTA' : 'NORMAL';
    case 'Glucemia':
      if (v > 250) return 'CRITICO';
      if (v > 180) return 'ALERTA';
      return 'NORMAL';
    default:
      return 'NORMAL'; // Hematocrito/TP/TPT: sin umbral simple en el piloto → NORMAL
  }
}
