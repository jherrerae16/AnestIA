import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { reopenApproved } from '../../../../../../lib/services/approval.service';

const schema = z.object({ reason: z.string().max(1000).default('') });

/**
 * POST /api/panel/cases/:id/reopen — reabre un caso APROBADO para corrección.
 * Trazable (audit log conserva la versión previa); regresa a PENDIENTE_REVISION.
 */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const { reason } = schema.parse(await req.json().catch(() => ({})));
  const ok = await reopenApproved(id, session.anesthesiologistId, reason);
  if (!ok) return NextResponse.json({ error: 'El caso no está aprobado o no existe.' }, { status: 422 });
  return NextResponse.json({ ok: true });
});
