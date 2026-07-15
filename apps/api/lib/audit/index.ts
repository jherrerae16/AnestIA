import { prisma } from '../prisma';

/**
 * AuditLogger — escritura append-only en AuditLog (CS7). La app nunca modifica
 * ni borra entradas de auditoría; sólo agrega.
 */
export async function logAudit(entry: {
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      meta: (entry.meta ?? undefined) as never,
    },
  });
}
