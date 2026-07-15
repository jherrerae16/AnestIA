import { NextRequest, NextResponse } from 'next/server';
import { presetSchema } from '@anestia/shared';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { listPresets, createPreset } from '../../../../lib/services/preset.service';

/** GET /api/panel/presets — lista los presets del anesthesiologist. */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const presets = await listPresets(session.anesthesiologistId);
  return NextResponse.json({ presets });
});

/** POST /api/panel/presets — crea un preset. */
export const POST = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const def = presetSchema.parse(await req.json());
  const preset = await createPreset(session.anesthesiologistId, def);
  return NextResponse.json({ preset }, { status: 201 });
});
