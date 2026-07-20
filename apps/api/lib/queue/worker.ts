import { getBoss } from './index';
import { logger } from '../logger';
import { onLabExtract, onLabFlag, onClinicalGenerate, onClinicalAudit, onDocumentRender, onDailyReminder } from './handlers';
import { reconcileStuckCases } from '../services/reconciler.service';

/**
 * Worker (npm run worker): arranca pg-boss y registra los handlers del pipeline COMPLETO.
 * form.submitted → lab.extract → lab.flag → clinical.generate → document.render → PENDIENTE_REVISION.
 * Además programa el recordatorio matutino de cirugías (7am Colombia).
 */
async function main() {
  const boss = await getBoss();

  await boss.work('form.submitted', onLabExtract);
  await boss.work('lab.flag', onLabFlag);
  await boss.work('clinical.generate', onClinicalGenerate);
  await boss.work('clinical.audit', onClinicalAudit);
  await boss.work('document.render', onDocumentRender);

  // Recordatorio matutino: cron 7:00 hora de Colombia. schedule() es idempotente por nombre
  // de cola, así que reiniciar el worker no duplica la programación.
  await boss.work('reminder.daily', onDailyReminder);
  await boss.schedule('reminder.daily', '0 7 * * *', {}, { tz: 'America/Bogota' });

  // Reconciliador (C-1): al arrancar, re-emite form.submitted para casos enviados que se
  // quedaron sin pipeline (p. ej. un publish falló tras el commit). Idempotente.
  await reconcileStuckCases().catch((err) =>
    logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'reconciler_boot_failed'),
  );

  logger.info('worker_ready — pipeline + recordatorio matutino (7am America/Bogota) + reconciliador');
  process.stdin.resume();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'worker_fatal');
  process.exit(1);
});
