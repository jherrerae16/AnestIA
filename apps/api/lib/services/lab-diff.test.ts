import { describe, it, expect } from 'vitest';
import { diffExtractions } from './lab.service';

/**
 * diffExtractions sostiene la condición de salida del modo comparativo: "de los últimos N
 * casos, ¿cuántos tuvieron discrepancia y en qué analitos?". Tiene que separar la diferencia
 * clínica (valor distinto, o presente/ausente) de la de sólo etiqueta.
 */
describe('diffExtractions — comparación entre métodos', () => {
  const lab = (analyte: string, value: string) => ({ analyte, value });

  it('extracciones idénticas → sin discrepancia', () => {
    const a = [lab('Hemoglobina', '15.9'), lab('Plaquetas', '244000')];
    const d = diffExtractions(a, a);
    expect(d.discrepancia).toBe(false);
    expect(d.coincidentes).toBe(2);
    expect(d.valorDistinto).toEqual([]);
  });

  it('mismo analito con valor numérico distinto → DISCREPANCIA', () => {
    const vision = [lab('Hemoglobina', '15.9')];
    const capas = [lab('Hemoglobina', '13.2')];
    const d = diffExtractions(vision, capas);
    expect(d.discrepancia).toBe(true);
    expect(d.valorDistinto).toEqual([{ analyte: 'HEMOGLOBINA', vision: '15.9', capas: '13.2' }]);
  });

  it('analito presente en un método y ausente en el otro → DISCREPANCIA', () => {
    const vision = [lab('Hemoglobina', '15.9'), lab('Plaquetas', '244000')];
    const capas = [lab('Hemoglobina', '15.9')];
    const d = diffExtractions(vision, capas);
    expect(d.discrepancia).toBe(true);
    expect(d.soloEnVision).toEqual(['PLAQUETAS']);
    expect(d.soloEnCapas).toEqual([]);
  });

  it('mismo valor con unidad/texto distinto NO es discrepancia (compara el número)', () => {
    const vision = [lab('Glicemia', '101.0 mg/dl')];
    const capas = [lab('Glicemia', '101 mg/dL')];
    const d = diffExtractions(vision, capas);
    expect(d.discrepancia).toBe(false);
    expect(d.coincidentes).toBe(1);
  });

  it('el nombre se normaliza: mayúsculas y espacios no cuentan como discrepancia', () => {
    const vision = [lab('  recuento de leucocitos ', '6.64')];
    const capas = [lab('RECUENTO DE LEUCOCITOS', '6.64')];
    expect(diffExtractions(vision, capas).discrepancia).toBe(false);
  });

  // El caso real observado en las pruebas: visión dijo "CRISTALES", capas "CRISTALES DE
  // OXALATO DE CALCIO" — mismo hallazgo, etiqueta más precisa. Cuenta como soloEn*, y ahí
  // el análisis humano decide; pero es exactamente lo que hay que poder consultar aparte.
  it('diferencia de sólo etiqueta aparece como soloEn (para revisar, no confundir con valor)', () => {
    const vision = [lab('Cristales', 'Positivo')];
    const capas = [lab('Cristales de oxalato de calcio', 'Positivo')];
    const d = diffExtractions(vision, capas);
    expect(d.discrepancia).toBe(true); // se marca, y el humano juzga
    expect(d.soloEnVision).toContain('CRISTALES');
    expect(d.soloEnCapas).toContain('CRISTALES DE OXALATO DE CALCIO');
    expect(d.valorDistinto).toEqual([]); // NO es discrepancia de valor
  });

  it('caso real: 66/66 coincidentes, sólo diferencias de etiqueta en uroanálisis', () => {
    // Espejo del A/B que corrimos: mismos valores, tres nombres distintos.
    const comunes = Array.from({ length: 66 }, (_, i) => lab(`Analito${i}`, String(i + 1)));
    const vision = [...comunes, lab('Cristales', '+'), lab('Eritrocitos (sedimento)', '2')];
    const capas = [...comunes, lab('Cristales de oxalato de calcio', '+'), lab('Eritrocitos sedimento', '2')];
    const d = diffExtractions(vision, capas);
    expect(d.coincidentes).toBe(66);
    expect(d.valorDistinto).toEqual([]); // cero discrepancias de valor
    expect(d.soloEnVision.length).toBe(2);
    expect(d.soloEnCapas.length).toBe(2);
  });
});
