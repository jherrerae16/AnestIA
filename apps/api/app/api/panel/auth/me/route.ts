import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { prisma } from '../../../../../lib/prisma';
import { SESSION_COOKIE, verifySession } from '../../../../../lib/auth/service';

/**
 * GET /api/panel/auth/me — perfil de la sesión actual.
 * (El middleware ya bloqueó sin sesión; aquí devolvemos el perfil.)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const profile = await prisma.anesthesiologist.findUnique({
    where: { id: session.anesthesiologistId },
    select: { id: true, fullName: true, specialty: true, email: true, clinicLogoUrl: true },
  });
  return NextResponse.json({ profile });
});
