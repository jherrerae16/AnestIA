import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { previewPdfForCase } from '../../../../../../lib/services/document.service';

/**
 * GET /api/panel/cases/:id/preview — renderiza el PDF del documento ACTUAL
 * (borrador con los campos vigentes) al vuelo y lo devuelve inline para
 * previsualización. No persiste nada; el médico verifica antes de aprobar.
 */
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const result = await previewPdfForCase(id, session.anesthesiologistId);
  if (!result) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  // RFC 5987: nombre de archivo con caracteres no-ASCII (acentos) codificado.
  const encoded = encodeURIComponent(result.filename);
  return new NextResponse(result.pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
