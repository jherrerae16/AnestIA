import { createHash } from 'node:crypto';
import { CaseStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { renderPdf } from '../pdf/renderer';
import { getStorageProvider } from '../storage';
import { logAudit } from '../audit';
import { brandingDataUri } from '../pdf/branding';
import { filenameFromKey, isViewableInline, mimeFor } from '../mime';
import { auditForCase } from './audit-clinical.service';
import { getNoteForCase } from './note.service';
import { regenerateParaclinicos } from './clinical.service';
import {
  canApprove,
  applyExamNormal,
  applyEdit,
  buildDocumentHtml,
  buildFooterTemplate,
  groupLabsToProse,
  formatReportDate,
  normalizeGrupo,
  type Branding,
  type DocumentJSON,
  type AuditReport,
} from '@anestia/shared';

/** Edad en años a partir de la fecha de nacimiento. Null si no hay fecha o es absurda. */
function edadDesde(birthDate: Date | null, hoy: Date): number | null {
  if (!birthDate) return null;
  let edad = hoy.getFullYear() - birthDate.getFullYear();
  const m = hoy.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < birthDate.getDate())) edad--;
  return edad >= 0 && edad < 130 ? edad : null;
}

/**
 * Ficha del paciente para la pantalla de revisión. Devuelve lo que el paciente reportó
 * (contacto, aseguradora, grupo sanguíneo) además del nombre: el médico necesita poder
 * llamarlo o comprobar su aseguradora sin salir del caso.
 */
function patientSummary(p: {
  fullName: string;
  documentId: string;
  birthDate: Date | null;
  sex: string | null;
  phone: string | null;
  email: string | null;
  insurer: string | null;
  bloodType: string | null;
}) {
  return {
    fullName: p.fullName,
    documentId: p.documentId,
    birthDate: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null,
    edad: edadDesde(p.birthDate, new Date()),
    sex: p.sex,
    phone: p.phone,
    email: p.email,
    insurer: p.insurer,
    bloodType: p.bloodType,
  };
}

