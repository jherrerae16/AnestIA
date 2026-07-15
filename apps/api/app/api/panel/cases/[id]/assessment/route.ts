import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { editAssessment } from '../../../../../../lib/services/approval.service';

const editSchema = z.object({
  section: z.enum(['identificacion', 'antecedentes', 'paraclinicos', 'examen_fisico', 'valoracion_plan']),
  key: z.string().min(1).max(60),
  value: z.string().max(4000),
});

/** PATCH /api/panel/cases/:id/assessment — edición en línea de un campo. */
export const PATCH = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const { section, key, value } = editSchema.parse(await req.json());
  await editAssessment(id, session.anesthesiologistId, section, key, value);
  return NextResponse.json({ ok: true });
});
