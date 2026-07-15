import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { distribute } from '../../../../../../lib/services/distribution.service';

const schema = z.object({
  contactIds: z.array(z.string()).min(1),
  channel: z.enum(['email', 'link']).default('link'),
});

/** POST /api/panel/cases/:id/distribute — distribuye el reporte final (sólo aprobado). */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const { contactIds, channel } = schema.parse(await req.json());
  const origin = req.nextUrl.origin;
  const result = await distribute(id, session.anesthesiologistId, contactIds, channel, origin);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true, deliveries: result.deliveries });
});
