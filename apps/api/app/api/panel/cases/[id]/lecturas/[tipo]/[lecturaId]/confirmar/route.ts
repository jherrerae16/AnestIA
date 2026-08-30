import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../../../../../../lib/errors';
import { requireSession } from '../../../../../../../../../lib/auth/session-helper';
import { confirmarLectura } from '../../../../../../../../../lib/services/lab.service';

/**
 * PUT /api/panel/cases/[id]/lecturas/[tipo]/[lecturaId]/confirmar — el anestesiólogo confirma
 * (o vuelve a retener) una lectura que el extractor marcó dudosa. `tipo` es `lab` o `estudio`.
 *
 * Es HITL sobre la EXTRACCIÓN, distinto del veredicto clínico del analito (`/verdict`): allí el
 * médico dice si el valor es normal o alterado; aquí dice si el valor que se leyó es el que está
 * impreso en el informe.
 */
const bodySchema = z.object({ confirmado: z.boolean() });
const tipoSchema = z.enum(['lab', 'estudio']);

export const PUT = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string; tipo: string; lecturaId: string }> }) => {
    const session = await requireSession(req);
    const { id, tipo, lecturaId } = await ctx.params;
    const { confirmado } = bodySchema.parse(await req.json());
    const res = await confirmarLectura(
      session.anesthesiologistId,
      id,
      tipoSchema.parse(tipo),
      lecturaId,
      confirmado,
    );
    return NextResponse.json(res);
  },
);
