import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../lib/errors';
import { verifyCaseToken } from '../../../../../lib/auth/token';
import { savePartial } from '../../../../../lib/services/form.service';

const bodySchema = z.object({ answers: z.record(z.string(), z.unknown()).default({}) });

/** POST /api/form/[token]/save — guardado parcial (no dispara el pipeline). */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const kase = await verifyCaseToken(token);
  if (!kase) return NextResponse.json({ error: 'Enlace inválido o expirado.' }, { status: 410 });
  const { answers } = bodySchema.parse(await req.json());
  await savePartial(kase.id, answers);
  return NextResponse.json({ ok: true });
});
