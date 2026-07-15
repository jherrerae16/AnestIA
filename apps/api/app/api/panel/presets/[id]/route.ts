import { NextRequest, NextResponse } from 'next/server';
import { presetSchema } from '@anestia/shared';
import { apiHandler } from '../../../../../lib/errors';
import { requireSession } from '../../../../../lib/auth/session-helper';
import { getPreset, updatePreset } from '../../../../../lib/services/preset.service';

export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const preset = await getPreset(session.anesthesiologistId, id);
  if (!preset) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ preset });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const def = presetSchema.parse(await req.json());
  const preset = await updatePreset(session.anesthesiologistId, id, def);
  if (!preset) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ preset });
});
