import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { loadExamNormal, setExam } from '../../../../../../lib/services/approval.service';

const examSchema = z.object({
  mode: z.enum(['normal', 'manual']),
  values: z.record(z.string(), z.string().max(2000)).optional(),
  // Atestación explícita del médico para "normal" (CS3): declara que examinó al paciente.
  attested: z.boolean().optional(),
});

/** POST /api/panel/cases/:id/exam — cargar examen normal o ingresar valores reales. */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const { mode, values, attested } = examSchema.parse(await req.json());
  if (mode === 'normal') {
    // CS3: no se autocompleta "normal" sin atestación explícita del anestesiólogo.
    if (!attested) {
      return NextResponse.json(
        { error: 'Debes confirmar que examinaste al paciente antes de marcar el examen como normal.' },
        { status: 422 },
      );
    }
    await loadExamNormal(id, session.anesthesiologistId);
  } else {
    await setExam(id, session.anesthesiologistId, values ?? {});
  }
  return NextResponse.json({ ok: true });
});
