import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { requireSession } from '../../../../../lib/auth/session-helper';
import { uploadBranding } from '../../../../../lib/services/profile.service';

/**
 * POST /api/panel/profile/branding?kind=logo|signature — el usuario sube su logo o firma
 * desde la plataforma (multipart). No los subimos nosotros desde el proyecto.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const kind = req.nextUrl.searchParams.get('kind');
  if (kind !== 'logo' && kind !== 'signature') {
    return NextResponse.json({ error: 'kind debe ser logo o signature.' }, { status: 400 });
  }
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  }
  const result = await uploadBranding(session.anesthesiologistId, kind, file);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true, url: result.url });
});
