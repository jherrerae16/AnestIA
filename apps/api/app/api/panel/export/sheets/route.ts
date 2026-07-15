import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { requireSession } from '../../../../../lib/auth/session-helper';
import { prisma } from '../../../../../lib/prisma';
import { getSheetsExporter } from '../../../../../lib/sheets';

/**
 * POST /api/panel/export/sheets — exporta los casos del anestesiólogo a Google Sheets
 * (bajo demanda). Modo noop hasta configurar SHEETS_PROVIDER=google + service account.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const cases = await prisma.case.findMany({
    where: { anesthesiologistId: session.anesthesiologistId },
    include: { patient: { select: { fullName: true, documentId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const rows = cases.map((c) => ({
    paciente: c.patient?.fullName ?? '',
    documento: c.patient?.documentId ?? '',
    procedimiento: c.procedure ?? '',
    estado: c.status,
    fecha: c.createdAt.toISOString().slice(0, 10),
  }));

  try {
    const result = await getSheetsExporter().export(rows);
    if (!result.spreadsheetUrl) {
      return NextResponse.json({ ok: false, error: 'Export a Sheets no está configurado (SHEETS_PROVIDER=google + credenciales).' }, { status: 422 });
    }
    return NextResponse.json({ ok: true, url: result.spreadsheetUrl, count: rows.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error de export.' }, { status: 422 });
  }
});
