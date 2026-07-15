import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { listCases } from '../../../../lib/services/dashboard.service';

/** GET /api/panel/dashboard?status= — casos por estado + indicadores. */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const status = req.nextUrl.searchParams.get('status') ?? undefined;
  return NextResponse.json(await listCases(session.anesthesiologistId, status));
});
