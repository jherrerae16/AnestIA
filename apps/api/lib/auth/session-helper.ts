import { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from './service';
import type { SessionPayload } from '@anestia/shared';

/**
 * Extrae y verifica la sesión del panel (SECURITY-08). El middleware ya exigió
 * presencia de cookie; aquí se valida la firma. Lanza si no hay sesión válida.
 */
export async function requireSession(req: NextRequest): Promise<SessionPayload> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    throw new SessionError();
  }
  return session;
}

export class SessionError extends Error {
  constructor() {
    super('No autorizado.');
    this.name = 'SessionError';
  }
}
