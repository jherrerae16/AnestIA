import { describe, it, expect } from 'vitest';
import { toMedicalTerms, medicalTerm } from './medical-terms';

describe('toMedicalTerms — coloquial → médico', () => {
  it('traduce términos comunes', () => {
    expect(medicalTerm('lipo')).toBe('Liposucción');
    expect(medicalTerm('cesarea')).toBe('Cesárea');
    expect(medicalTerm('sacar muela')).toBe('Exodoncia');
    expect(medicalTerm('apendice')).toBe('Apendicectomía');
    expect(medicalTerm('tabique')).toBe('Septoplastia');
  });

  it('traduce listas separadas por coma o "y"', () => {
    expect(medicalTerm('lipo y cesarea')).toBe('Liposucción, Cesárea');
    expect(medicalTerm('nariz, muela')).toBe('Rinoplastia, Exodoncia');
  });

  it('preserva modificadores de abordaje', () => {
    expect(medicalTerm('apendice laparoscopica')).toBe('Apendicectomía laparoscópica');
  });

  it('capitaliza y marca lo no reconocido', () => {
    const r = toMedicalTerms('procedimiento raro xyz');
    expect(r.text).toBe('Procedimiento raro xyz');
    expect(r.unresolved).toContain('procedimiento raro xyz');
  });

  it('devuelve null para vacío', () => {
    expect(medicalTerm('')).toBeNull();
    expect(medicalTerm(null)).toBeNull();
  });
});
