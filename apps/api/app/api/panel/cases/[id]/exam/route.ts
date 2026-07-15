import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { loadExamNormal, setExam } from '../../../../../../lib/services/approval.service';

const examSchema = z.object({
  mode: z.enum(['normal', 'manual']),
  values: z.record(z.string(), z.string().max(2000)).optional(),
});

/** POST /api/panel/cases/:id/exam — cargar examen normal o ingresar valores reales. */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const { mode, values } = examSchema.parse(await req.json());
  if (mode === 'normal') {
    await loadExamNormal(id, session.anesthesiologistId);
  } else {
    await setExam(id, session.anesthesiologistId, values ?? {});
  }
  return NextResponse.json({ ok: true });
});
