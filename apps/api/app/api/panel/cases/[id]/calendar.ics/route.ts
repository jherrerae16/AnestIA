import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { buildIcsForCase } from '../../../../../../lib/services/calendar.service';

/**
 * GET /api/panel/cases/[id]/calendar.ics — descarga el evento de calendario de una cirugía.
 *
 * Un solo .ics para todo dispositivo. La detección iOS/Android/desktop es 100% del cliente:
 * abrir esta URL en el móvil lanza la app de calendario nativa; en escritorio la abre Apple
 * Calendar/Outlook o la descarga. Cero token, cero URL para pegar, cero configuración.
 *
 * Sólo el dueño del caso puede descargarlo (aislamiento por perfil, SECURITY-08).
 */
export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(req);
    const { id } = await ctx.params;

    const ics = await buildIcsForCase(
      session.anesthesiologistId,
      id,
      req.nextUrl.origin,
      new Date(),
    );
    // null = caso ajeno o sin fecha de cirugía. No revelamos cuál (mismo 404).
    if (!ics) {
      return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    }

    return new NextResponse(ics.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(ics.filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  },
);
