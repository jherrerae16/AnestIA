import { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from './service';
import { prisma } from '../prisma';
import type { SessionPayload } from '@anestia/shared';

/**
 * Extrae y verifica la sesión del panel (SECURITY-08). El middleware ya exigió
 * presencia de cookie; aquí se valida la firma. Lanza si no hay sesión válida.
 *
 * Además comprueba que la sesión sea POSTERIOR al último cambio de contraseña. Sin eso,
 * restablecer la contraseña de una cuenta comprometida no echaba a quien ya estaba dentro:
 * su cookie seguía valiendo hasta caducar sola, hasta ocho horas después.
 */
export async function requireSession(req: NextRequest): Promise<SessionPayload> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    throw new SessionError();
  }

  const medico = await prisma.anesthesiologist.findUnique({
    where: { id: session.anesthesiologistId },
    select: { passwordChangedAt: true },
  });
  // Un perfil borrado invalida su sesión: el token sigue firmado, pero ya no hay a quién.
  if (!medico) throw new SessionError();

  if (medico.passwordChangedAt && session.emitidaEn != null) {
    // `iat` viene en segundos; se compara con el mismo grano para no echar a nadie por
    // milisegundos de diferencia entre el firmado y la escritura en la base.
    const cambio = Math.floor(medico.passwordChangedAt.getTime() / 1000);
    if (session.emitidaEn < cambio) throw new SessionError();
  }

  return session;
}

export class SessionError extends Error {
  constructor() {
    super('No autorizado.');
    this.name = 'SessionError';
  }
}
