/**
 * Informes diagnósticos que no son de laboratorio: ECG, ecocardiograma, radiografía de tórax,
 * espirometría.
 *
 * Especificación §16: *"Ritmo, frecuencia, intervalos y conclusión; otros informes diagnósticos.
 * Interpretación clínica; no autocalcular escalas."*
 *
 * Las dos mitades de esa frase mandan aquí:
 *
 * 1. **Se transcribe, no se interpreta.** Cada campo es el texto del informe. El sistema no
 *    decide si un ECG es normal, no traduce "ritmo sinusal a 52 lpm" en bradicardia, y no
 *    convierte un QTc en una conducta. Eso es lectura clínica y la firma el anestesiólogo.
 * 2. **No alimenta escalas.** Ninguna variable de escala puede tener fuente `estudio:*`: no
 *    está en la lista blanca de CS9, y hay un test que lo comprueba. Un RCRI no se puntúa
 *    porque un ECG diga "ondas Q antiguas" — eso lo decide el médico, no un regex.
 */

export const TIPOS_ESTUDIO = [
  'ECG', 'ECOCARDIOGRAMA', 'RADIOGRAFIA_TORAX', 'ESPIROMETRIA', 'OTRO',
] as const;
export type TipoEstudio = (typeof TIPOS_ESTUDIO)[number];

export const NOMBRE_ESTUDIO: Record<TipoEstudio, string> = {
  ECG: 'Electrocardiograma',
  ECOCARDIOGRAMA: 'Ecocardiograma',
  RADIOGRAFIA_TORAX: 'Radiografía de tórax',
  ESPIROMETRIA: 'Espirometría',
  OTRO: 'Otro estudio',
};

/** Clave del estudio dentro de `paraclinicos`. Estable, para que el médico la pueda editar. */
export const CLAVE_ESTUDIO: Record<TipoEstudio, string> = {
  ECG: 'electrocardiograma',
  ECOCARDIOGRAMA: 'ecocardiograma',
  RADIOGRAFIA_TORAX: 'radiografia_torax',
  ESPIROMETRIA: 'espirometria',
  OTRO: 'otros_estudios',
};

/**
 * Sinónimos impresos → tipo canónico.
 *
 * Lista cerrada: lo que no reconoce cae en `OTRO` conservando el nombre impreso, en vez de
 * adivinar. Un estudio mal clasificado aparecería bajo un encabezado que no le corresponde.
 */
const SINONIMOS: ReadonlyArray<readonly [RegExp, TipoEstudio]> = [
  [/\b(ecg|ekg|electrocardiograma)\b/i, 'ECG'],
  [/\becocardiograma|ecocardiografia|ecocardiografía\b/i, 'ECOCARDIOGRAMA'],
  [/\b(rx|radiografia|radiografía)\b.*\b(torax|tórax)\b/i, 'RADIOGRAFIA_TORAX'],
  [/\bespirometr(ia|ía)\b/i, 'ESPIROMETRIA'],
];

export function canonicalEstudio(impreso: string | null | undefined): TipoEstudio {
  const s = String(impreso ?? '');
  for (const [re, tipo] of SINONIMOS) if (re.test(s)) return tipo;
  return 'OTRO';
}

/** Un estudio tal como está guardado, sin depender del cliente de Prisma. */
export interface EstudioParaProsa {
  tipo: string;
  tipoRaw?: string | null;
  ritmo?: string | null;
  frecuencia?: string | null;
  intervalos?: string | null;
  conclusion?: string | null;
  hallazgos?: string | null;
  institucion?: string | null;
  collectedAt?: Date | string | null;
  reportDate?: Date | string | null;
  sourceRef: string;
  estadoExtraccion?: string;
}

function fecha(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  const d = typeof v === 'string' ? new Date(v) : v;
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Prosa de un estudio, campo a campo, sin añadir una palabra que el informe no diga.
 *
 * Un estudio sin ningún campo legible devuelve `null`: una fila que sólo dice
 * "Electrocardiograma." no le aporta nada al médico y sugiere que se leyó algo.
 */
export function describirEstudio(e: EstudioParaProsa): string | null {
  const tipo = (TIPOS_ESTUDIO as readonly string[]).includes(e.tipo)
    ? (e.tipo as TipoEstudio)
    : 'OTRO';
  const partes: string[] = [];
  if (e.ritmo) partes.push(`ritmo ${e.ritmo}`);
  if (e.frecuencia) partes.push(`frecuencia ${e.frecuencia}`);
  if (e.intervalos) partes.push(`intervalos ${e.intervalos}`);
  if (e.hallazgos) partes.push(e.hallazgos.trim());
  if (partes.length === 0 && !e.conclusion) return null;

  const cuerpo = partes.length > 0 ? `${partes.join('; ')}.` : '';
  const concl = e.conclusion ? ` Conclusión: ${e.conclusion.trim().replace(/\.$/, '')}.` : '';
  const cuando = fecha(e.collectedAt) ?? fecha(e.reportDate);
  const cabecera = e.tipoRaw?.trim() || NOMBRE_ESTUDIO[tipo];
  const meta = [cuando ? `del ${cuando}` : null, e.institucion?.trim() || null]
    .filter(Boolean)
    .join(', ');

  return `${cabecera}${meta ? ` (${meta})` : ''}: ${cuerpo}${concl}`.replace(/\s+/g, ' ').trim();
}

export interface EstudioAgrupado {
  clave: string;
  texto: string;
  fuentes: string[];
  /** Un estudio pendiente de confirmación se muestra, pero dice que lo está. */
  pendiente: boolean;
}

/**
 * Agrupa por tipo para el documento. Varios ECG del mismo paciente van en una sola entrada,
 * ordenados del más reciente al más antiguo — la comparación entre dos ECG es del médico, así
 * que se le entregan los dos, no un veredicto.
 */
export function agruparEstudios(estudios: readonly EstudioParaProsa[]): EstudioAgrupado[] {
  const porTipo = new Map<string, EstudioParaProsa[]>();
  for (const e of estudios) {
    const tipo = (TIPOS_ESTUDIO as readonly string[]).includes(e.tipo) ? e.tipo : 'OTRO';
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), e]);
  }

  const out: EstudioAgrupado[] = [];
  for (const [tipo, lista] of porTipo) {
    const ordenados = [...lista].sort((a, b) =>
      (fecha(b.collectedAt) ?? fecha(b.reportDate) ?? '').localeCompare(
        fecha(a.collectedAt) ?? fecha(a.reportDate) ?? '',
      ),
    );
    const frases = ordenados.map(describirEstudio).filter((f): f is string => f != null);
    if (frases.length === 0) continue;
    out.push({
      clave: CLAVE_ESTUDIO[tipo as TipoEstudio],
      texto: frases.join(' '),
      fuentes: [...new Set(ordenados.map((e) => e.sourceRef).filter(Boolean))],
      pendiente: ordenados.some((e) => e.estadoExtraccion === 'PENDIENTE_CONFIRMACION'),
    });
  }
  return out.sort((a, b) => a.clave.localeCompare(b.clave));
}
