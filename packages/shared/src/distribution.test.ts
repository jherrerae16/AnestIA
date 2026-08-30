import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildDeliveryEmail, prefillFromPatient } from './distribution';

describe('buildDeliveryEmail (PBT)', () => {
  it('DETERMINISTA + incluye el enlace de descarga', () => {
    fc.assert(
      fc.property(fc.webUrl(), fc.string({ minLength: 1, maxLength: 40 }), (url, name) => {
        const a = buildDeliveryEmail({ patientName: name, doctorName: 'Dr. X', downloadUrl: url });
        const b = buildDeliveryEmail({ patientName: name, doctorName: 'Dr. X', downloadUrl: url });
        expect(a).toEqual(b);
        expect(a.html).toContain(url.replace(/&/g, '&amp;'));
      }),
    );
  });
});

describe('prefillFromPatient (PBT round-trip)', () => {
  it('precarga = datos base del paciente', () => {
    const p = { fullName: 'Ana', documentId: '123', sexAtBirth: 'MUJER', insurer: 'Sura', bloodType: 'O+' };
    const pre = prefillFromPatient(p);
    expect(pre['ID01']).toBe('Ana');
    expect(pre['ID02']).toBe('123');
    expect(pre['ID09']).toBe('O+');
  });
  it('omite campos ausentes', () => {
    const pre = prefillFromPatient({ fullName: 'X', documentId: '9' });
    expect(pre['ID06']).toBeUndefined();
  });
});
