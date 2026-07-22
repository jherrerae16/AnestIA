import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { buildIcsForAllCases } from '../../../../lib/services/calendar.service';

/**
 * GET /api/panel/calendar.ics — descarga TODAS las cirugías con fecha como un solo .ics.
 *
 * Un tap: en el móvil lanza la app de calendario nativa; en escritorio la abre Apple
 * Calendar/Outlook/Google (según el sistema) o la descarga. Sólo las cirugías del propio
 * anestesiólogo (aislamiento por perfil).
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const ics = await buildIcsForAllCases(session.anesthesiologistId, req.nextUrl.origin, new Date());
  return new NextResponse(ics.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(ics.filename)}`,
    },
  });
});
