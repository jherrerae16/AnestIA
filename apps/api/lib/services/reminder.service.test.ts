import { describe, it, expect } from 'vitest';
import { buildReminderHtml, buildSubject } from './reminder.service';
import type { CalendarCase } from './calendar.service';

const caso = (over: Partial<CalendarCase> = {}): CalendarCase => ({
  caseId: 'c1',
  patientName: 'Juan Pérez',
  procedure: 'Colecistectomía',
  status: 'PENDIENTE_REVISION',
  date: '2026-07-20',
  procedureDate: '2026-07-20T12:00:00.000Z',
  alerta48h: false,
  ...over,
});

describe('buildSubject', () => {
  it('cuenta hoy y mañana', () => {
    expect(buildSubject([caso()], [caso(), caso()])).toBe('Cirugías: 1 hoy, 2 mañana');
  });

  it('destaca las pendientes <48h', () => {
    const s = buildSubject([caso({ alerta48h: true })], []);
    expect(s).toContain('⚠');
    expect(s).toContain('1 sin aprobar <48h');
  });
});

describe('buildReminderHtml', () => {
  const origin = 'https://anestia.test';

  it('incluye deep-link al caso', () => {
    const html = buildReminderHtml({ nombre: 'Dr. Luquetta', hoy: [caso()], manana: [], origin });
    expect(html).toContain('https://anestia.test/cases/c1/review');
    expect(html).toContain('Juan Pérez');
  });

  it('muestra el bloque de alerta cuando hay cirugías <48h sin aprobar', () => {
    const html = buildReminderHtml({ nombre: 'Dr. Luquetta', hoy: [caso({ alerta48h: true })], manana: [], origin });
    expect(html).toContain('menos de 48 horas sin valoración aprobada');
    expect(html).toContain('&lt;48h sin aprobar');
  });

  it('sin alertas no muestra el bloque rojo', () => {
    const html = buildReminderHtml({ nombre: 'Dr. Luquetta', hoy: [caso()], manana: [], origin });
    expect(html).not.toContain('menos de 48 horas sin valoración aprobada');
  });

  it('sección vacía dice "Sin cirugías"', () => {
    const html = buildReminderHtml({ nombre: 'Dr. Luquetta', hoy: [caso()], manana: [], origin });
    expect(html).toContain('Sin cirugías.'); // mañana vacío
  });

  it('escapa HTML del nombre del paciente', () => {
    const html = buildReminderHtml({ nombre: 'X', hoy: [caso({ patientName: '<script>' })], manana: [], origin });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
