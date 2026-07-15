import { createHash } from 'node:crypto';
import { prisma } from '../prisma';
import { renderPdf } from '../pdf/renderer';
import { getStorageProvider } from '../storage';
import { logAudit } from '../audit';
import { brandingDataUri } from '../pdf/branding';
import {
  canApprove,
  applyExamNormal,
  applyEdit,
  buildDocumentHtml,
  type Branding,
  type DocumentJSON,
} from '@anestia/shared';

/** Carga los datos de revisión: assessment + respuestas fuente + labs (con sourceRef). */
export async function getReview(caseId: string, anesthesiologistId: string) {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    include: { assessment: true, formResponse: true, labResults: true, approval: true },
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
}

/** "Cargar examen normal": confirma valores normales (fuente=anestesiologo). */
export async function loadExamNormal(caseId: string, anesthesiologistId: string): Promise<void> {
  const loaded = await loadFields(caseId, anesthesiologistId);
  if (!loaded) return;
  const next = applyExamNormal(loaded.fields);
  await prisma.generatedAssessment.update({ where: { id: loaded.assessmentId }, data: { fields: next as never } });
  await logAudit({ action: 'assessment.exam_confirmed', entity: 'Case', entityId: caseId, meta: { mode: 'normal' } });
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
