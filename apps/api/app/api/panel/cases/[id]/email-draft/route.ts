import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { emailDraftForCase } from '../../../../../../lib/services/distribution.service';

/**
 * GET /api/panel/cases/:id/email-draft — borrador del correo (asunto + cuerpo + nombre del PDF)
 * para precargar el compositor antes de enviar. El médico lo edita y decide enviar.
 */
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const draft = await emailDraftForCase(id, session.anesthesiologistId);
  if (!draft) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json(draft);
});
