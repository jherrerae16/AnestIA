import { NextRequest, NextResponse } from 'next/server';
import { cambiarPasswordSchema } from '@anestia/shared';
import { apiHandler } from '../../../../../lib/errors';
import { requireSession } from '../../../../../lib/auth/session-helper';
import { cambiarPassword, PasswordActualIncorrecta } from '../../../../../lib/auth/password.service';

/**
 * PUT /api/panel/profile/password — el médico cambia su propia contraseña.
 *
 * Exige la actual: sin eso, una sesión robada o un equipo desbloqueado bastan para quedarse con
 * la cuenta. Al cambiarla, las sesiones anteriores dejan de valer (incluida la del atacante).
 */
export const PUT = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const { actual, nueva } = cambiarPasswordSchema.parse(await req.json());
  try {
    await cambiarPassword(session.anesthesiologistId, actual, nueva);
  } catch (e) {
    if (e instanceof PasswordActualIncorrecta) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
});
