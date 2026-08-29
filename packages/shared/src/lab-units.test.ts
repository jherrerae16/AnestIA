import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  convertirUnidad, normalizeUnidad, tieneReglas, reglasConNombreNoCanonico, REGLAS,
} from './lab-units';

/**
 * La regla que la Especificación §15 subraya: *"Convertir unidades solo con reglas validadas y
 * conservar siempre el valor original"*.
 */

describe('convertirUnidad', () => {
  it('conserva SIEMPRE el valor y la unidad originales', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Hemoglobina', 'Creatinina', 'Plaquetas', 'Glucosa', 'Cosa rara'),
        fc.constantFrom('15.9', '0,9', '244000', 'ilegible', ''),
        fc.constantFrom('g/dL', 'g/L', 'µmol/L', '/uL', 'unidad-rara', null),
        (analito, valor, unidad) => {
          const c = convertirUnidad(analito, valor, unidad);
          expect(c.valueRaw).toBe(valor);
          expect(c.unitRaw).toBe(unidad ?? null);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('convierte hemoglobina de g/L a g/dL', () => {
    const c = convertirUnidad('Hemoglobina', '159', 'g/L');
    expect(c.value).toBe('15.9');
    expect(c.unit).toBe('g/dL');
    expect(c.valueRaw).toBe('159');
    expect(c.unitRaw).toBe('g/L');
    expect(c.conversionRule).toMatch(/g\/l → g\/dL/);
  });

  it('convierte creatinina de µmol/L a mg/dL', () => {
    const c = convertirUnidad('Creatinina', '88.4', 'µmol/L');
    expect(Number(c.value)).toBeCloseTo(1.0, 2);
    expect(c.unit).toBe('mg/dL');
  });

  it('NO convierte cuando no hay regla validada: deja el original intacto', () => {
    // Adivinar un factor es peor que no convertir: cambiaría una anemia por una policitemia.
    const c = convertirUnidad('Hemoglobina', '15.9', 'unidad-inventada');
    expect(c.value).toBe('15.9');
    expect(c.unit).toBe('unidad-inventada');
    expect(c.conversionRule).toBeNull();
  });

  it('no convierte un analito sin reglas', () => {
    const c = convertirUnidad('Fibrinógeno', '300', 'mg/dL');
    expect(c.conversionRule).toBeNull();
    expect(c.value).toBe('300');
  });

  it('no convierte un valor ilegible', () => {
    const c = convertirUnidad('Hemoglobina', 'no legible', 'g/L');
    expect(c.value).toBe('no legible');
    expect(c.conversionRule).toBeNull();
  });

  it('tolera la coma decimal colombiana', () => {
    const c = convertirUnidad('Glucosa', '5,5', 'mmol/L');
    expect(Number(c.value)).toBeCloseTo(99.1, 1);
  });

  it('normaliza la unidad antes de comparar (µ, mayúsculas, espacios)', () => {
    expect(normalizeUnidad('µmol / L')).toBe('umol/l');
    expect(normalizeUnidad('G/L')).toBe('g/l');
    expect(convertirUnidad('Creatinina', '88.4', 'UMOL/L').conversionRule).not.toBeNull();
  });

  it('la conversión es reversible dentro del margen de redondeo', () => {
    fc.assert(
      fc.property(fc.integer({ min: 30, max: 220 }), (gPorLitro) => {
        const c = convertirUnidad('Hemoglobina', String(gPorLitro), 'g/L');
        expect(Number(c.value) * 10).toBeCloseTo(gPorLitro, 6);
      }),
      { numRuns: 100 },
    );
  });
});

describe('tabla de reglas', () => {
  it('cada regla declara su procedencia', () => {
    for (const r of REGLAS) {
      expect(r.fuente).toBeTruthy();
      expect(r.factor).toBeGreaterThan(0);
    }
  });

  it('sabe qué analitos tienen reglas', () => {
    expect(tieneReglas('Hemoglobina')).toBe(true);
    expect(tieneReglas('Fibrinógeno')).toBe(false);
  });
});

describe('nombres canónicos en la tabla', () => {
  it('ninguna regla usa un nombre no canónico', () => {
    // Pasó con "Glucosa": `canonicalAnalyte` la normaliza a "Glucemia", así que la regla no
    // coincidía nunca y la conversión se perdía sin error visible.
    expect(reglasConNombreNoCanonico()).toEqual([]);
  });
});
