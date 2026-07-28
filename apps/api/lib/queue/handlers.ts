import { CaseStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { publish } from './index';
import { logger } from '../logger';
import { logAudit } from '../audit';
import { extractForCase, flagForCase } from '../services/lab.service';
import { generateForCase } from '../services/clinical.service';
import { auditForCase } from '../services/audit-clinical.service';
import { renderDraftForCase } from '../services/document.service';
import { sendDailyReminders } from '../services/reminder.service';

type Job = { data: { caseId: string } };

/**
 * Ejecuta una etapa del pipeline dejando rastro del fallo.
 *
 * Fail-closed (la excepción se propaga y pg-boss reintenta) pero NO silencioso: si la etapa
 * revienta, se registra en el audit log. Sin esto, un job agotado deja el caso parado para
 * siempre sin más señal que un estado que no avanza — que es justo lo que pasó con la
 * extracción truncada.
 */
async function runStage(caseId: string, stage: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ caseId, stage, err: message }, 'pipeline_stage_failed');
    await logAudit({
      action: 'pipeline.stage_failed',
      entity: 'Case',
      entityId: caseId,
      meta: { stage, error: message },
    }).catch(() => {});
    throw err;
  }
}

/**
 * Handler form.submitted → lab.extract. Idempotente, fail-closed: si algo falla
 * la excepción se propaga (pg-boss reintenta) y el estado NO avanza.
 */
export async function onLabExtract(jobs: Job[]): Promise<void> {
  for (const job of jobs) {
    const { caseId } = job.data;
    await runStage(caseId, 'lab.extract', () => extractForCase(caseId));
    await prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.LABS_ANALIZADOS } }).catch(() => {});
    await logAudit({ action: 'lab.extracted', entity: 'Case', entityId: caseId });
    logger.info({ caseId }, 'lab_extract_done');
    await publish('lab.flag', { caseId });
  }
}

/** Handler lab.flag → clinical.generate. */
export async function onLabFlag(jobs: Job[]): Promise<void> {
  for (const job of jobs) {
    const { caseId } = job.data;
    await runStage(caseId, 'lab.flag', () => flagForCase(caseId));
    await logAudit({ action: 'lab.flagged', entity: 'Case', entityId: caseId });
    logger.info({ caseId }, 'lab_flag_done');
    await publish('clinical.generate', { caseId });
  }
}

/**
 * Handler clinical.generate → document.render. Genera el borrador estructurado
 * (guardarraíles CS2/CS3/CS4/CS5), avanza estado, publica render.
 */
export async function onClinicalGenerate(jobs: Job[]): Promise<void> {
  for (const job of jobs) {
    const { caseId } = job.data;
    await runStage(caseId, 'clinical.generate', () => generateForCase(caseId));
    await prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.BORRADOR_GENERADO } }).catch(() => {});
    logger.info({ caseId }, 'clinical_generate_done');
    // Eslabón nuevo: auditor independiente antes de renderizar (generador + crítico).
    await publish('clinical.audit', { caseId });
  }
}

/**
 * Handler clinical.audit → document.render. El auditor revisa el borrador y deja su
 * reporte pegado al caso. NO interrumpe el flujo: aunque encuentre hallazgos bloqueantes,
 * el documento se renderiza como borrador y los hallazgos se le muestran al anestesiólogo
 * en la revisión (el bloqueo real ocurre en la aprobación, que es donde decide el humano).
 */
export async function onClinicalAudit(jobs: Job[]): Promise<void> {
  for (const job of jobs) {
    const { caseId } = job.data;
    await runStage(caseId, 'clinical.audit', () => auditForCase(caseId));
    await publish('document.render', { caseId });
  }
}

/**
 * Handler document.render: renderiza el PDF de borrador (Diseño Oficial) y avanza a
 * PENDIENTE_REVISION. Fin del pipeline automático; sigue la revisión humana (U5).
 */
export async function onDocumentRender(jobs: Job[]): Promise<void> {
  for (const job of jobs) {
    const { caseId } = job.data;
    await runStage(caseId, 'document.render', () => renderDraftForCase(caseId));
    await prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.PENDIENTE_REVISION } }).catch(() => {});
    logger.info({ caseId }, 'document_render_done');
  }
}

/**
 * Handler reminder.daily (job programado, 7am Colombia). No pertenece al pipeline de un caso:
 * recorre los perfiles suscritos y les manda el correo con las cirugías de hoy/mañana.
 * pg-boss puede entregar el tick agrupado; un solo envío por corrida basta (idempotente por día).
 */
export async function onDailyReminder(_jobs: Job[]): Promise<void> {
  try {
    await sendDailyReminders(new Date());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'daily_reminder_failed');
    await logAudit({ action: 'reminder.failed', entity: 'Anesthesiologist', meta: { error: message } }).catch(() => {});
    throw err;
  }
}
