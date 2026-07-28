import { randomBytes } from 'node:crypto';
import { CaseStatus } from '@prisma/client';
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
/** Cuerpo del correo escrito por el médico (texto plano) → HTML con botón de descarga. */
function composeHtml(bodyText: string, downloadUrl: string): string {
  const escaped = bodyText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;color:#14212b;line-height:1.55">
    <p>${escaped}</p>
    <p style="margin-top:18px"><a href="${downloadUrl.replace(/"/g, '&quot;')}" style="background:#0b5c6b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Descargar documento (PDF)</a></p>
    <p style="font-size:12px;color:#5b6b73">También puede descargarlo en: ${downloadUrl.replace(/</g, '&lt;')}</p>
  </div>`;
}

export interface DistributeOptions {
  contactIds: string[];
  channel: 'email' | 'link';
  baseUrl: string;
  sendToPatient?: boolean;
  /** Asunto y cuerpo editados por el médico (si no, se usan los del borrador). */
  subject?: string;
  body?: string;
}

export async function distribute(
  caseId: string,
  anesthesiologistId: string,
  opts: DistributeOptions,
): Promise<{ ok: boolean; error?: string; deliveries: { contactId: string; token: string; url: string }[] }> {
  const { contactIds, channel, baseUrl, sendToPatient = false } = opts;
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

  // PDF final adjunto (una sola lectura, reutilizado en todos los envíos).
  const pdf = await getStorageProvider().get(kase.approval.lockedPdfUrl);
  const filename = documentFilename(kase.patient?.fullName);
  const draft = buildDeliveryEmail({
    patientName: kase.patient?.fullName ?? 'Paciente',
    procedure: kase.procedure,
    doctorName: kase.anesthesiologist.fullName,
    downloadUrl: '',
  });
  const subject = opts.subject?.trim() || draft.subject;

  /** Crea el registro de entrega y envía (si canal=email) con el PDF adjunto. */
  const deliverTo = async (email: string, contactId: string | null, recipientEmail?: string) => {
    const token = randomBytes(24).toString('base64url');
    const url = `${baseUrl}/api/download/delivery/${token}`;
    await prisma.deliveryRecord.create({ data: { caseId, contactId, recipientEmail, channel, token } });
    if (channel === 'email') {
      const html = opts.body ? composeHtml(opts.body, url) : buildDeliveryEmail({
        patientName: kase.patient?.fullName ?? 'Paciente',
        procedure: kase.procedure,
        doctorName: kase.anesthesiologist.fullName,
        downloadUrl: url,
      }).html;
      try {
        await mailer.send({ to: [email], subject, html, attachments: [{ filename, content: pdf }] });
      } catch {
        // El DeliveryRecord persiste; el enlace queda disponible aunque falle el envío.
      }
    }
    return { token, url };
  };

  for (const contact of contacts) {
    const { token, url } = await deliverTo(contact.email, contact.id);
    deliveries.push({ contactId: contact.id, token, url });
  }

  if (sendToPatient && kase.patient?.email) {
    const { token, url } = await deliverTo(kase.patient.email, null, kase.patient.email);
    deliveries.push({ contactId: `patient:${kase.patient.id}`, token, url });
  }

  await prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.ENTREGADO } });
  await logAudit({ action: 'document.delivered', entity: 'Case', entityId: caseId, meta: { count: deliveries.length, channel } });
  return { ok: true, deliveries };
}

/** Borrador del correo (asunto + cuerpo en texto plano + nombre del PDF) para precargar el composer. */
export async function emailDraftForCase(
  caseId: string, anesthesiologistId: string,
): Promise<{ subject: string; body: string; pdfFilename: string } | null> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    include: {
      patient: { select: { fullName: true } },
      anesthesiologist: { select: { fullName: true, emailBodyTemplate: true } },
    },
  });
  if (!kase) return null;
  const patientName = kase.patient?.fullName ?? 'el paciente';
  const doctorName = kase.anesthesiologist.fullName;
  const subject = `Valoración preanestésica — ${patientName}`;
  const proc = kase.procedure ? ` para ${kase.procedure}` : '';

  // Si el médico guardó una plantilla en su perfil, se usa con los placeholders resueltos.
  // Placeholders soportados: {paciente} {procedimiento} {doctor}. Sin plantilla → default dinámico.
  const tpl = kase.anesthesiologist.emailBodyTemplate?.trim();
  const body = tpl
    ? tpl
        .replace(/\{paciente\}/g, patientName)
        .replace(/\{procedimiento\}/g, kase.procedure ?? '')
        .replace(/\{doctor\}/g, doctorName)
    : `Estimado(a) destinatario(a):\n\n` +
      `Adjunto la valoración preanestésica${proc} del paciente ${patientName}, aprobada y firmada por ${doctorName}.\n\n` +
      `Quedo atento(a) a cualquier consulta.\n\n${doctorName}`;
  return { subject, body, pdfFilename: documentFilename(kase.patient?.fullName) };
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
