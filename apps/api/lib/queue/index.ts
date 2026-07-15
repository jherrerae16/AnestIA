import PgBoss from 'pg-boss';
import { logger } from '../logger';

/**
 * QueueManager — pg-boss respaldado en PostgreSQL. pg-boss v10 requiere que la cola
 * exista (createQueue) antes de encolar/consumir. Registramos aquí las colas del pipeline.
 * Handlers (lab.extract → lab.flag → clinical.generate → document.render) se registran en U2-U4.
 */
let boss: PgBoss | null = null;

/** Colas del pipeline event-driven. */
export const QUEUES = [
  'form.submitted',
  'lab.extract',
  'lab.flag',
  'clinical.generate',
  'document.render',
] as const;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no definido.');
  boss = new PgBoss({ connectionString });
  boss.on('error', (err) => logger.error({ err: err.message }, 'pgboss_error'));
  await boss.start();
  // Crear las colas (idempotente) — requerido en pg-boss v10.
  for (const q of QUEUES) {
    await boss.createQueue(q);
  }
  logger.info('pgboss_started');
  return boss;
}

export async function publish(job: string, payload: Record<string, unknown>): Promise<void> {
  const b = await getBoss();
  await b.send(job, payload);
}
