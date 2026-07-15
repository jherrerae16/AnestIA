import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { requireSession } from '../../../../../lib/auth/session-helper';
import { getCase } from '../../../../../lib/services/case.service';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const kase = await getCase(session.anesthesiologistId, id);
  if (!kase) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ case: kase });
});
