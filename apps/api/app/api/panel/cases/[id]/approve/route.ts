import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { approve } from '../../../../../../lib/services/approval.service';

/** POST /api/panel/cases/:id/approve — aprueba y firma (bloqueante si hay blockers). */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const result = await approve(id, session.anesthesiologistId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, blockers: result.blockers }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
});
