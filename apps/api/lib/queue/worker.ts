import { getBoss } from './index';
import { logger } from '../logger';
import { onLabExtract, onLabFlag, onClinicalGenerate, onClinicalAudit, onDocumentRender } from './handlers';

/**
 * Worker (npm run worker): arranca pg-boss y registra los handlers del pipeline COMPLETO.
 * form.submitted → lab.extract → lab.flag → clinical.generate → document.render → PENDIENTE_REVISION.
 */
async function main() {
  const boss = await getBoss();

  await boss.work('form.submitted', onLabExtract);
  await boss.work('lab.flag', onLabFlag);
  await boss.work('clinical.generate', onClinicalGenerate);
  await boss.work('clinical.audit', onClinicalAudit);
  await boss.work('document.render', onDocumentRender);

  logger.info('worker_ready — pipeline completo hasta PENDIENTE_REVISION');
  process.stdin.resume();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'worker_fatal');
  process.exit(1);
});
