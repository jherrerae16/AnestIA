import { NextRequest, NextResponse } from 'next/server';
import { olvidePasswordSchema } from '@anestia/shared';
import { apiHandler } from '../../../../../../lib/errors';
import { isLocked, recordFailure } from '../../../../../../lib/auth/service';
import { solicitarReset } from '../../../../../../lib/auth/password.service';

/**
 * POST /api/panel/auth/password/olvide — pide un enlace de restablecimiento. Público.
 *
 * Responde SIEMPRE lo mismo, exista el correo o no: decir "ese correo no está registrado"
 * convertiría el formulario en un detector de qué anestesiólogos usan el sistema.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const { email } = olvidePasswordSchema.parse(await req.json());

  // Mismo throttle que el login: sin él, este endpoint es una forma barata de mandar correos
  // en nombre de otro y de sondear cuentas.
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  const clave = `reset:${email}:${ip}`;
  if (isLocked(clave)) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 });
  }
  recordFailure(clave);

  const base = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  await solicitarReset(email, base);

  return NextResponse.json({
    ok: true,
    mensaje: 'Si ese correo tiene una cuenta, le llegará un enlace para restablecer la contraseña.',
  });
});
