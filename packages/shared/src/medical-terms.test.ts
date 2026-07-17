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

  // CS2: el procedimiento no se adivina por coincidencia de letras. Con `includes` a secas,
  // "lipoma" (tumor benigno) contenía "lipo" y salía "Liposucción" en el documento firmado.
  describe('coincide por palabra, no por substring', () => {
    it('no traduce palabras que sólo CONTIENEN un término', () => {
      expect(medicalTerm('lipoma')).toBe('Lipoma');
      expect(medicalTerm('plasma rico en plaquetas')).toBe('Plasma rico en plaquetas');
      expect(medicalTerm('colonoscopia')).toBe('Colonoscopia');
    });

    it('sigue traduciendo el término real, solo o en frase', () => {
      expect(medicalTerm('lipo')).toBe('Liposucción');
      expect(medicalTerm('me van a hacer una lipo')).toBe('Liposucción');
      expect(medicalTerm('lipoescultura')).toBe('Liposucción');
      expect(medicalTerm('me van a operar la vesícula')).toBe('Colecistectomía');
    });

    it('lo no reconocido se marca como unresolved en vez de adivinarse', () => {
      expect(toMedicalTerms('lipoma').unresolved).toContain('lipoma');
    });
  });
});
