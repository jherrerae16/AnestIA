import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { getReview } from '../../../../../../lib/services/approval.service';

/** GET /api/panel/cases/:id/review — datos de revisión lado a lado. */
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const review = await getReview(id, session.anesthesiologistId);
  if (!review) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json(review);
});
