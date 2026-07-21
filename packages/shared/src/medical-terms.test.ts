import { describe, it, expect } from 'vitest';
import { toMedicalTerms, medicalTerm, isAmbiguousProcedure } from './medical-terms';

describe('isAmbiguousProcedure — "operación de <parte>" no elige cirugía (guardarraíl)', () => {
  it('AMBIGUO: operación de una parte con varias cirugías posibles → true', () => {
    expect(isAmbiguousProcedure('operación de la nariz')).toBe(true);
    expect(isAmbiguousProcedure('operacion del corazon')).toBe(true);
    expect(isAmbiguousProcedure('cirugía de la rodilla')).toBe(true);
    expect(isAmbiguousProcedure('operación de la espalda')).toBe(true);
    expect(isAmbiguousProcedure('intervención en el ojo')).toBe(true);
    expect(isAmbiguousProcedure('OPERACIÓN DE LA NARIZ')).toBe(true); // mayúsculas/tildes
  });

  it('UNÍVOCO: órgano cuya cirugía es única → false (se puede traducir)', () => {
    expect(isAmbiguousProcedure('operación de la vesícula')).toBe(false);
    expect(isAmbiguousProcedure('operación de apendicitis')).toBe(false);
  });

  it('término ya específico → false (no es "operación de <parte>")', () => {
    expect(isAmbiguousProcedure('Rinoplastia')).toBe(false);
    expect(isAmbiguousProcedure('Colecistectomía laparoscópica')).toBe(false);
    expect(isAmbiguousProcedure('lipo')).toBe(false);
    expect(isAmbiguousProcedure('apendicitis')).toBe(false);
  });

  it('vacío o nulo → false', () => {
    expect(isAmbiguousProcedure('')).toBe(false);
    expect(isAmbiguousProcedure(null)).toBe(false);
    expect(isAmbiguousProcedure(undefined)).toBe(false);
  });
});

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
