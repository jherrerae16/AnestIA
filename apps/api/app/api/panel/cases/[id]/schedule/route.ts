import { NextRequest, NextResponse } from 'next/server';
import { scheduleSchema } from '@anestia/shared';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { updateSchedule } from '../../../../../../lib/services/case.service';

/**
 * PUT /api/panel/cases/:id/schedule — actualiza la programación quirúrgica.
 *
 * La agenda puede llenarse después de crear el caso: mientras falte una variable, las escalas
 * que dependan de ella quedan pendientes en vez de calcularse con supuestos.
 */
export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const input = scheduleSchema.parse(await req.json());
  const res = await updateSchedule(session.anesthesiologistId, id, input);
  if (!res) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json(res);
});
