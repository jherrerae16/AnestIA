import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { agruparEstudios, canonicalEstudio, describirEstudio } from './estudios';
import { fuenteAdmisible } from './scales/resolve';

/**
 * §16: "Ritmo, frecuencia, intervalos y conclusión; otros informes diagnósticos.
 * Interpretación clínica; no autocalcular escalas."
 */

const ecg = {
  tipo: 'ECG',
  tipoRaw: 'EKG de 12 derivaciones',
  ritmo: 'sinusal',
  frecuencia: '58 lpm',
  intervalos: 'PR 180 ms, QRS 92 ms, QTc 430 ms',
  conclusion: 'Bradicardia sinusal. Sin signos de isquemia aguda.',
  institucion: 'Clínica del Country',
  collectedAt: '2026-08-12',
  sourceRef: 'ecg:informe-1',
};

describe('canonicalEstudio', () => {
  it('reconoce las formas impresas del electrocardiograma', () => {
    for (const s of ['ECG', 'EKG de 12 derivaciones', 'Electrocardiograma en reposo']) {
      expect(canonicalEstudio(s)).toBe('ECG');
    }
  });

  it('lo que no reconoce cae en OTRO, no en una categoría adivinada', () => {
    expect(canonicalEstudio('Doppler de miembros inferiores')).toBe('OTRO');
    expect(canonicalEstudio(null)).toBe('OTRO');
  });

  it('distingue radiografía de tórax de otra radiografía', () => {
    expect(canonicalEstudio('Rx de tórax PA')).toBe('RADIOGRAFIA_TORAX');
    expect(canonicalEstudio('Radiografía de rodilla')).toBe('OTRO');
  });
});

describe('describirEstudio', () => {
  it('transcribe los cuatro campos que pide la spec', () => {
    const t = describirEstudio(ecg)!;
    expect(t).toContain('ritmo sinusal');
    expect(t).toContain('frecuencia 58 lpm');
    expect(t).toContain('PR 180 ms');
    expect(t).toContain('Conclusión: Bradicardia sinusal.');
  });

  it('no interpreta: no aparece una palabra que el informe no diga', () => {
    // "58 lpm" NO se convierte en "bradicardia" por su cuenta; sólo aparece porque el informe
    // lo escribió en la conclusión. Interpretar es del anestesiólogo.
    const sinConclusion = describirEstudio({ ...ecg, conclusion: null })!;
    expect(sinConclusion.toLowerCase()).not.toContain('bradicardia');
    expect(sinConclusion.toLowerCase()).not.toContain('normal');
    expect(sinConclusion.toLowerCase()).not.toContain('anormal');
  });

  it('lleva la fecha y la institución del informe', () => {
    expect(describirEstudio(ecg)).toContain('(del 2026-08-12, Clínica del Country)');
  });

  it('un estudio sin nada legible NO produce fila', () => {
    // Una línea que sólo diga "Electrocardiograma." sugiere que se leyó algo. No se leyó.
    expect(describirEstudio({ tipo: 'ECG', sourceRef: 'x' })).toBeNull();
  });

  it('usa el nombre impreso cuando lo hay', () => {
    expect(describirEstudio(ecg)).toContain('EKG de 12 derivaciones');
  });
});

describe('agruparEstudios', () => {
  it('agrupa por tipo y ordena del más reciente al más antiguo', () => {
    const viejo = { ...ecg, collectedAt: '2026-01-05', conclusion: 'Ritmo sinusal normal.' };
    const [g] = agruparEstudios([viejo, ecg]);
    expect(g!.clave).toBe('electrocardiograma');
    expect(g!.texto.indexOf('Bradicardia')).toBeLessThan(g!.texto.indexOf('Ritmo sinusal normal'));
  });

  it('marca el grupo cuando alguna lectura está sin confirmar', () => {
    const [g] = agruparEstudios([{ ...ecg, estadoExtraccion: 'PENDIENTE_CONFIRMACION' }]);
    expect(g!.pendiente).toBe(true);
  });

  it('separa tipos distintos en claves distintas', () => {
    const rx = { tipo: 'RADIOGRAFIA_TORAX', conclusion: 'Sin condensaciones.', sourceRef: 'rx:1' };
    expect(agruparEstudios([ecg, rx]).map((g) => g.clave)).toEqual([
      'electrocardiograma',
      'radiografia_torax',
    ]);
  });

  it('un tipo desconocido no rompe el agrupado', () => {
    const raro = { tipo: 'LO_QUE_SEA', conclusion: 'Algo.', sourceRef: 'x:1' };
    expect(agruparEstudios([raro]).map((g) => g.clave)).toEqual(['otros_estudios']);
  });

  it('nunca lanza, con cualquier entrada', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            tipo: fc.constantFrom('ECG', 'OTRO', 'no-existe', ''),
            conclusion: fc.option(fc.string(), { nil: null }),
            ritmo: fc.option(fc.string(), { nil: null }),
            sourceRef: fc.constant('x:1'),
          }),
          { maxLength: 8 },
        ),
        (es) => {
          for (const g of agruparEstudios(es)) expect(g.texto.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('CS9 — un estudio NUNCA alimenta una escala', () => {
  /**
   * La spec lo dice literal: "interpretación clínica; no autocalcular escalas". La garantía no
   * está en el código que persiste los estudios sino aquí: `estudio:` no está en la lista blanca
   * de procedencias, así que ninguna variable puede citarlo. Sin este test, alguien podría
   * enchufar un ECG a RCRI y nada fallaría.
   */
  it('la procedencia `estudio:` no es admisible', () => {
    expect(fuenteAdmisible('estudio:ecg')).toBe(false);
    expect(fuenteAdmisible('estudio:ECG#conclusion')).toBe(false);
  });

  it('las que sí lo son siguen siéndolo', () => {
    for (const f of ['formulario:CF01', 'agenda:PX03', 'lab:hemoglobina', 'anestesiologo']) {
      expect(fuenteAdmisible(f)).toBe(true);
    }
  });
});
