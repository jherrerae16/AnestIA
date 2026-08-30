import { canonicalAnalyte, parseNumeric } from './lab';

/**
 * Tendencia de resultados sucesivos.
 *
 * Especificación §16: *"Conservar todos los resultados y marcar el más reciente clínicamente
 * pertinente… Presentar tendencia cuando existan resultados sucesivos sin sobrescribir el
 * documento fuente."*
 *
 * El valor clínico está en el cambio, no sólo en el último número: una hemoglobina de 9.8 que
 * viene de 14 en dos semanas es una historia distinta de una que lleva un año en 9.8. El
 * documento sólo mostraba el más reciente.
 *
 * Aquí no se interpreta nada: se ordena, se calcula la diferencia y se dice de cuántos días es.
 * Si un descenso es relevante lo decide el anestesiólogo.
 */

export interface PuntoSerie {
  /** Valor numérico ya normalizado. */
  valor: number;
  unidad: string | null;
  /** Fecha del informe (AAAA-MM-DD). Sin fecha no entra en la serie. */
  fecha: string;
  /** Referencia al informe del que salió. Sin ella el punto no es citable (CS2). */
  sourceRef: string | null;
}

export interface Tendencia {
  /** Analito canónico. */
  analito: string;
  unidad: string | null;
  /** Serie ordenada de más antiguo a más reciente. */
  serie: readonly PuntoSerie[];
  /** El más reciente. */
  actual: number;
  /** El inmediatamente anterior, si lo hay. */
  previo: number | null;
  /** Diferencia absoluta respecto al previo. `null` con un solo resultado. */
  delta: number | null;
  /** Variación porcentual respecto al previo. */
  deltaPct: number | null;
  /** Días entre el previo y el actual. */
  dias: number | null;
  /**
   * Informe del que salió el valor previo. La nota de evolución cita una cifra que ya no está
   * en la prosa, así que sin esto quedaría un número sin procedencia (CS2).
   */
  previoSourceRef: string | null;
  direccion: 'sube' | 'baja' | 'estable' | 'sin_previo';
}

/** Un resultado tal como está guardado, sin depender del cliente de Prisma. */
export interface ResultadoParaSerie {
  analyte: string;
  value: string;
  unit?: string | null;
  reportDate?: Date | string | null;
  collectedAt?: Date | string | null;
  sourceRef?: string | null;
}

function aISO(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  const d = typeof v === 'string' ? new Date(v) : v;
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Umbral por debajo del cual un cambio se considera estable.
 *
 * 5 % es deliberadamente conservador: por debajo de eso, la variación suele ser ruido de método
 * entre laboratorios distintos, y marcar como "baja" una hemoglobina que pasó de 13.0 a 12.9
 * sería añadir alarma sin información.
 */
const UMBRAL_ESTABLE_PCT = 5;

/**
 * Series por analito, para los que tengan más de un resultado fechado.
 *
 * Un analito con un solo resultado NO produce tendencia: no hay nada que comparar, y fabricar
 * una serie de un punto invita a leer un cambio donde no lo hay.
 */
export function calcularTendencias(resultados: readonly ResultadoParaSerie[]): Tendencia[] {
  const porAnalito = new Map<string, { unidad: string | null; puntos: PuntoSerie[] }>();

  for (const r of resultados) {
    const canon = canonicalAnalyte(r.analyte) ?? r.analyte;
    // La fecha de TOMA manda sobre la de emisión: es cuando el paciente estaba así.
    const fecha = aISO(r.collectedAt) ?? aISO(r.reportDate);
    const valor = parseNumeric(r.value);
    if (fecha == null || valor == null) continue;

    const entrada = porAnalito.get(canon) ?? { unidad: r.unit ?? null, puntos: [] };
    entrada.puntos.push({ valor, unidad: r.unit ?? null, fecha, sourceRef: r.sourceRef ?? null });
    porAnalito.set(canon, entrada);
  }

  const out: Tendencia[] = [];
  for (const [analito, { unidad, puntos }] of porAnalito) {
    // Un punto por fecha: dos lecturas del mismo día son el mismo informe repetido.
    const unicos = [...new Map(puntos.map((p) => [p.fecha, p])).values()].sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );
    if (unicos.length < 2) continue;

    const actual = unicos[unicos.length - 1]!;
    const previo = unicos[unicos.length - 2]!;
    const delta = actual.valor - previo.valor;
    const deltaPct = previo.valor === 0 ? null : (delta / Math.abs(previo.valor)) * 100;
    const dias = Math.round(
      (new Date(actual.fecha).getTime() - new Date(previo.fecha).getTime()) / 86_400_000,
    );

    const direccion: Tendencia['direccion'] =
      deltaPct == null || Math.abs(deltaPct) < UMBRAL_ESTABLE_PCT
        ? 'estable'
        : delta > 0
          ? 'sube'
          : 'baja';

    out.push({
      analito,
      unidad: actual.unidad ?? unidad,
      serie: unicos,
      actual: actual.valor,
      previo: previo.valor,
      delta: Math.round(delta * 100) / 100,
      deltaPct: deltaPct == null ? null : Math.round(deltaPct * 10) / 10,
      dias,
      previoSourceRef: previo.sourceRef,
      direccion,
    });
  }
  return out.sort((a, b) => a.analito.localeCompare(b.analito));
}

/** Frase corta para el documento: "13.9 → 9.8 g/dL en 21 días (−29.5 %)". */
export function describirTendencia(t: Tendencia): string {
  const u = t.unidad ? ` ${t.unidad}` : '';
  const pct = t.deltaPct == null ? '' : ` (${t.deltaPct > 0 ? '+' : ''}${t.deltaPct} %)`;
  const lapso = t.dias == null ? '' : ` en ${t.dias} día${t.dias === 1 ? '' : 's'}`;
  return `${t.previo} → ${t.actual}${u}${lapso}${pct}`;
}

/**
 * Sólo el resultado más reciente de cada analito, para la prosa del documento.
 *
 * §16: *"Conservar todos los resultados y marcar el más reciente clínicamente pertinente."* Los
 * anteriores **no se pierden** —siguen en la base y sustentan la tendencia— pero listarlos todos
 * en la prosa produce "Hemoglobina 13.9 g/dL; Hemoglobina 9.8 g/dL", que se lee como dos
 * analitos distintos en vez de una caída.
 *
 * Si algún resultado de un analito no tiene fecha, se conservan **todos** los suyos: sin fecha no
 * hay forma de saber cuál es el más reciente, y elegir uno al azar es peor que mostrar los dos.
 */
export function soloMasReciente<T extends ResultadoParaSerie>(resultados: readonly T[]): T[] {
  const porAnalito = new Map<string, T[]>();
  for (const r of resultados) {
    const canon = canonicalAnalyte(r.analyte) ?? r.analyte;
    porAnalito.set(canon, [...(porAnalito.get(canon) ?? []), r]);
  }

  const out: T[] = [];
  for (const lista of porAnalito.values()) {
    const fechas = lista.map((r) => aISO(r.collectedAt) ?? aISO(r.reportDate));
    if (lista.length === 1 || fechas.some((f) => f == null)) {
      out.push(...lista);
      continue;
    }
    let mejor = 0;
    for (let i = 1; i < lista.length; i++) if (fechas[i]! > fechas[mejor]!) mejor = i;
    out.push(lista[mejor]!);
  }
  // Se conserva el orden de entrada: la prosa agrupa por tipo de estudio y ese orden importa.
  return resultados.filter((r) => out.includes(r));
}
