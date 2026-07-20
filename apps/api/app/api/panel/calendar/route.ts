import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { bogotaDayRange } from '../../../../lib/tz';
import { listCasesForCalendar } from '../../../../lib/services/calendar.service';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/panel/calendar?view=month|week&anchor=YYYY-MM-DD
 * Cirugías del anestesiólogo (sólo las suyas) dentro del rango de la vista. Los casos sin
 * fecha de cirugía no aparecen. El cliente arma la cuadrícula; aquí sólo entregamos datos.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const view = req.nextUrl.searchParams.get('view') === 'week' ? 'week' : 'month';
  const anchorRaw = req.nextUrl.searchParams.get('anchor');

  const now = new Date();
  const anchor = anchorRaw ? new Date(`${anchorRaw}T12:00:00Z`) : now;
  if (Number.isNaN(anchor.getTime())) {
    return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
  }

  const range = rangeForView(view, anchor);
  const cases = await listCasesForCalendar(session.anesthesiologistId, range, now);
  return NextResponse.json({ view, cases });
});

/**
 * Rango [from, to) que cubre la vista, con márgenes generosos y ajustado a límites de día
 * de Bogotá. La cuadrícula mensual muestra días de meses vecinos, por eso el colchón. Traer
 * de más no molesta: el cliente sólo pinta lo que cae en la vista.
 */
function rangeForView(view: 'month' | 'week', anchor: Date): { from: Date; to: Date } {
  // Semana: ~9 días; mes: ~44 días. Se recorta el instante y luego se ancla al día de Bogotá.
  const spanBefore = view === 'week' ? 1 : 7;
  const spanAfter = view === 'week' ? 8 : 44;
  return {
    from: bogotaDayRange(new Date(anchor.getTime() - spanBefore * DIA_MS), 1).from,
    to: bogotaDayRange(new Date(anchor.getTime() + spanAfter * DIA_MS), 1).from,
  };
}
