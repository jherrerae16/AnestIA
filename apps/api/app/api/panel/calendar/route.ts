import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { pureDayUTC } from '../../../../lib/tz';
import { listCasesForCalendar } from '../../../../lib/services/calendar.service';

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
  // procedureDate es fecha pura (día UTC): el rango se ancla a límites de día UTC (no de
  // Bogotá) para no correr las cirugías del borde.
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const d = anchor.getUTCDate();

  if (view === 'week') {
    // Semana con un día de colchón a cada lado, sin importar qué día del mes sea el ancla.
    return { from: pureDayUTC(new Date(Date.UTC(y, m, d - 8)), 0), to: pureDayUTC(new Date(Date.UTC(y, m, d + 9)), 0) };
  }
  // Mes: desde una semana antes del día 1 del mes del ancla hasta una semana después del fin
  // de mes. Cubre el mes completo aunque el ancla sea cualquier día (día 1 o día 28).
  return {
    from: new Date(Date.UTC(y, m, 1 - 7)),
    to: new Date(Date.UTC(y, m + 1, 1 + 7)),
  };
}
