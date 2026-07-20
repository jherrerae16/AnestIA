import { describe, it, expect } from 'vitest';
import { is48hAlert } from './calendar.service';

/**
 * Regla de alerta <48h: la cirugía es en menos de 48 horas y el caso NO está aprobado/entregado.
 * Es un cálculo sobre datos reales (no inventa nada), por eso es función pura y se prueba directo.
 */
describe('is48hAlert', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  const enHoras = (h: number) => new Date(now.getTime() + h * 3600_000);

  it('cirugía en 24h sin aprobar → ALERTA', () => {
    expect(is48hAlert(enHoras(24), 'PENDIENTE_REVISION', now)).toBe(true);
  });

  it('cirugía en 24h pero APROBADO → sin alerta', () => {
    expect(is48hAlert(enHoras(24), 'APROBADO', now)).toBe(false);
  });

  it('cirugía en 24h pero ENTREGADO → sin alerta', () => {
    expect(is48hAlert(enHoras(24), 'ENTREGADO', now)).toBe(false);
  });

  it('cirugía en 72h sin aprobar → sin alerta (fuera de ventana)', () => {
    expect(is48hAlert(enHoras(72), 'BORRADOR_GENERADO', now)).toBe(false);
  });

  it('justo en el límite de 48h → alerta', () => {
    expect(is48hAlert(enHoras(48), 'PENDIENTE_REVISION', now)).toBe(true);
  });

  it('borde: 48h + 1min → sin alerta', () => {
    expect(is48hAlert(new Date(now.getTime() + 48 * 3600_000 + 60_000), 'PENDIENTE_REVISION', now)).toBe(false);
  });

  it('cirugía de hoy más temprano (pasada hace pocas horas) sin aprobar → alerta', () => {
    expect(is48hAlert(enHoras(-6), 'PENDIENTE_REVISION', now)).toBe(true);
  });
});
