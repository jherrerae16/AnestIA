import { createHash } from 'node:crypto';
import { prisma } from '../prisma';
import { renderPdf } from '../pdf/renderer';
import { getStorageProvider } from '../storage';
import { logAudit } from '../audit';
import { brandingDataUri } from '../pdf/branding';
import { auditForCase } from './audit-clinical.service';
import {
  canApprove,
  applyExamNormal,
  applyEdit,
  buildDocumentHtml,
  type Branding,
  type DocumentJSON,
  type AuditReport,
} from '@anestia/shared';

/** Carga los datos de revisión: assessment + respuestas fuente + labs (con sourceRef). */
export async function getReview(caseId: string, anesthesiologistId: string) {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    include: {
      assessment: true,
      formResponse: true,
      labResults: true,
      approval: true,
      patient: { select: { fullName: true, email: true } },
    },
  });
  if (!kase) return null;
  const fields = (kase.assessment?.fields as DocumentJSON) ?? null;
  return {
    caseId,
    status: kase.status,
    fields,
    answers: kase.formResponse?.answers ?? {},
    labs: kase.labResults.map((l) => ({ analyte: l.analyte, value: l.value, unit: l.unit, flag: l.flag, sourceRef: l.sourceRef })),
    approved: Boolean(kase.approval),
    patient: kase.patient ? { fullName: kase.patient.fullName, email: kase.patient.email } : null,
    // Reporte del auditor independiente (hallazgos para el anestesiólogo).
    audit: kase.assessment?.auditReport ?? null,
    canApprove: fields ? canApprove(fields) : { ok: false, blockers: ['No hay borrador generado.'] },
  };
}

async function loadFields(caseId: string, anesthesiologistId: string): Promise<{ assessmentId: string; fields: DocumentJSON } | null> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    include: { assessment: true, approval: true },
  });
  if (!kase?.assessment) return null;
  if (kase.approval) throw new ApprovedLockError(); // guard: inmutable tras aprobar
  return { assessmentId: kase.assessment.id, fields: kase.assessment.fields as DocumentJSON };
}

export class ApprovedLockError extends Error {
  constructor() { super('El caso ya fue aprobado; el documento es inmutable.'); this.name = 'ApprovedLockError'; }
}

/** Edición en línea de un campo (guard: no aprobado). */
export async function editAssessment(
  caseId: string, anesthesiologistId: string,
  section: keyof DocumentJSON, key: string, value: string,
): Promise<void> {
  const loaded = await loadFields(caseId, anesthesiologistId);
  if (!loaded) return;
  const next = applyEdit(loaded.fields, section, key, value);
  await prisma.generatedAssessment.update({ where: { id: loaded.assessmentId }, data: { fields: next as never } });
  await logAudit({ action: 'assessment.edited', entity: 'Case', entityId: caseId, meta: { section, key } });
  // El médico corrigió → el auditor vuelve a revisar sobre el contenido nuevo.
  await auditForCase(caseId);
}

/** "Cargar examen normal": confirma valores normales (fuente=anestesiologo). */
export async function loadExamNormal(caseId: string, anesthesiologistId: string): Promise<void> {
  const loaded = await loadFields(caseId, anesthesiologistId);
  if (!loaded) return;
  const next = applyExamNormal(loaded.fields);
  await prisma.generatedAssessment.update({ where: { id: loaded.assessmentId }, data: { fields: next as never } });
  await logAudit({
    action: 'assessment.exam_confirmed',
    entity: 'Case',
    entityId: caseId,
    meta: { mode: 'normal', attested: true, note: 'examen normal confirmado por atestación del anestesiólogo' },
  });
  await auditForCase(caseId);
}

/** Ingreso de valores reales del examen (fuente=anestesiologo). */
export async function setExam(
  caseId: string, anesthesiologistId: string, values: Record<string, string>,
): Promise<void> {
  const loaded = await loadFields(caseId, anesthesiologistId);
  if (!loaded) return;
  const examen_fisico = { ...loaded.fields.examen_fisico };
  for (const [k, v] of Object.entries(values)) {
    examen_fisico[k] = { valor: v, estado: 'ok', fuente: 'anestesiologo' };
  }
  const next = { ...loaded.fields, examen_fisico };
  await prisma.generatedAssessment.update({ where: { id: loaded.assessmentId }, data: { fields: next as never } });
  await logAudit({ action: 'assessment.exam_confirmed', entity: 'Case', entityId: caseId, meta: { mode: 'manual' } });
  await auditForCase(caseId);
}

