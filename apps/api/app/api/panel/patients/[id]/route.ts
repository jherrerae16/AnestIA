import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { requireSession } from '../../../../../lib/auth/session-helper';
import { getPatientWithHistory } from '../../../../../lib/services/patient.service';

/** GET /api/panel/patients/:id — ficha + historial de valoraciones. */
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const patient = await getPatientWithHistory(session.anesthesiologistId, id);
  if (!patient) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ patient });
});
