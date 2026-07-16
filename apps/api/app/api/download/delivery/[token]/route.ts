import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { serveDelivery } from '../../../../../lib/services/distribution.service';

/**
 * GET /api/download/delivery/:token — descarga del reporte final por el destinatario.
 * Sin sesión (autorización por token). Sirve sólo el PDF final del caso aprobado; registra acceso.
 */
export const GET = apiHandler(async (_req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const result = await serveDelivery(token);
  if (!result) return NextResponse.json({ error: 'Enlace inválido.' }, { status: 404 });
  const encoded = encodeURIComponent(result.filename);
  return new NextResponse(result.pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encoded}`,
    },
  });
});
