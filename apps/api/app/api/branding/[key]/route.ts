import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../lib/errors';
import { getStorageProvider } from '../../../../lib/storage';

/**
 * GET /api/branding/[key] — sirve un asset de branding (logo/firma) subido por el usuario.
 * Público (los assets van en el PDF y en el header del formulario del paciente).
 */
export const GET = apiHandler(async (_req: NextRequest, ctx: { params: Promise<{ key: string }> }) => {
  const { key: rawKey } = await ctx.params;
  const key = decodeURIComponent(rawKey);
  // Sólo servir de la carpeta branding (evita path traversal a otros archivos).
  if (!key.startsWith('branding/')) {
    return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  }
  try {
    const bytes = await getStorageProvider().get(key);
    const type = key.endsWith('.svg') ? 'image/svg+xml'
      : key.endsWith('.png') ? 'image/png'
      : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return new NextResponse(bytes, { status: 200, headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300' } });
  } catch {
    return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  }
});
