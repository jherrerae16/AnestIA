import { randomBytes } from 'node:crypto';
import { prisma } from '../prisma';
import { getMailer } from '../mailer';
import { getStorageProvider } from '../storage';
import { logAudit } from '../audit';
import { buildDeliveryEmail } from '@anestia/shared';
import { documentFilename } from './document.service';

/**
 * Distribuye el reporte final. Guard: SÓLO casos APROBADOS (PDF inmutable) — CS7/RF-8.4.
 * Genera un DeliveryRecord con token por contacto; envía por email (si el canal lo pide y
 * hay mailer real) y siempre expone un enlace de descarga tokenizado. Registra audit.
 */
export async function distribute(
  caseId: string,
  anesthesiologistId: string,
  contactIds: string[],
  channel: 'email' | 'link',
  baseUrl: string,
  sendToPatient = false,
): Promise<{ ok: boolean; error?: string; deliveries: { contactId: string; token: string; url: string }[] }> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    include: { approval: true, patient: true, anesthesiologist: true },
  });
  if (!kase) return { ok: false, error: 'Caso no encontrado.', deliveries: [] };
  if (!kase.approval?.lockedPdfUrl) {
    return { ok: false, error: 'El caso no está aprobado; no se puede distribuir.', deliveries: [] };
  }

  const contacts = await prisma.directoryContact.findMany({
    where: { id: { in: contactIds }, ownerId: anesthesiologistId },
  });

  const mailer = getMailer();
  const deliveries: { contactId: string; token: string; url: string }[] = [];

  for (const contact of contacts) {
    const token = randomBytes(24).toString('base64url');
    const url = `${baseUrl}/api/download/delivery/${token}`;
    await prisma.deliveryRecord.create({
      data: { caseId, contactId: contact.id, channel, token },
    });

    if (channel === 'email') {
      const { subject, html } = buildDeliveryEmail({
        patientName: kase.patient?.fullName ?? 'Paciente',
        procedure: kase.procedure,
        doctorName: kase.anesthesiologist.fullName,
        downloadUrl: url,
      });
      try {
        await mailer.send({ to: [contact.email], subject, html });
      } catch {
        // No perdemos el DeliveryRecord; el envío puede reintentarse o usarse el enlace.
      }
    }

    deliveries.push({ contactId: contact.id, token, url });
  }

  // Envío opcional al correo del paciente registrado (no es un contacto del directorio).
  if (sendToPatient && kase.patient?.email) {
    const token = randomBytes(24).toString('base64url');
    const url = `${baseUrl}/api/download/delivery/${token}`;
    await prisma.deliveryRecord.create({
      data: { caseId, contactId: null, recipientEmail: kase.patient.email, channel, token },
    });
    if (channel === 'email') {
      const { subject, html } = buildDeliveryEmail({
        patientName: kase.patient?.fullName ?? 'Paciente',
        procedure: kase.procedure,
        doctorName: kase.anesthesiologist.fullName,
        downloadUrl: url,
      });
      try {
        await mailer.send({ to: [kase.patient.email], subject, html });
      } catch {
        // El DeliveryRecord persiste; el enlace queda disponible aunque falle el envío.
      }
    }
    deliveries.push({ contactId: `patient:${kase.patient.id}`, token, url });
  }

  await prisma.case.update({ where: { id: caseId }, data: { status: 'ENTREGADO' } });
  await logAudit({ action: 'document.delivered', entity: 'Case', entityId: caseId, meta: { count: deliveries.length, channel } });
  return { ok: true, deliveries };
}

/** Sirve el PDF final por token de entrega; marca accessedAt. Incluye nombre de archivo. */
export async function serveDelivery(token: string): Promise<{ pdf: Buffer; filename: string } | null> {
  const rec = await prisma.deliveryRecord.findUnique({
    where: { token },
    include: { case: { include: { approval: true, patient: { select: { fullName: true } } } } },
  });
  if (!rec?.case.approval?.lockedPdfUrl) return null;
  if (!rec.accessedAt) {
    await prisma.deliveryRecord.update({ where: { id: rec.id }, data: { accessedAt: new Date() } });
    await logAudit({ action: 'document.accessed', entity: 'Case', entityId: rec.caseId, meta: { token } });
  }
  const pdf = await getStorageProvider().get(rec.case.approval.lockedPdfUrl);
  return { pdf, filename: documentFilename(rec.case.patient?.fullName) };
}
