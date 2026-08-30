import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { verificarIdentidad, identidadUsable } from './lab-identity';

/**
 * Especificación §15: "Verificar paciente, documento y fecha" e "identidad del paciente y
 * concordancia con el caso activo".
 *
 * El riesgo es concreto: un paciente sube por error el examen de un familiar. Sin esta
 * comprobación, esos valores alimentarían las escalas y las alertas de otra persona.
 */

const caso = { fullName: 'Roberto Mario Uribe González', documentId: '32.851.396' };

describe('verificarIdentidad', () => {
  it('el documento manda, aunque el nombre esté escrito distinto', () => {
    const r = verificarIdentidad(caso, { nombre: 'URIBE G., R.M.', documento: '32851396' });
    expect(r.match).toBe('COINCIDE');
  });

  it('tolera los puntos de miles del documento', () => {
    expect(verificarIdentidad(caso, { documento: '32.851.396' }).match).toBe('COINCIDE');
    expect(verificarIdentidad(caso, { documento: '32851396' }).match).toBe('COINCIDE');
  });

  it('detecta un informe de otra persona', () => {
    const r = verificarIdentidad(caso, { nombre: 'María Herrera', documento: '1042246571' });
    expect(r.match).toBe('NO_COINCIDE');
    // El motivo dice de quién es, para que el médico entienda qué pasó.
    expect(r.motivo).toContain('1042246571');
  });

  it('sin documento cae al nombre, tolerando el orden y las partículas', () => {
    const r = verificarIdentidad(caso, { nombre: 'URIBE GONZALEZ ROBERTO MARIO' });
    expect(r.match).toBe('COINCIDE');
  });

  it('un nombre claramente distinto no concuerda', () => {
    expect(verificarIdentidad(caso, { nombre: 'Ana Restrepo Vélez' }).match).toBe('NO_COINCIDE');
  });

  it('sin nombre ni documento es NO_VERIFICABLE, que NO es "no coincide"', () => {
    // El resultado se conserva y se marca para revisión, en vez de descartarlo o darlo por bueno.
    const r = verificarIdentidad(caso, {});
    expect(r.match).toBe('NO_VERIFICABLE');
    expect(identidadUsable(r.match)).toBe(true);
  });

  it('sólo una discordancia bloquea el uso del resultado', () => {
    expect(identidadUsable('COINCIDE')).toBe(true);
    expect(identidadUsable('NO_VERIFICABLE')).toBe(true);
    expect(identidadUsable('NO_COINCIDE')).toBe(false);
  });

  it('nunca lanza, con cualquier entrada', () => {
    fc.assert(
      fc.property(
        fc.record({ nombre: fc.option(fc.string(), { nil: undefined }), documento: fc.option(fc.string(), { nil: undefined }) }),
        (informe) => {
          const r = verificarIdentidad(caso, informe);
          expect(['COINCIDE', 'NO_COINCIDE', 'NO_VERIFICABLE']).toContain(r.match);
          expect(r.motivo.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('un caso sin identidad no da nada por bueno', () => {
    const r = verificarIdentidad({ fullName: '', documentId: '' }, { nombre: 'Quien sea' });
    expect(r.match).not.toBe('COINCIDE');
  });
});
