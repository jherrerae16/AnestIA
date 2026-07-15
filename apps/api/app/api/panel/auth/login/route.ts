import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@anestia/shared';
import { apiHandler } from '../../../../../lib/errors';
import { prisma } from '../../../../../lib/prisma';
import {
  SESSION_COOKIE,
  isLocked,
  recordFailure,
  recordSuccess,
  sessionCookieOptions,
  signSession,
  verifyPassword,
} from '../../../../../lib/auth/service';

/** POST /api/panel/auth/login — email + password → cookie de sesión. Público (validado aquí). */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { email, password } = loginSchema.parse(body);

  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  const throttleKey = `${email}:${ip}`;

  if (isLocked(throttleKey)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un minuto.' },
      { status: 429 },
    );
  }

  const anesthesiologist = await prisma.anesthesiologist.findUnique({ where: { email } });
  const ok =
    anesthesiologist?.passwordHash != null &&
    (await verifyPassword(anesthesiologist.passwordHash, password));

  if (!ok || !anesthesiologist) {
    recordFailure(throttleKey);
    // Mensaje genérico (no revela si el email existe) SECURITY-09/12.
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }

  recordSuccess(throttleKey);
  const token = await signSession({
    anesthesiologistId: anesthesiologist.id,
    email: anesthesiologist.email,
  });

  const res = NextResponse.json({
    ok: true,
    profile: { id: anesthesiologist.id, fullName: anesthesiologist.fullName },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
