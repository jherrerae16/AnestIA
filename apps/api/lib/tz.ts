/**
 * Zona horaria Colombia (America/Bogota). Offset fijo UTC-5, sin horario de verano —
 * por eso la aritmética es una resta constante y no necesitamos librería de fechas.
 *
 * Toda la app clínica venía usando `new Date()` crudo; el calendario y el recordatorio
 * matutino sí necesitan pensar en "el día del médico", que es el día en Bogotá, no en UTC.
 * Una cirugía guardada a las 00:00Z de un 22 es todavía el 21 por la tarde en Bogotá; sin
 * este ajuste el evento all-day saldría corrido un día.
 */

const BOGOTA_OFFSET_MIN = -5 * 60; // UTC-5, constante (Colombia no aplica DST)

/** Componentes de fecha (año/mes/día) de un instante, leídos en hora de Bogotá. */
export function bogotaParts(instant: Date): { year: number; month: number; day: number } {
  // Restar el offset a los ms UTC nos da un Date cuyos getters UTC representan la hora local.
  const shifted = new Date(instant.getTime() + BOGOTA_OFFSET_MIN * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Fecha en formato compacto YYYYMMDD en hora de Bogotá (para DTSTART;VALUE=DATE del ICS). */
export function bogotaDateStamp(instant: Date): string {
  const { year, month, day } = bogotaParts(instant);
  return `${year}${pad2(month)}${pad2(day)}`;
}

/** Fecha ISO corta YYYY-MM-DD en hora de Bogotá (para agrupar cirugías por día en el calendario). */
export function bogotaISODate(instant: Date): string {
  const { year, month, day } = bogotaParts(instant);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * La fecha de cirugía (procedureDate) es una FECHA PURA (día natural, sin hora real): se
 * guarda como `new Date('YYYY-MM-DD')` = medianoche UTC. Por eso se lee por sus componentes
 * UTC, NO desplazada a Bogotá — desplazarla la correría un día (la cirugía del 1 saldría el 31).
 */
export function pureDateISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Igual que pureDateISO pero compacto YYYYMMDD (para DTSTART;VALUE=DATE del ICS). */
export function pureDateStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/** Medianoche UTC del día natural `daysOffset` a partir de una fecha pura (para rangos de where). */
export function pureDayUTC(anchor: Date, daysOffset = 0): Date {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + daysOffset));
}

/**
 * Instante UTC correspondiente a la medianoche (00:00) de un día de Bogotá.
 * `daysOffset` desplaza el día (0 = ese mismo día, 1 = el siguiente).
 * Con esto se arma el `where` de Prisma sobre `procedureDate` sin confusiones de zona.
 */
export function bogotaMidnightUTC(year: number, month: number, day: number, daysOffset = 0): Date {
  // 00:00 en Bogotá = 05:00 UTC del mismo día natural.
  const utcMs = Date.UTC(year, month - 1, day + daysOffset, -BOGOTA_OFFSET_MIN / 60, 0, 0);
  return new Date(utcMs);
}

/** Rango [inicio, fin) que cubre `days` días naturales de Bogotá desde una fecha ancla (en UTC). */
export function bogotaDayRange(anchor: Date, days = 1): { from: Date; to: Date } {
  const { year, month, day } = bogotaParts(anchor);
  return {
    from: bogotaMidnightUTC(year, month, day, 0),
    to: bogotaMidnightUTC(year, month, day, days),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
