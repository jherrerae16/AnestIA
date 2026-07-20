import { CaseStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { publish } from '../queue';
import { logAudit } from '../audit';
import { logger } from '../logger';

/**
 * Reconciliador de casos atascados (C-1 de la auditoría).
 *
 * Si `publish('form.submitted')` falla tras el commit del envío (broker caído, reinicio),
 * el caso queda con `formResponse.submittedAt` y datos completos pero el pipeline nunca
 * arranca; `submittedAt` impide que un reenvío del paciente lo re-emita. Antes se recuperaba
 * a mano. Este job los detecta y re-emite `form.submitted`.
 *
 * Idempotente y seguro:
 *  - Sólo toca casos con formulario enviado (`submittedAt` no nulo) y SIN assessment generado.
 *  - Sólo estados intermedios (aún no llegaron a borrador/revisión), para no re-disparar un
 *    caso que ya avanzó.
 *  - El pipeline aguas abajo ya es idempotente (`generateForCase` corta si hay assessment;
 *    la extracción hace upsert), así que re-emitir de más no duplica datos.
 */

/** Estados en los que un caso enviado pero sin assessment está legítimamente "a medias". */
const ESTADOS_ATASCABLES: CaseStatus[] = [CaseStatus.RESPUESTAS_RECIBIDAS, CaseStatus.LABS_ANALIZADOS];

export async function reconcileStuckCases(): Promise<{ reencolados: number }> {
  const stuck = await prisma.case.findMany({
    where: {
      status: { in: ESTADOS_ATASCABLES },
      formResponse: { is: { submittedAt: { not: null } } },
      assessment: { is: null },
    },
    select: { id: true, status: true },
  });

  if (stuck.length === 0) {
    logger.info('reconciler_no_stuck_cases');
    return { reencolados: 0 };
  }

  let reencolados = 0;
  for (const c of stuck) {
    try {
      await publish('form.submitted', { caseId: c.id });
      await logAudit({
        action: 'form.submitted.reconciled',
        entity: 'Case',
        entityId: c.id,
        meta: { fromStatus: c.status },
      });
      reencolados++;
    } catch (err) {
      // Un fallo aquí no debe tumbar el arranque del worker; se registra y se sigue.
      logger.error({ caseId: c.id, err: err instanceof Error ? err.message : 'unknown' }, 'reconciler_republish_failed');
    }
  }

  logger.info({ encontrados: stuck.length, reencolados }, 'reconciler_done');
  return { reencolados };
}
