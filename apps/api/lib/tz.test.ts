import { describe, it, expect } from 'vitest';
import { bogotaDateStamp, bogotaISODate, bogotaDayRange, bogotaParts } from './tz';

/**
 * Colombia es UTC-5 fijo (sin DST). Lo crítico: una cirugía guardada a las 00:00Z del día 22
 * es todavía el 21 por la tarde en Bogotá, y el evento all-day debe salir con el día correcto.
 */
describe('tz — hora de Bogotá (UTC-5)', () => {
  it('un instante de mediodía UTC cae el mismo día en Bogotá', () => {
    const d = new Date('2026-07-22T12:00:00Z'); // 07:00 Bogotá
    expect(bogotaDateStamp(d)).toBe('20260722');
    expect(bogotaISODate(d)).toBe('2026-07-22');
  });

  it('medianoche UTC pertenece al día ANTERIOR en Bogotá', () => {
    const d = new Date('2026-07-22T00:00:00Z'); // 19:00 del 21 en Bogotá
    expect(bogotaDateStamp(d)).toBe('20260721');
    expect(bogotaParts(d)).toEqual({ year: 2026, month: 7, day: 21 });
  });

  it('05:00 UTC es exactamente la medianoche de Bogotá (cambia el día)', () => {
    expect(bogotaISODate(new Date('2026-07-22T04:59:00Z'))).toBe('2026-07-21');
    expect(bogotaISODate(new Date('2026-07-22T05:00:00Z'))).toBe('2026-07-22');
  });

  it('bogotaDayRange cubre un día natural de Bogotá expresado en UTC', () => {
    const anchor = new Date('2026-07-22T15:00:00Z'); // 10:00 Bogotá del 22
    const { from, to } = bogotaDayRange(anchor, 1);
    // 00:00 Bogotá del 22 = 05:00Z del 22; fin = 05:00Z del 23.
    expect(from.toISOString()).toBe('2026-07-22T05:00:00.000Z');
    expect(to.toISOString()).toBe('2026-07-23T05:00:00.000Z');
  });

  it('bogotaDayRange con days=2 cubre hoy y mañana', () => {
    const { from, to } = bogotaDayRange(new Date('2026-07-22T15:00:00Z'), 2);
    expect(from.toISOString()).toBe('2026-07-22T05:00:00.000Z');
    expect(to.toISOString()).toBe('2026-07-24T05:00:00.000Z');
  });
});
