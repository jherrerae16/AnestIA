import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../lib/errors';
import { prisma } from '../../../../lib/prisma';
import { getStorageProvider } from '../../../../lib/storage';
import { requireSession } from '../../../../lib/auth/session-helper';

/**
 * GET /api/download/[key] — sirve un adjunto. En el piloto lo restringimos al panel
 * (sesión): sólo el anestesiólogo dueño del caso del adjunto puede descargarlo (SECURITY-08).
 * `key` viene urlencoded (incluye caseId/hash-filename).
 */
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ key: string }> }) => {
  const session = await requireSession(req);
  const { key: rawKey } = await ctx.params;
  const key = decodeURIComponent(rawKey);

  const attachment = await prisma.attachment.findFirst({
    where: { url: key },
    include: { case: { select: { anesthesiologistId: true } } },
  });
  if (!attachment || attachment.case.anesthesiologistId !== session.anesthesiologistId) {
    return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const bytes = await getStorageProvider().get(key);
  return new NextResponse(bytes, {
    status: 200,
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'inline' },
  });
});
