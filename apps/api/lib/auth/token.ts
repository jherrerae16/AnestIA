import { randomBytes } from 'node:crypto';
import { prisma } from '../prisma';

/** Genera un token de caso no adivinable (256 bits → base64url). */
export function generateCaseToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Verifica el token del formulario del paciente (autorización a nivel de objeto, SECURITY-08).
 * Devuelve el caso si el token existe y no expiró; null en otro caso.
 */
export async function verifyCaseToken(token: string) {
  if (!token || token.length < 20) return null;
  const kase = await prisma.case.findUnique({ where: { linkToken: token } });
  if (!kase) return null;
  if (kase.linkExpiresAt && kase.linkExpiresAt.getTime() < Date.now()) return null;
  return kase;
}