/** Carga los datos de revisión: assessment + respuestas fuente + labs + adjuntos originales. */
export async function getReview(caseId: string, anesthesiologistId: string) {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    include: {
      assessment: true,
      formResponse: true,
      labResults: true,
      attachments: true,
      approval: true,
      patient: true,
    },
  });
  if (!kase) return null;
  const fields = (kase.assessment?.fields as DocumentJSON) ?? null;
  // Nota privada del médico sobre este paciente: se muestra "sola" en la pantalla del caso.
  // Nunca entra al PDF ni a la distribución — sólo viaja a la UI de revisión.
  const patientNote = await getNoteForCase(anesthesiologistId, kase.patientId);
  return {
    caseId,
    status: kase.status,
    fields,
    answers: kase.formResponse?.answers ?? {},
    labs: kase.labResults.map((l) => ({
      id: l.id,
      analyte: l.analyte,
      value: l.value,
      unit: l.unit,
      grupo: l.grupo,
      refRange: l.refRange,
      reportDate: l.reportDate ? l.reportDate.toISOString().slice(0, 10) : null,
      flag: l.flag,                 // veredicto del sistema
      manualFlag: l.manualFlag,     // veredicto del médico (null si no marcó)
      manualSource: l.manualSource,
      // Flag EFECTIVO que rige en la UI y el documento: manual ?? sistema.
      effectiveFlag: l.manualFlag ?? l.flag,
      // true = el rango impreso no se pudo leer; la UI avisa "verifica manualmente".
      rangeUnparsed: l.rangeUnparsed,
      sourceRef: l.sourceRef,
    })),
    // Agrupado por estudio con fecha y vigencia ya resueltas: la regla de antigüedad vive
    // en shared (un solo sitio), no duplicada en el cliente.
    labGroups: groupLabsToProse(
      kase.labResults.map((l) => ({
        analyte: l.analyte,
        value: l.value,
        unit: l.unit,
        grupo: l.grupo,
        reportDate: l.reportDate ? l.reportDate.toISOString().slice(0, 10) : null,
        flag: l.flag,
        sourceRef: l.sourceRef ?? undefined,
      })),
      new Date().toISOString().slice(0, 10),
    ).map((g) => ({
      grupo: g.grupo,
      label: g.label,
      fecha: g.fecha ? formatReportDate(g.fecha) : null,
      desactualizado: g.desactualizado,
      labs: kase.labResults
        .filter((l) => normalizeGrupo(l.grupo) === g.grupo)
        .map((l) => ({ analyte: l.analyte, value: l.value, unit: l.unit, refRange: l.refRange, flag: l.flag, rangeUnparsed: l.rangeUnparsed })),
    })),
    // Archivos originales del paciente: el médico debe poder leer el examen, no sólo lo
    // que la IA extrajo de él. La URL apunta a /api/download (exige sesión y propiedad).
    attachments: kase.attachments.map((a) => ({
      id: a.id,
      type: a.type,
      filename: filenameFromKey(a.url),
      url: `/api/download/${encodeURIComponent(a.url)}`,
      viewable: isViewableInline(mimeFor(filenameFromKey(a.url))),
      uploadedAt: a.createdAt.toISOString(),
    })),
    approved: Boolean(kase.approval),
    // Fecha de cirugía (P10) para el botón "Añadir a mi calendario". Null = sin fecha aún.
    procedureDate: kase.procedureDate ? kase.procedureDate.toISOString() : null,
    // Nota privada del médico (o null). Aparece sola en la pantalla del caso; nunca en el PDF.
    patientNote,
    patient: kase.patient ? patientSummary(kase.patient) : null,
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

  // Congela la prosa de paraclínicos con los veredictos EFECTIVOS (manual del médico ?? sistema)
  // al momento de aprobar: el documento firmado no puede contradecir lo que el médico marcó en
  // los labs. Sólo paraclínicos (determinístico); concepto/plan/recomendaciones NO se regeneran.
  fields.paraclinicos = await regenerateParaclinicos(caseId, new Date().toISOString().slice(0, 10));

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
  const opts = { draft: false, fechaValoracion: new Date().toLocaleDateString('es-CO') };
  const html = buildDocumentHtml(fields, branding, opts);
  const pdf = await renderPdf(html, buildFooterTemplate(branding, opts));
  const { key } = await getStorageProvider().put(pdf, { caseId, type: 'FINAL_PDF', filename: 'valoracion-final.pdf' });

  const snapshot = JSON.stringify(fields);
  const hash = createHash('sha256').update(snapshot).digest('hex');

  await prisma.$transaction([
    prisma.approvalRecord.create({
      data: { caseId, approvedById: anesthesiologistId, lockedPdfUrl: key, edits: { hash, snapshot: fields } as never },
    }),
    prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.APROBADO } }),
  ]);

  await logAudit({ action: 'assessment.approved', entity: 'Case', entityId: caseId, meta: { hash, lockedPdfUrl: key } });
  return { ok: true };
}

/** Rechaza: reabre el formulario al paciente. */
export async function reject(caseId: string, anesthesiologistId: string, reason: string): Promise<void> {
  const kase = await prisma.case.findFirst({ where: { id: caseId, anesthesiologistId }, include: { approval: true } });
  if (!kase || kase.approval) return;

  // Se borran los artefactos derivados, no sólo el estado. El pipeline es idempotente por
  // existencia de salida (extractForCase sale si ya hay labs; generateForCase, si ya hay
  // assessment): si no se borran, el reenvío del paciente NO regenera nada y el médico
  // recibe otra vez el documento que acaba de rechazar, sin ningún aviso.
  // Los adjuntos se conservan: el paciente puede añadir exámenes, no re-subir los válidos.
  await prisma.$transaction([
    prisma.generatedAssessment.deleteMany({ where: { caseId } }),
    prisma.extractedLabResult.deleteMany({ where: { caseId } }),
    prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.RESPONDIENDO } }),
    prisma.formResponse.updateMany({ where: { caseId }, data: { partial: true, submittedAt: null } }),
  ]);

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
    prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.PENDIENTE_REVISION } }),
  ]);

  return true;
}
