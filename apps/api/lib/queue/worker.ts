import { getBoss } from './index';
import { logger } from '../logger';
import { onLabExtract, onLabFlag } from './handlers';

/**
 * Worker (npm run worker): arranca pg-boss y registra los handlers del pipeline.
 * U2: form.submitted → lab.extract → lab.flag. (clinical.generate/document.render en U3/U4.)
 */
async function main() {
  const boss = await getBoss();

  await boss.work('form.submitted', onLabExtract);
  await boss.work('lab.flag', onLabFlag);

  logger.info('worker_ready — handlers: form.submitted→lab.extract, lab.flag');
  process.stdin.resume();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'worker_fatal');
  process.exit(1);
});
