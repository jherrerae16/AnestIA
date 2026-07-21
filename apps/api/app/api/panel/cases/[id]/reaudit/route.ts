import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { prisma } from '../../../../../../lib/prisma';
import { auditForCase } from '../../../../../../lib/services/audit-clinical.service';

/**
 * POST /api/panel/cases/:id/reaudit — re-corre el auditor independiente sobre el borrador actual.
 * Determinístico (reglas, sin IA): cuesta CERO tokens y milisegundos. Útil tras editar campos en
 * la revisión, para ver si un hallazgo ya se resolvió. Devuelve el reporte fresco.
 */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;

  // Ownership: el caso debe ser del anestesiólogo de la sesión.
  const kase = await prisma.case.findFirst({ where: { id, anesthesiologistId: session.anesthesiologistId } });
  if (!kase) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });

  const report = await auditForCase(id);
  return NextResponse.json({ audit: report });
});
