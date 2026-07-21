import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { flagLab, parseRefRange, canonicalAnalyte, parseNumeric } from './lab';
import { detectGLP1 } from './glp1';

describe('parseRefRange — formatos de laboratorios colombianos', () => {
  it('rango con guion normal', () => {
    expect(parseRefRange('12.0 - 17.0')).toEqual({ min: 12, max: 17, qualitative: false });
  });
  it('guion largo (–) y coma decimal', () => {
    expect(parseRefRange('12,0 – 17,0')).toEqual({ min: 12, max: 17, qualitative: false });
  });
  it('unidades pegadas al rango', () => {
    expect(parseRefRange('12.0-17.0 g/dL')).toEqual({ min: 12, max: 17, qualitative: false });
  });
  it('miles y decimales ("140 - 400")', () => {
    expect(parseRefRange('140 - 400')).toEqual({ min: 140, max: 400, qualitative: false });
  });
  it('solo tope superior: "< 200" / "Hasta 200" / "menor a 200"', () => {
    expect(parseRefRange('< 200')).toEqual({ min: null, max: 200, qualitative: false });
    expect(parseRefRange('Hasta 200')).toEqual({ min: null, max: 200, qualitative: false });
    expect(parseRefRange('menor a 200')).toEqual({ min: null, max: 200, qualitative: false });
  });
  it('solo piso inferior: "> 40" / "Mayor a 40"', () => {
    expect(parseRefRange('> 40')).toEqual({ min: 40, max: null, qualitative: false });
    expect(parseRefRange('Mayor a 40')).toEqual({ min: 40, max: null, qualitative: false });
  });
  it('cualitativo: "Negativo" / "No reactivo"', () => {
    expect(parseRefRange('Negativo')?.qualitative).toBe(true);
    expect(parseRefRange('No reactivo')?.qualitative).toBe(true);
  });
  it('ilegible o vacío → null (fail-visible, nunca umbral)', () => {
    expect(parseRefRange('')).toBeNull();
    expect(parseRefRange(null)).toBeNull();
    expect(parseRefRange('ver observaciones')).toBeNull();
  });
});

describe('flagLab — usa el rango impreso en el examen, sin umbrales hardcodeados', () => {
  it('valor DENTRO del rango impreso → NORMAL', () => {
    expect(flagLab('12.0 - 17.0', '15.9')).toEqual({ flag: 'NORMAL', rangeUnparsed: false });
  });
  it('valor BAJO el mínimo → ALERTA', () => {
    expect(flagLab('12.0 - 17.0', '10.3')).toEqual({ flag: 'ALERTA', rangeUnparsed: false });
  });
  it('valor SOBRE el máximo → ALERTA (caso que el hardcode daba NORMAL: Eosinofilos)', () => {
    expect(flagLab('0.70 - 5.80', '6.20')).toEqual({ flag: 'ALERTA', rangeUnparsed: false });
  });
  it('"< 200" con valor por debajo → NORMAL; por encima → ALERTA', () => {
    expect(flagLab('< 200', '150').flag).toBe('NORMAL');
    expect(flagLab('< 200', '260').flag).toBe('ALERTA');
  });
  it('rango cualitativo → NORMAL sin comparar', () => {
    expect(flagLab('Negativo', 'Negativo')).toEqual({ flag: 'NORMAL', rangeUnparsed: false });
  });
  it('rango ilegible → NORMAL + rangeUnparsed (aviso visible, no umbral)', () => {
    expect(flagLab('ver observaciones', '5.0')).toEqual({ flag: 'NORMAL', rangeUnparsed: true });
    expect(flagLab(null, '5.0')).toEqual({ flag: 'NORMAL', rangeUnparsed: true });
  });
  it('valor no numérico con rango numérico → NORMAL', () => {
    expect(flagLab('12 - 17', 'sin dato')).toEqual({ flag: 'NORMAL', rangeUnparsed: false });
  });
  it('DETERMINISTA (PBT): mismo input → mismo output', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 300, noNaN: true }), (v) => {
        expect(flagLab('50 - 100', v)).toEqual(flagLab('50 - 100', v));
      }),
    );
  });
});

describe('canonicalAnalyte / parseNumeric', () => {
  it('sinónimos → canónico', () => {
    expect(canonicalAnalyte('HB')).toBe('Hemoglobina');
    expect(canonicalAnalyte('Hgb')).toBe('Hemoglobina');
    expect(canonicalAnalyte('desconocido')).toBeNull();
  });
  // Nombres tal como los devuelve la extracción del informe real del piloto. Con igualdad
  // exacta no se reconocían y flagLab los daba por NORMAL sin evaluarlos (CS1).
  it('reconoce los nombres largos de los informes reales', () => {
    expect(canonicalAnalyte('CREATININA EN SUERO (SERICA)')).toBe('Creatinina');
    expect(canonicalAnalyte('RECUENTO TOTAL DE PLAQUETAS')).toBe('Plaquetas');
    expect(canonicalAnalyte('RECUENTO DE LEUCOCITOS')).toBe('Leucocitos');
    expect(canonicalAnalyte('GLICEMIA')).toBe('Glucemia');
  });

  it('no confunde analitos que comparten palabra', () => {
    expect(canonicalAnalyte('CREATININA ORINA')).toBeNull(); // no es la creatinina sérica
    expect(canonicalAnalyte('RELACION ALBUMINA / CREATININA')).toBeNull(); // cociente urinario
    expect(canonicalAnalyte('Leucocitos (sedimento)')).toBeNull(); // uroanálisis, no hemograma
    expect(canonicalAnalyte('LEUCOCITOS/ESTEARASA')).toBeNull();
    expect(canonicalAnalyte('HEMOGLOBINA CORPUSCULAR MEDIA (MCH)')).toBeNull();
  });

  it('parseNumeric tolera unidades y miles', () => {
    expect(parseNumeric('15.9 g/dL')).toBe(15.9);
    expect(parseNumeric('244.000')).toBe(244000);
    expect(parseNumeric('sin dato')).toBeNull();
  });
});

describe('detectGLP1 (PBT invariant)', () => {
  it('detecta cualquier fármaco de la lista (case/acentos-insensible)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('semaglutida', 'Ozempic', 'MOUNJARO', 'tirzepatida'),
        fc.string(),
        (drug, noise) => {
          expect(detectGLP1(`${noise} ${drug} ${noise}`).declared).toBe(true);
        },
      ),
    );
  });
  it('sin GLP-1 → declared false', () => {
    expect(detectGLP1('losartán y metformina').declared).toBe(false);
    expect(detectGLP1(null).declared).toBe(false);
  });
});
