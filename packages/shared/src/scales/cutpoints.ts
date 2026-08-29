import type { ScaleKey } from './types';

/**
 * Puntos de corte de las escalas.
 *
 * Los tres documentos del Dr. Luquetta remiten la versión final, los cortes y los derechos de
 * uso al **Manual Clínico**, que es un documento institucional y todavía no existe. Los
 * instrumentos sí son internacionales y publicados, así que esta tabla se siembra con los
 * valores de las fuentes que la propia Especificación cita — y se marca `SIN_VALIDAR`.
 *
 * **Mientras una escala esté `SIN_VALIDAR`, se emite el puntaje pero NO la categoría.** El
 * médico ve las variables, el estado y el número; la interpretación se retiene hasta que la
 * institución la firme. El Dr. revisa esta tabla, no código.
 */

export type EstadoValidacion = 'SIN_VALIDAR' | 'VALIDADO';

export interface Banda {
  /** Mínimo inclusivo. */
  min: number;
  /** Máximo inclusivo. `null` = sin techo. */
  max: number | null;
  categoria: string;
}

export interface Cortes {
  escala: ScaleKey;
  /** Versión de esta tabla, no del instrumento. Queda guardada en cada resultado. */
  version: string;
  validacion: EstadoValidacion;
  /** Cita bibliográfica, tal como la referencia la Especificación. */
  fuente: string;
  bandas: readonly Banda[];
  /** Advertencias de uso que el Dr. debe resolver antes de validar. */
  nota?: string;
}

