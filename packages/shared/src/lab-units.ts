import { canonicalAnalyte, parseNumeric } from './lab';

/**
 * Conversión de unidades de laboratorio.
 *
 * La Especificación §15 es explícita: *"Convertir unidades solo con reglas validadas y conservar
 * siempre el valor original"*. Así que esto es una tabla CERRADA, no un conversor general: lo
 * que no esté aquí no se convierte, se deja como vino y se marca para revisión.
 *
 * Convertir de más es peor que no convertir. Un factor equivocado en una hemoglobina cambia una
 * anemia por una policitemia en un documento firmado.
 */

export interface ReglaConversion {
  /** Analito canónico al que aplica. */
  analito: string;
  /** Unidad de origen, normalizada (minúsculas, sin espacios). */
  desde: string;
  /** Unidad canónica de destino. */
  hacia: string;
  factor: number;
  /** De dónde sale el factor. */
  fuente: string;
}

/** Normaliza una unidad para comparar: minúsculas, sin espacios ni puntos. */
export function normalizeUnidad(u: string | null | undefined): string {
  return String(u ?? '')
    .toLowerCase()
    .replace(/\s|\./g, '')
    .replace(/µ/g, 'u')
    .replace(/×/g, 'x');
}

/**
 * Reglas validadas. Deliberadamente cortas.
 *
 * Se cubren las conversiones que aparecen de verdad en los informes colombianos y que alimentan
 * escalas o alertas. El resto se deja sin convertir a propósito.
 */
export const REGLAS: readonly ReglaConversion[] = [
  // Hemoglobina: g/L → g/dL (alimenta ARISCAT).
  { analito: 'Hemoglobina', desde: 'g/l', hacia: 'g/dL', factor: 0.1, fuente: 'SI → unidades convencionales' },
  // Creatinina: µmol/L → mg/dL (alimenta RCRI). Factor 1/88.4.
  { analito: 'Creatinina', desde: 'umol/l', hacia: 'mg/dL', factor: 1 / 88.4, fuente: 'SI → unidades convencionales' },
  // Plaquetas y leucocitos: recuentos absolutos → x10³/µL.
  { analito: 'Plaquetas', desde: '/ul', hacia: 'x10^3/uL', factor: 0.001, fuente: 'recuento absoluto' },
  { analito: 'Plaquetas', desde: 'x10^9/l', hacia: 'x10^3/uL', factor: 1, fuente: 'equivalencia directa' },
  { analito: 'Leucocitos', desde: '/ul', hacia: 'x10^3/uL', factor: 0.001, fuente: 'recuento absoluto' },
  { analito: 'Leucocitos', desde: 'x10^9/l', hacia: 'x10^3/uL', factor: 1, fuente: 'equivalencia directa' },
  // Glucemia: mmol/L → mg/dL. El analito va con su nombre CANÓNICO ("Glucemia", no "Glucosa"):
  // la regla se busca por el resultado de `canonicalAnalyte`, así que un nombre no canónico
  // simplemente nunca coincide y la conversión no ocurre, en silencio.
  { analito: 'Glucemia', desde: 'mmol/l', hacia: 'mg/dL', factor: 18.0182, fuente: 'SI → unidades convencionales' },
];

/**
 * Nombres de la tabla que no son canónicos. Debe estar vacío: una regla escrita con el nombre
 * coloquial no coincide nunca y la conversión se pierde sin error visible.
 */
export function reglasConNombreNoCanonico(): string[] {
  return [...new Set(REGLAS.map((r) => r.analito))].filter(
    (a) => canonicalAnalyte(a) !== a,
  );
}

export interface Convertido {
  /** Valor en la unidad canónica, o el original si no hubo regla. */
  value: string;
  unit: string | null;
  /** Valor y unidad tal como venían impresos. NUNCA se pierden. */
  valueRaw: string;
  unitRaw: string | null;
  /** Regla aplicada, o null si no se convirtió. */
  conversionRule: string | null;
}

/**
 * Convierte un resultado a su unidad canónica, si hay una regla validada.
 *
 * Sin regla, devuelve el original intacto — no adivina un factor. El original se conserva en
 * `valueRaw`/`unitRaw` incluso cuando sí se convierte, que es la parte que la spec subraya.
 */
export function convertirUnidad(
  analyte: string,
  value: string,
  unit: string | null | undefined,
): Convertido {
  const base: Convertido = {
    value, unit: unit ?? null, valueRaw: value, unitRaw: unit ?? null, conversionRule: null,
  };
  const canon = canonicalAnalyte(analyte);
  if (!canon || !unit) return base;

  const regla = REGLAS.find(
    (r) => r.analito === canon && r.desde === normalizeUnidad(unit),
  );
  if (!regla) return base;

  const n = parseNumeric(value);
  if (n == null) return base;

  const convertido = n * regla.factor;
  // Se redondea a 3 decimales significativos para no arrastrar ruido de coma flotante
  // (1/88.4 nunca es exacto), sin perder resolución clínica.
  const redondeado = Math.round(convertido * 1000) / 1000;
  return {
    value: String(redondeado),
    unit: regla.hacia,
    valueRaw: value,
    unitRaw: unit,
    conversionRule: `${regla.desde} → ${regla.hacia} (×${regla.factor}) · ${regla.fuente}`,
  };
}

/** ¿Existe alguna regla para este analito? Para avisar de unidades desconocidas. */
export function tieneReglas(analyte: string): boolean {
  const canon = canonicalAnalyte(analyte);
  return canon != null && REGLAS.some((r) => r.analito === canon);
}
