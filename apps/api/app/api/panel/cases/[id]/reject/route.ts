import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { reject } from '../../../../../../lib/services/approval.service';

/** POST /api/panel/cases/:id/reject — rechaza y reabre el formulario al paciente. */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const { reason } = z.object({ reason: z.string().max(1000) }).parse(await req.json());
  await reject(id, session.anesthesiologistId, reason);
  return NextResponse.json({ ok: true });
});