export const CORTES: Record<ScaleKey, Cortes> = {
  DASI: {
    escala: 'DASI',
    version: 'dasi-duke-1989@1',
    validacion: 'SIN_VALIDAR',
    fuente: 'Hlatky et al., Duke Activity Status Index (1989). Umbral funcional ≈ 4 METs.',
    // El DASI produce un puntaje ponderado que se convierte a METs. El umbral de 4 METs es el
    // que suele eximir de estudio cardiológico adicional (AHA/ACC 2024).
    bandas: [
      { min: 0, max: 34.19, categoria: 'Capacidad funcional reducida (< 4 METs)' },
      { min: 34.2, max: null, categoria: 'Capacidad funcional conservada (≥ 4 METs)' },
    ],
    nota: 'DASI es un instrumento licenciado (Duke). Confirmar derechos de uso antes de producción.',
  },
  STOP_BANG: {
    escala: 'STOP_BANG',
    version: 'stopbang-toronto@1',
    validacion: 'SIN_VALIDAR',
    fuente: 'stopbang.ca — protocolo oficial de interpretación.',
    bandas: [
      { min: 0, max: 2, categoria: 'Riesgo bajo de apnea obstructiva del sueño' },
      { min: 3, max: 4, categoria: 'Riesgo intermedio' },
      { min: 5, max: 8, categoria: 'Riesgo alto' },
    ],
    nota: 'STOP-Bang (Universidad de Toronto) exige permiso para uso comercial.',
  },
  APFEL: {
    escala: 'APFEL',
    version: 'apfel-1999@1',
    validacion: 'SIN_VALIDAR',
    fuente: 'Apfel et al. (1999); Fourth Consensus Guidelines PONV (2020).',
    bandas: [
      { min: 0, max: 0, categoria: 'Riesgo basal (~10 %)' },
      { min: 1, max: 1, categoria: 'Riesgo bajo (~20 %)' },
      { min: 2, max: 2, categoria: 'Riesgo moderado (~40 %)' },
      { min: 3, max: 3, categoria: 'Riesgo alto (~60 %)' },
      { min: 4, max: 4, categoria: 'Riesgo muy alto (~80 %)' },
    ],
  },
  FRAIL: {
    escala: 'FRAIL',
    version: 'frail-spaqi@1',
    validacion: 'SIN_VALIDAR',
    fuente: 'SPAQI, Recommendations for Preoperative Management of Frailty.',
    bandas: [
      { min: 0, max: 0, categoria: 'Robusto' },
      { min: 1, max: 2, categoria: 'Prefrágil' },
      { min: 3, max: 5, categoria: 'Frágil' },
    ],
  },
  CAPRINI: {
    escala: 'CAPRINI',
    version: 'caprini-2005@1',
    validacion: 'SIN_VALIDAR',
    fuente: 'Caprini RAM; ASH, Prevention of VTE in surgical hospitalized patients.',
    bandas: [
      { min: 0, max: 1, categoria: 'Riesgo muy bajo' },
      { min: 2, max: 2, categoria: 'Riesgo bajo' },
      { min: 3, max: 4, categoria: 'Riesgo moderado' },
      { min: 5, max: null, categoria: 'Riesgo alto' },
    ],
    nota:
      'Caprini tiene versiones 2005, 2010 y 2013 con factores y umbrales distintos. La ' +
      'Especificación advierte: "No mezclar versiones ni duplicar un mismo factor". El Dr. debe ' +
      'elegir la versión que aplica a cada especialidad antes de validar.',
  },
  RCRI: {
    escala: 'RCRI',
    version: 'rcri-lee@1',
    validacion: 'SIN_VALIDAR',
    fuente: 'Lee et al., Revised Cardiac Risk Index; AHA/ACC 2024.',
    bandas: [
      { min: 0, max: 0, categoria: 'Riesgo bajo (~0.4 %)' },
      { min: 1, max: 1, categoria: 'Riesgo bajo (~1 %)' },
      { min: 2, max: 2, categoria: 'Riesgo elevado (~2.4 %)' },
      { min: 3, max: null, categoria: 'Riesgo alto (≥ 5 %)' },
    ],
  },
  ARISCAT: {
    escala: 'ARISCAT',
    version: 'ariscat-canet-2010@1',
    validacion: 'SIN_VALIDAR',
    fuente: 'Canet J et al., Prediction of postoperative pulmonary complications (2010).',
    bandas: [
      { min: 0, max: 25, categoria: 'Riesgo bajo' },
      { min: 26, max: 44, categoria: 'Riesgo intermedio' },
      { min: 45, max: null, categoria: 'Riesgo alto' },
    ],
  },
  POVOC: {
    escala: 'POVOC',
    version: 'povoc-eberhart-2004@1',
    validacion: 'SIN_VALIDAR',
    fuente: 'Eberhart et al., Pediatric postoperative vomiting score (2004).',
    bandas: [
      { min: 0, max: 0, categoria: 'Riesgo bajo (~10 %)' },
      { min: 1, max: 1, categoria: 'Riesgo bajo (~10 %)' },
      { min: 2, max: 2, categoria: 'Riesgo moderado (~30 %)' },
      { min: 3, max: 3, categoria: 'Riesgo alto (~55 %)' },
      { min: 4, max: 4, categoria: 'Riesgo muy alto (~70 %)' },
    ],
  },
};

/**
 * Categoría para un puntaje. Devuelve `null` mientras los cortes no estén validados
 * institucionalmente — el puntaje se publica, la interpretación se retiene.
 */
export function categoriaDe(escala: ScaleKey, puntaje: number): string | null {
  const c = CORTES[escala];
  if (c.validacion !== 'VALIDADO') return null;
  const banda = c.bandas.find((b) => puntaje >= b.min && (b.max == null || puntaje <= b.max));
  return banda?.categoria ?? null;
}

/** Versión de la tabla de cortes usada, para dejarla en el resultado. */
export function versionCortes(escala: ScaleKey): string {
  return CORTES[escala].version;
}

/** ¿Hay alguna escala cuya interpretación siga retenida? Para avisar al médico. */
export function escalasSinValidar(): ScaleKey[] {
  return (Object.keys(CORTES) as ScaleKey[]).filter((k) => CORTES[k].validacion !== 'VALIDADO');
}
