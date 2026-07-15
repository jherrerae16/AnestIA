import { prisma } from '../prisma';
import { publish } from './index';
import { logger } from '../logger';
import { logAudit } from '../audit';
import { extractForCase, flagForCase } from '../services/lab.service';
import { generateForCase } from '../services/clinical.service';
import { renderDraftForCase } from '../services/document.service';

type Job = { data: { caseId: string } };

/**
 * Handler form.submitted → lab.extract. Idempotente, fail-closed: si algo falla
 * la excepción se propaga (pg-boss reintenta) y el estado NO avanza.
 */
export async function onLabExtract(jobs: Job[]): Promise<void> {
  for (const job of jobs) {
    const { caseId } = job.data;
    await extractForCase(caseId);
    await prisma.case.update({ where: { id: caseId }, data: { status: 'LABS_ANALIZADOS' } }).catch(() => {});
    await logAudit({ action: 'lab.extracted', entity: 'Case', entityId: caseId });
    logger.info({ caseId }, 'lab_extract_done');
    await publish('lab.flag', { caseId });
  }
}

/** Handler lab.flag → clinical.generate. */
export async function onLabFlag(jobs: Job[]): Promise<void> {
  for (const job of jobs) {
    const { caseId } = job.data;
    await flagForCase(caseId);
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
    await generateForCase(caseId);
    await prisma.case.update({ where: { id: caseId }, data: { status: 'BORRADOR_GENERADO' } }).catch(() => {});
    logger.info({ caseId }, 'clinical_generate_done');
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
    const fecha = new Date().toLocaleDateString('es-CO');
    await renderDraftForCase(caseId, fecha);
    await prisma.case.update({ where: { id: caseId }, data: { status: 'PENDIENTE_REVISION' } }).catch(() => {});
    logger.info({ caseId }, 'document_render_done');
  }
}
