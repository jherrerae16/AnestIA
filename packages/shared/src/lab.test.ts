import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { flagLab, canonicalAnalyte, parseNumeric } from './lab';
import { detectGLP1 } from './glp1';

describe('flagLab — determinismo + monotonicidad (PBT)', () => {
  it('DETERMINISTA: mismo input → mismo output', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 300, noNaN: true }), (v) => {
        expect(flagLab('Glucemia', v, null)).toBe(flagLab('Glucemia', v, null));
      }),
    );
  });

  it('MONÓTONA (Glucemia): mayor valor ⇒ severidad ≥', () => {
    const sev = { NORMAL: 0, ALERTA: 1, CRITICO: 2 } as const;
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 400, noNaN: true }),
        fc.float({ min: 0, max: 400, noNaN: true }),
        (a, b) => {
          const lo = Math.min(a, b), hi = Math.max(a, b);
          expect(sev[flagLab('Glucemia', hi, null)]).toBeGreaterThanOrEqual(sev[flagLab('Glucemia', lo, null)]);
        },
      ),
    );
  });

  it('analito desconocido → NORMAL (BR-2.5)', () => {
    expect(flagLab('Vitamina Q', 999, null)).toBe('NORMAL');
  });

  it('ejemplos clínicos', () => {
    expect(flagLab('Hemoglobina', 11.5, 'FEMENINO')).toBe('ALERTA'); // anemia ♀
    expect(flagLab('Hemoglobina', 15.9, 'MASCULINO')).toBe('NORMAL');
    expect(flagLab('Plaquetas', 90000, null)).toBe('CRITICO');
    expect(flagLab('Plaquetas', 244000, null)).toBe('NORMAL');
    expect(flagLab('Glucemia', 260, null)).toBe('CRITICO');
    expect(flagLab('INR', 1.6, null)).toBe('ALERTA');
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

  it('un valor alterado con nombre largo SÍ dispara la alerta', () => {
    expect(flagLab('RECUENTO TOTAL DE PLAQUETAS', '85', null)).toBe('CRITICO');
    expect(flagLab('CREATININA EN SUERO (SERICA)', '2.4', null)).toBe('ALERTA');
    expect(flagLab('GLICEMIA', '310', null)).toBe('CRITICO');
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
