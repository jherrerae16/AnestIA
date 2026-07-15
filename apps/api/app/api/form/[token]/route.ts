import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../lib/errors';
import { verifyCaseToken } from '../../../../lib/auth/token';
import { getFormForCase } from '../../../../lib/services/form.service';
import { CONSENT_TEXT_V1, CONSENT_VERSION } from '@anestia/shared';

/** GET /api/form/[token] — carga el formulario del paciente (autorización por token). */
export const GET = apiHandler(async (_req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const kase = await verifyCaseToken(token);
  if (!kase) return NextResponse.json({ error: 'Enlace inválido o expirado.' }, { status: 410 });

  const form = await getFormForCase(kase.id);
  return NextResponse.json({
    ...form,
    consent: { text: CONSENT_TEXT_V1, version: CONSENT_VERSION },
  });
});
