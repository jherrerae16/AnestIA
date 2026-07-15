import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { prisma } from '../../../../../../lib/prisma';

/** GET /api/panel/cases/:id/audit — timeline de auditoría del caso (US-7.1). */
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;

  // Ownership: el caso debe ser del anestesiólogo de la sesión.
  const kase = await prisma.case.findFirst({ where: { id, anesthesiologistId: session.anesthesiologistId } });
  if (!kase) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });

  const entries = await prisma.auditLog.findMany({
    where: { entity: 'Case', entityId: id },
    orderBy: { createdAt: 'asc' },
    select: { action: true, createdAt: true, meta: true },
  });
  return NextResponse.json({ audit: entries });
});
