import { NextRequest, NextResponse } from 'next/server';
import { createCaseSchema } from '@anestia/shared';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { createCase } from '../../../../lib/services/case.service';

/** POST /api/panel/cases — crea un caso y devuelve el enlace tokenizado. */
export const POST = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const input = createCaseSchema.parse(await req.json());
  const { caseId, linkToken, linkExpiresAt } = await createCase(session.anesthesiologistId, input);
  return NextResponse.json({ caseId, linkToken, linkExpiresAt }, { status: 201 });
});
