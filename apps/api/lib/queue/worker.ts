import { getBoss } from './index';
import { logger } from '../logger';

/**
 * Worker entry (npm run worker). En U0 sólo arranca pg-boss; los handlers del
 * pipeline se registran aquí a partir de U2.
 */
async function main() {
  await getBoss();
  logger.info('worker_ready (sin handlers en U0)');
  // Mantener vivo el proceso.
  process.stdin.resume();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'worker_fatal');
  process.exit(1);
});
