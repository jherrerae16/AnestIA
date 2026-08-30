import { NextRequest, NextResponse } from 'next/server';
import { preguntasPropiasSchema } from '@anestia/shared';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { listPropias, savePropias } from '../../../../../../lib/services/preset.service';

/**
 * Preguntas propias del anestesiólogo dentro de un cuestionario suyo.
 *
 * Las de la Especificación no pasan por aquí: el servicio sólo lee y escribe filas `PROPIA`.
 * Una pantalla no puede tocar el diccionario del Dr. ni por error ni a propósito.
 */
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const propias = await listPropias(session.anesthesiologistId, id);
  if (propias === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({
    propias: propias.map((q) => ({
      code: q.code,
      label: q.label,
      type: q.type,
      ayuda: q.ayuda,
      required: q.required,
      options: (q.options as string[] | null) ?? null,
    })),
  });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const propias = preguntasPropiasSchema.parse((await req.json()).propias);
  const res = await savePropias(session.anesthesiologistId, id, propias);
  return NextResponse.json(res, { status: res.errores.length ? 422 : 200 });
});
