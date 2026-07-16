import { prisma } from '../prisma';
import { logAudit } from '../audit';
import { logger } from '../logger';
import { auditDocument, type AuditReport, type AuditAnswers, type DocumentJSON, type FormAnswers } from '@anestia/shared';

/**
 * Auditor independiente (patrón generador + crítico). Corre DESPUÉS del motor clínico
 * y ANTES del render. No corrige contenido clínico: sólo deja su reporte pegado al caso
 * para que el anestesiólogo lo vea en la pantalla de revisión (CS1).
 *
 * Capa determinística (reglas). La parte de juicio en lenguaje natural se añade cuando
 * exista el proveedor de IA — este servicio es el punto de extensión.
 */
export async function auditForCase(caseId: string): Promise<AuditReport | null> {
  const assessment = await prisma.generatedAssessment.findUnique({ where: { caseId } });
  if (!assessment) return null;

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { formResponse: true, labResults: true },
  });
  if (!kase) return null;

  const answers = (kase.formResponse?.answers as FormAnswers | undefined) ?? {};
  const report = auditDocument({
    doc: assessment.fields as DocumentJSON,
    answers: answers as AuditAnswers,
    labs: kase.labResults.map((l) => ({ analyte: l.analyte, flag: l.flag })),
  });

  await prisma.generatedAssessment.update({
    where: { id: assessment.id },
    data: { auditReport: report as never, auditedAt: new Date() },
  });

  await logAudit({
    action: 'assessment.audited',
    entity: 'Case',
    entityId: caseId,
    meta: {
      rulesVersion: report.rulesVersion,
      blocked: report.blocked,
      total: report.findings.length,
      bloqueantes: report.findings.filter((f) => f.level === 'bloqueante').length,
      advertencias: report.findings.filter((f) => f.level === 'advertencia').length,
    },
  });

  logger.info(
    { caseId, blocked: report.blocked, findings: report.findings.length },
    'clinical_audit_done',
  );
  return report;
}
