import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { searchPatients } from '../../../../lib/services/patient.service';

/** GET /api/panel/patients?q= — búsqueda por documento/nombre. */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const patients = await searchPatients(session.anesthesiologistId, q);
  return NextResponse.json({ patients });
});
