import { getBoss } from './index';
import { logger } from '../logger';
import { onLabExtract, onLabFlag, onClinicalGenerate } from './handlers';

/**
 * Worker (npm run worker): arranca pg-boss y registra los handlers del pipeline.
 * U2-U3: form.submitted → lab.extract → lab.flag → clinical.generate. (document.render en U4.)
 */
async function main() {
  const boss = await getBoss();

  await boss.work('form.submitted', onLabExtract);
  await boss.work('lab.flag', onLabFlag);
  await boss.work('clinical.generate', onClinicalGenerate);

  logger.info('worker_ready — pipeline: form.submitted→lab.extract→lab.flag→clinical.generate');
  process.stdin.resume();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'worker_fatal');
  process.exit(1);
});