/**
 * Aprobación: re-chequea canApprove (server-side), snapshot+hash, PDF final inmutable,
 * ApprovalRecord, lock, audit, status APROBADO. La IA nunca llega aquí (CS1).
 */
export async function approve(caseId: string, anesthesiologistId: string): Promise<{ ok: boolean; blockers?: string[] }> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    include: { assessment: true, approval: true, anesthesiologist: true },
  });
  if (!kase?.assessment) return { ok: false, blockers: ['No hay borrador.'] };
  if (kase.approval) return { ok: true }; // idempotente

  const fields = kase.assessment.fields as DocumentJSON;
  const check = canApprove(fields);
  if (!check.ok) return { ok: false, blockers: check.blockers };

  // Auditor: los hallazgos BLOQUEANTES (seguridad dura: campo sin fuente, valor inventado
  // en el examen físico) no pueden llegar a un documento firmado. El resto son advertencias
  // y las decide el anestesiólogo.
  const report = kase.assessment.auditReport as AuditReport | null;
  if (report?.blocked) {
    const criticos = report.findings.filter((f) => f.level === 'bloqueante').map((f) => f.message);
    return { ok: false, blockers: criticos };
  }

  const a = kase.anesthesiologist;
  const branding: Branding = {
    logoUrl: await brandingDataUri(a.clinicLogoUrl),
    signatureUrl: await brandingDataUri(a.signatureUrl),
    doctorName: a.fullName,
    specialty: a.specialty,
    registry: a.medicalRegistry,
    footer: a.footerText ?? 'Documento aprobado y firmado electrónicamente por el anestesiólogo tratante',
  };
  // PDF final: sin marca de agua (draft:false).
  const html = buildDocumentHtml(fields, branding, { draft: false, fechaValoracion: new Date().toLocaleDateString('es-CO') });
  const pdf = await renderPdf(html);
  const { key } = await getStorageProvider().put(pdf, { caseId, type: 'FINAL_PDF', filename: 'valoracion-final.pdf' });

  const snapshot = JSON.stringify(fields);
  const hash = createHash('sha256').update(snapshot).digest('hex');

  await prisma.$transaction([
    prisma.approvalRecord.create({
      data: { caseId, approvedById: anesthesiologistId, lockedPdfUrl: key, edits: { hash, snapshot: fields } as never },
    }),
    prisma.case.update({ where: { id: caseId }, data: { status: 'APROBADO' } }),
  ]);

  await logAudit({ action: 'assessment.approved', entity: 'Case', entityId: caseId, meta: { hash, lockedPdfUrl: key } });
  return { ok: true };
}

/** Rechaza: reabre el formulario al paciente. */
export async function reject(caseId: string, anesthesiologistId: string, reason: string): Promise<void> {
  const kase = await prisma.case.findFirst({ where: { id: caseId, anesthesiologistId }, include: { approval: true } });
  if (!kase || kase.approval) return;
  await prisma.case.update({ where: { id: caseId }, data: { status: 'RESPONDIENDO' } });
  await prisma.formResponse.updateMany({ where: { caseId }, data: { partial: true, submittedAt: null } });
  await logAudit({ action: 'assessment.rejected', entity: 'Case', entityId: caseId, meta: { reason } });
}

/**
 * Reabre un caso APROBADO para corrección (CS7 con trazabilidad). Guarda en el audit log
 * la versión aprobada previa (snapshot + hash + PDF) antes de eliminar el ApprovalRecord,
 * y regresa el caso a PENDIENTE_REVISION. Al re-aprobar se genera una versión nueva.
 * Devuelve false si el caso no existe/no pertenece o no estaba aprobado.
 */
export async function reopenApproved(
  caseId: string, anesthesiologistId: string, reason: string,
): Promise<boolean> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    include: { approval: true },
  });
  if (!kase || !kase.approval) return false;

  const prev = kase.approval;
  // Trazabilidad: registra la versión aprobada que se está reabriendo.
  await logAudit({
    action: 'assessment.reopened',
    entity: 'Case',
    entityId: caseId,
    meta: {
      reason,
      previousApprovalId: prev.id,
      previousLockedPdfUrl: prev.lockedPdfUrl,
      previousEdits: prev.edits as never,
      reopenedBy: anesthesiologistId,
    },
  });

  await prisma.$transaction([
    prisma.deliveryRecord.deleteMany({ where: { caseId } }),
    prisma.approvalRecord.delete({ where: { id: prev.id } }),
    prisma.case.update({ where: { id: caseId }, data: { status: 'PENDIENTE_REVISION' } }),
  ]);

  return true;
}
