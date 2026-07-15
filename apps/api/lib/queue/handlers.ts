import { prisma } from '../prisma';
import { publish } from './index';
import { logger } from '../logger';
import { logAudit } from '../audit';
import { extractForCase, flagForCase } from '../services/lab.service';

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
