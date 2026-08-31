import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { sessionPayloadSchema, type SessionPayload } from '@anestia/shared';

/**
 * AuthService — sign in del piloto (US-0.1). argon2id para hashing (SECURITY-12),
 * cookie de sesión firmada (jose) httpOnly/Secure/SameSite, con throttle de fuerza bruta.
 */
export const SESSION_COOKIE = 'anestia_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET no definido.');
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const parsed = sessionPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    // `iat` viaja para poder invalidar sesiones al cambiar la contraseña; no forma parte del
    // contrato de la sesión, así que se devuelve aparte del payload validado.
    return { ...parsed.data, emitidaEn: typeof payload.iat === 'number' ? payload.iat : null };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // Secure en producción (https). En dev local (http) se desactiva para permitir el flujo.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

// --- Throttle de fuerza bruta (in-memory, piloto) SECURITY-12 ---
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

export function isLocked(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() > rec.until) {
    attempts.delete(key);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

export function recordFailure(key: string): void {
  const rec = attempts.get(key) ?? { count: 0, until: 0 };
  rec.count += 1;
  rec.until = Date.now() + LOCK_MS;
  attempts.set(key, rec);
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}
