import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  isLocked,
  recordFailure,
  recordSuccess,
} from './service';

// SESSION_SECRET requerido para las pruebas de sesión.
process.env.SESSION_SECRET ??= 'test-secret-do-not-use-in-prod';

describe('AuthService — password hashing (PBT round-trip)', () => {
  it('verify(hash(pw), pw) === true para cualquier password válida', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 64 }),
        async (pw) => {
          const hash = await hashPassword(pw);
          expect(await verifyPassword(hash, pw)).toBe(true);
        },
      ),
      { numRuns: 15 },
    );
  });

  it('verifica falso con password distinta (example)', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });
});

describe('AuthService — session sign/verify (PBT round-trip)', () => {
  // Generador de emails que respeta el esquema Zod (.email()) que valida la sesión (PBT-07).
  const zodEmailArb = fc
    .tuple(
      fc.stringMatching(/^[a-z][a-z0-9]{0,14}$/),
      fc.stringMatching(/^[a-z][a-z0-9]{0,14}$/),
      fc.constantFrom('com', 'co', 'org', 'net'),
    )
    .map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

  it('verifySession(signSession(payload)) devuelve el payload', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          anesthesiologistId: fc.stringMatching(/^[A-Za-z0-9]{1,30}$/),
          email: zodEmailArb,
        }),
        async (payload) => {
          const token = await signSession(payload);
          const back = await verifySession(token);
          // La identidad viaja intacta...
          expect(back).toMatchObject(payload);
          // ...y además vuelve el instante de emisión, que es lo que permite invalidar las
          // sesiones anteriores a un cambio de contraseña.
          expect(typeof back!.emitidaEn).toBe('number');
        },
      ),
      { numRuns: 15 },
    );
  });

  it('token corrupto → null (example)', async () => {
    expect(await verifySession('not.a.jwt')).toBeNull();
  });
});

describe('AuthService — brute-force throttle (example)', () => {
  it('bloquea tras 5 fallos y se limpia con éxito', () => {
    const key = 'test@example.com:1.2.3.4';
    for (let i = 0; i < 5; i++) recordFailure(key);
    expect(isLocked(key)).toBe(true);
    recordSuccess(key);
    expect(isLocked(key)).toBe(false);
  });
});
