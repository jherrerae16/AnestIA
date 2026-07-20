import { CaseStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { generateCaseToken } from '../auth/token';
import { logAudit } from '../audit';

const LINK_TTL_DAYS = 7;

/** Crea un caso y su enlace tokenizado. Estado inicial: ENVIADO_AL_PACIENTE. */
export async function createCase(
  anesthesiologistId: string,
  input: { presetId: string; procedure?: string },
) {
  const linkToken = generateCaseToken();
  const linkExpiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  const kase = await prisma.case.create({
    data: {
      anesthesiologistId,
      presetId: input.presetId,
      procedure: input.procedure,
      linkToken,
      linkExpiresAt,
      status: CaseStatus.ENVIADO_AL_PACIENTE,
    },
  });

  await logAudit({
    actorId: anesthesiologistId,
    action: 'case.created',
    entity: 'Case',
    entityId: kase.id,
  });

  return { caseId: kase.id, linkToken, linkExpiresAt };
}

export function getCase(anesthesiologistId: string, id: string) {
  return prisma.case.findFirst({
    where: { id, anesthesiologistId },
    include: { formResponse: true, attachments: true, consent: true, patient: true },
  });
}
