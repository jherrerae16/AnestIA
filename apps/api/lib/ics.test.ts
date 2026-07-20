import { describe, it, expect } from 'vitest';
import { buildSurgeryIcs, icsFilename, type SurgeryEvent } from './ics';

const base: SurgeryEvent = {
  caseId: 'c123',
  patientName: 'Juan Pérez',
  procedure: 'Colecistectomía',
  insurer: 'Sura',
  date: new Date('2026-07-22T12:00:00Z'), // 07:00 Bogotá → día 22
  caseUrl: 'https://anestia.test/cases/c123/review',
  now: new Date('2026-07-20T13:00:00Z'),
};

describe('buildSurgeryIcs', () => {
  it('genera un VEVENT all-day con la fecha de Bogotá', () => {
    const ics = buildSurgeryIcs(base);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260722');
    expect(ics).toContain('DURATION:P1D');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('UID estable por caso (re-descargar reemplaza, no duplica)', () => {
    expect(buildSurgeryIcs(base)).toContain('UID:caso-c123@anestia');
  });

  it('usa CRLF entre líneas (RFC 5545)', () => {
    expect(buildSurgeryIcs(base)).toContain('\r\n');
  });

  it('incluye el disclaimer no técnico en la descripción', () => {
    // El plegado RFC 5545 puede partir líneas largas con CRLF + espacio; se comparan
    // sin esos saltos para verificar el texto lógico.
    const unfolded = buildSurgeryIcs(base).replace(/\r\n /g, '');
    expect(unfolded).toContain(
      'Este evento es una copia. Si cambia la fecha\\, vuelve a añadir el evento actualizado.',
    );
  });

  it('escapa comas, punto y coma y backslash del texto', () => {
    const ics = buildSurgeryIcs({
      ...base,
      procedure: 'Cirugía; con, símbolos \\ raros',
      patientName: 'Ana, María',
    });
    expect(ics).toContain('\\;');
    expect(ics).toContain('\\,');
    expect(ics).toContain('\\\\');
  });

  it('sin aseguradora ni procedimiento usa marcadores, no revienta', () => {
    const ics = buildSurgeryIcs({ ...base, procedure: null, insurer: null });
    expect(ics).toContain('Aseguradora: Sin especificar');
    expect(ics).toContain('Procedimiento: Sin especificar');
    expect(ics).toContain('SUMMARY:Cirugía — Juan Pérez — Procedimiento');
  });

  it('DTSTAMP en UTC compacto', () => {
    expect(buildSurgeryIcs(base)).toContain('DTSTAMP:20260720T130000Z');
  });
});

describe('icsFilename', () => {
  it('slug ASCII del nombre del paciente', () => {
    expect(icsFilename('Juan Pérez')).toBe('cirugia-juan-perez.ics');
  });
  it('nombre vacío → fallback', () => {
    expect(icsFilename('  ')).toBe('cirugia-cirugia.ics');
  });
});
