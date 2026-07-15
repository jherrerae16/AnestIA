import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { verifyCaseToken } from '../../../../../lib/auth/token';
import { savePartial } from '../../../../../lib/services/form.service';

/** POST /api/form/[token]/save — guardado parcial (no dispara el pipeline). */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const kase = await verifyCaseToken(token);
  if (!kase) return NextResponse.json({ error: 'Enlace inválido o expirado.' }, { status: 410 });
  const body = await req.json();
  await savePartial(kase.id, body.answers);
  return NextResponse.json({ ok: true });
});
