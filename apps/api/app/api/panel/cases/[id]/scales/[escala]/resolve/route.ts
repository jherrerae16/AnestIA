import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../../../lib/errors';
import { requireSession } from '../../../../../../../../lib/auth/session-helper';
import { resolverEscala } from '../../../../../../../../lib/services/scales.service';

const bodySchema = z.object({
  /** Qué decidió el anestesiólogo. Queda en el documento junto al motivo original. */
  nota: z.string().min(3).max(500),
});

/**
 * POST /api/panel/cases/:id/scales/:escala/resolve
 *
 * Levanta el bloqueo de una escala en revisión clínica. No recalcula ni inventa un puntaje:
 * deja constancia de que un humano la revisó y asumió la decisión (CS1).
 */
export const POST = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string; escala: string }> }) => {
    const session = await requireSession(req);
    const { id, escala } = await ctx.params;
    const { nota } = bodySchema.parse(await req.json());
    const res = await resolverEscala(id, escala, session.anesthesiologistId, nota);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json(res);
  },
);
