import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../lib/errors';
import { requireSession } from '../../../../../../lib/auth/session-helper';
import { getNote, upsertNote } from '../../../../../../lib/services/note.service';

/**
 * Nota privada del anestesiólogo sobre un paciente. Aislamiento estricto por perfil: la sesión
 * fija el dueño; el servicio verifica además que el paciente sea de este médico.
 */

/** GET /api/panel/patients/:id/note — nota del médico (o null si no hay). */
export const GET = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const note = await getNote(session.anesthesiologistId, id);
  return NextResponse.json({ note });
});

const bodySchema = z.object({ content: z.string().max(20_000) });

/** PUT /api/panel/patients/:id/note — crea/actualiza. content vacío borra la nota. */
export const PUT = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(req);
  const { id } = await ctx.params;
  const { content } = bodySchema.parse(await req.json());
  const note = await upsertNote(session.anesthesiologistId, id, content);
  return NextResponse.json({ note });
});
