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

/** Devuelve el analito canónico o null si no se reconoce. */
export function canonicalAnalyte(name: string): string | null {
  return SYNONYMS[norm(name)] ?? null;
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
