import { NextRequest, NextResponse } from 'next/server';
import { restablecerPasswordSchema } from '@anestia/shared';
import { apiHandler } from '../../../../../../lib/errors';
import { restablecerPassword, TokenInvalido } from '../../../../../../lib/auth/password.service';

/**
 * POST /api/panel/auth/password/restablecer — aplica el restablecimiento con el token del
 * correo. Público: quien llega aquí no tiene sesión, justamente porque perdió el acceso.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const { token, nueva } = restablecerPasswordSchema.parse(await req.json());
  try {
    await restablecerPassword(token, nueva);
  } catch (e) {
    if (e instanceof TokenInvalido) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
});
