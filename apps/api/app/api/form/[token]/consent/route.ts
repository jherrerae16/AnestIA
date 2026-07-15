import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { verifyCaseToken } from '../../../../../lib/auth/token';
import { acceptConsent } from '../../../../../lib/services/form.service';

/** POST /api/form/[token]/consent — acepta el consentimiento Ley 1581. */
export const POST = apiHandler(async (_req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const kase = await verifyCaseToken(token);
  if (!kase) return NextResponse.json({ error: 'Enlace inválido o expirado.' }, { status: 410 });
  await acceptConsent(kase.id);
  return NextResponse.json({ ok: true });
});
