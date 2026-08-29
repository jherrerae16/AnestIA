import { CaseStatus, type Prisma } from '@prisma/client';
import { medicalTerm, type CreateCaseDef, type ScheduleDef } from '@anestia/shared';
import { prisma } from '../prisma';
import { generateCaseToken } from '../auth/token';
import { logAudit } from '../audit';
import { refrescarEscalas } from './approval.service';

const LINK_TTL_DAYS = 7;

/** `ScheduleDef` (contrato compartido) → fila de `CaseSchedule`. */
function toScheduleRow(s: ScheduleDef): Prisma.CaseScheduleCreateWithoutCaseInput {
  const fecha = s.fechaHora ? new Date(s.fechaHora) : null;
  return {
    procedimiento: s.procedimiento,
    diagnosticoPreop: s.diagnosticoPreop ?? null,
    fechaHora: fecha && !isNaN(fecha.getTime()) ? fecha : null,
    especialidad: s.especialidad ?? null,
    modalidad: s.modalidad ?? null,
    prioridad: s.prioridad ?? null,
    sitioQuirurgico: s.sitioQuirurgico ?? null,
    duracionEstimada: s.duracionEstimada ?? null,
    altoRiesgoRcri: s.altoRiesgoRcri ?? null,
    anestesiaProbable: s.anestesiaProbable ?? null,
    opioidesPostop: s.opioidesPostop ?? null,
  };
}

/**
 * Crea un caso con su agenda quirúrgica y su enlace tokenizado.
 *
 * `Case.procedure` y `Case.procedureDate` se conservan como READ-MODEL denormalizado: el panel,
 * el calendario, la exportación y el recordatorio diario los leen, y moverlos dejaría cuatro
 * superficies en blanco. La verdad vive en `CaseSchedule`; estos dos se sincronizan al escribir.
 */
export async function createCase(anesthesiologistId: string, input: CreateCaseDef) {
  const linkToken = generateCaseToken();
  const linkExpiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
  const fila = toScheduleRow(input.schedule);

  const kase = await prisma.case.create({
    data: {
      anesthesiologistId,
      presetId: input.presetId,
      patientId: input.patientId ?? null,
      // Mismo término médico que usa el documento ('lipo' → 'Liposucción'), para que el panel
      // y el PDF no muestren textos distintos del mismo procedimiento.
      procedure: medicalTerm(input.schedule.procedimiento),
      procedureDate: fila.fechaHora ?? null,
      linkToken,
      linkExpiresAt,
      status: CaseStatus.ENVIADO_AL_PACIENTE,
      schedule: { create: { ...fila, fuente: 'ANESTESIOLOGO', registradoPor: anesthesiologistId } },
    },
  });

  await logAudit({
    actorId: anesthesiologistId,
    action: 'case.created',
    entity: 'Case',
    entityId: kase.id,
    meta: { conAgenda: true, faltantes: input.schedule.sitioQuirurgico == null },
  });

  return { caseId: kase.id, linkToken, linkExpiresAt };
}

/** Actualiza la agenda de un caso y resincroniza el read-model de `Case`. */
export async function updateSchedule(
  anesthesiologistId: string,
  caseId: string,
  input: ScheduleDef,
) {
  const kase = await prisma.case.findFirst({ where: { id: caseId, anesthesiologistId } });
  if (!kase) return null;
  const fila = toScheduleRow(input);

  await prisma.$transaction([
    prisma.caseSchedule.upsert({
      where: { caseId },
      update: { ...fila, registradoPor: anesthesiologistId },
      create: { ...fila, caseId, fuente: 'ANESTESIOLOGO', registradoPor: anesthesiologistId },
    }),
    prisma.case.update({
      where: { id: caseId },
      data: { procedure: medicalTerm(input.procedimiento), procedureDate: fila.fechaHora ?? null },
    }),
  ]);

  await logAudit({
    actorId: anesthesiologistId,
    action: 'case.schedule_updated',
    entity: 'Case',
    entityId: caseId,
  });

  // Completar la agenda destraba escalas: ARISCAT depende del sitio y la duración, Caprini de
  // la modalidad, Apfel del plan anestésico. Sin recalcular seguirían pendientes por un dato
  // que el médico ya llenó.
  await refrescarEscalas(caseId);
  return { ok: true };
}

export function getCase(anesthesiologistId: string, id: string) {
  return prisma.case.findFirst({
    where: { id, anesthesiologistId },
    include: { formResponse: true, attachments: true, consent: true, patient: true },
  });
}
