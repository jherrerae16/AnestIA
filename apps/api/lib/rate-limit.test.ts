import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { rateLimit } from './rate-limit';

describe('rateLimit (PBT invariant)', () => {
  let counter = 0;
  it('INVARIANTE: las primeras `limit` pasan; la siguiente se bloquea', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (limit) => {
        const key = `k-${counter++}`; // clave única por invocación (evita colisión entre runs)
        for (let i = 0; i < limit; i++) {
          expect(rateLimit(key, limit, 60_000)).toBe(true); // dentro del límite
        }
        expect(rateLimit(key, limit, 60_000)).toBe(false); // excede
      }),
    );
  });

  it('ventana independiente por clave', () => {
    expect(rateLimit('a', 1, 60_000)).toBe(true);
    expect(rateLimit('b', 1, 60_000)).toBe(true); // otra clave, no afecta
    expect(rateLimit('a', 1, 60_000)).toBe(false);
  });
});
