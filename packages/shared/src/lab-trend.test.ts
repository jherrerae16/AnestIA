import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calcularTendencias, describirTendencia, soloMasReciente } from './lab-trend';

/**
 * §16: "Presentar tendencia cuando existan resultados sucesivos sin sobrescribir el documento
 * fuente". El valor clínico está en el cambio: una hemoglobina de 9.8 que viene de 14 en dos
 * semanas es una historia distinta de una que lleva un año en 9.8.
 */

const hb = (value: string, reportDate: string) => ({
  analyte: 'Hemoglobina', value, unit: 'g/dL', reportDate,
});

describe('calcularTendencias', () => {
  it('un solo resultado NO produce tendencia', () => {
    // Fabricar una serie de un punto invita a leer un cambio donde no lo hay.
    expect(calcularTendencias([hb('9.8', '2026-08-01')])).toEqual([]);
  });

  it('calcula la caída entre dos resultados sucesivos', () => {
    const [t] = calcularTendencias([hb('13.9', '2026-07-11'), hb('9.8', '2026-08-01')]);
    expect(t!.previo).toBe(13.9);
    expect(t!.actual).toBe(9.8);
    expect(t!.delta).toBeCloseTo(-4.1, 1);
    expect(t!.dias).toBe(21);
    expect(t!.direccion).toBe('baja');
  });

  it('ordena por fecha aunque lleguen desordenados', () => {
    const [t] = calcularTendencias([hb('9.8', '2026-08-01'), hb('13.9', '2026-07-11')]);
    expect(t!.serie.map((p) => p.fecha)).toEqual(['2026-07-11', '2026-08-01']);
    expect(t!.actual).toBe(9.8);
  });

  it('un cambio pequeño es "estable", no una alarma', () => {
    // 13.0 → 12.9 es ruido de método entre laboratorios, no una caída.
    const [t] = calcularTendencias([hb('13.0', '2026-07-01'), hb('12.9', '2026-08-01')]);
    expect(t!.direccion).toBe('estable');
  });

  it('prefiere la fecha de TOMA sobre la de emisión', () => {
    const r = [
      { analyte: 'Hemoglobina', value: '13.9', unit: 'g/dL', reportDate: '2026-08-05', collectedAt: '2026-07-11' },
      { analyte: 'Hemoglobina', value: '9.8', unit: 'g/dL', reportDate: '2026-08-06', collectedAt: '2026-08-01' },
    ];
    const [t] = calcularTendencias(r);
    expect(t!.dias).toBe(21); // por toma, no por emisión (1 día)
  });

  it('descarta resultados sin fecha o sin valor legible', () => {
    const r = [hb('13.9', '2026-07-11'), { analyte: 'Hemoglobina', value: 'ilegible', reportDate: '2026-08-01' }];
    expect(calcularTendencias(r)).toEqual([]);
  });

  it('agrupa por nombre canónico, no por el impreso', () => {
    const r = [
      { analyte: 'HB', value: '13.9', unit: 'g/dL', reportDate: '2026-07-11' },
      { analyte: 'Hemoglobina', value: '9.8', unit: 'g/dL', reportDate: '2026-08-01' },
    ];
    expect(calcularTendencias(r)).toHaveLength(1);
  });

  it('dos lecturas del mismo día son el mismo informe', () => {
    const r = [hb('13.9', '2026-08-01'), hb('13.9', '2026-08-01')];
    expect(calcularTendencias(r)).toEqual([]);
  });

  it('separa analitos distintos', () => {
    const r = [
      hb('13.9', '2026-07-11'), hb('9.8', '2026-08-01'),
      { analyte: 'Creatinina', value: '0.9', unit: 'mg/dL', reportDate: '2026-07-11' },
      { analyte: 'Creatinina', value: '1.4', unit: 'mg/dL', reportDate: '2026-08-01' },
    ];
    const ts = calcularTendencias(r);
    expect(ts).toHaveLength(2);
    // Orden alfabético: Creatinina (0.9 → 1.4, sube), Hemoglobina (13.9 → 9.8, baja).
    expect(ts.map((t) => t.analito)).toEqual(['Creatinina', 'Hemoglobina']);
    expect(ts.map((t) => t.direccion)).toEqual(['sube', 'baja']);
  });

  it('nunca lanza, con cualquier entrada', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            analyte: fc.constantFrom('Hemoglobina', 'Creatinina', 'Cosa rara'),
            value: fc.constantFrom('9.8', '0', '-3', 'ilegible', ''),
            reportDate: fc.constantFrom('2026-08-01', 'no-es-fecha', ''),
          }),
          { maxLength: 10 },
        ),
        (rs) => {
          for (const t of calcularTendencias(rs)) {
            expect(t.serie.length).toBeGreaterThanOrEqual(2);
            expect(describirTendencia(t).length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('no divide por cero si el previo era 0', () => {
    const r = [
      { analyte: 'Creatinina', value: '0', unit: 'mg/dL', reportDate: '2026-07-01' },
      { analyte: 'Creatinina', value: '1.2', unit: 'mg/dL', reportDate: '2026-08-01' },
    ];
    const [t] = calcularTendencias(r);
    expect(t!.deltaPct).toBeNull();
    expect(t!.direccion).toBe('estable');
  });
});

describe('describirTendencia', () => {
  it('produce una frase legible para el documento', () => {
    const [t] = calcularTendencias([hb('13.9', '2026-07-11'), hb('9.8', '2026-08-01')]);
    expect(describirTendencia(t!)).toBe('13.9 → 9.8 g/dL en 21 días (-29.5 %)');
  });
});

describe('soloMasReciente', () => {
  it('deja un solo resultado por analito: el más reciente', () => {
    const r = [hb('13.9', '2026-07-11'), hb('9.8', '2026-08-01')];
    expect(soloMasReciente(r).map((x) => x.value)).toEqual(['9.8']);
  });

  it('si a alguno le falta la fecha, los conserva todos', () => {
    // Sin fecha no se sabe cuál es el último; escoger uno al azar oculta el otro.
    const r = [hb('13.9', '2026-07-11'), { analyte: 'Hemoglobina', value: '9.8' }];
    expect(soloMasReciente(r)).toHaveLength(2);
  });

  it('no mezcla analitos distintos', () => {
    const r = [
      hb('13.9', '2026-07-11'), hb('9.8', '2026-08-01'),
      { analyte: 'Creatinina', value: '0.9', reportDate: '2026-08-01' },
    ];
    expect(soloMasReciente(r).map((x) => x.analyte)).toEqual(['Hemoglobina', 'Creatinina']);
  });

  it('agrupa por nombre canónico', () => {
    const r = [
      { analyte: 'HB', value: '13.9', reportDate: '2026-07-11' },
      { analyte: 'Hemoglobina', value: '9.8', reportDate: '2026-08-01' },
    ];
    expect(soloMasReciente(r).map((x) => x.value)).toEqual(['9.8']);
  });
});
