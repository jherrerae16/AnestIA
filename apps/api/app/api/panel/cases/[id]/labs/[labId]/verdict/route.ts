import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../../../lib/errors';
import { requireSession } from '../../../../../../../../lib/auth/session-helper';
import { setLabVerdict } from '../../../../../../../../lib/services/lab.service';

/**
 * PUT /api/panel/cases/[id]/labs/[labId]/verdict — veredicto manual del anestesiólogo sobre un
 * analito (HITL). `verdict: null` deshace. Aislamiento por perfil en el servicio.
 */
const bodySchema = z.object({
  verdict: z.enum(['NORMAL', 'ALERTA', 'CRITICO']).nullable(),
});

export const PUT = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string; labId: string }> }) => {
    const session = await requireSession(req);
    const { id, labId } = await ctx.params;
    const { verdict } = bodySchema.parse(await req.json());
    const res = await setLabVerdict(session.anesthesiologistId, id, labId, verdict);
    return NextResponse.json(res);
  },
);
