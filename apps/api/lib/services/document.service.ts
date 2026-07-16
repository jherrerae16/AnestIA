import { prisma } from '../prisma';
import { renderPdf } from '../pdf/renderer';
import { getStorageProvider } from '../storage';
import { logAudit } from '../audit';
import { brandingDataUri } from '../pdf/branding';
import { buildDocumentHtml, toTitleCase, type Branding, type DocumentJSON } from '@anestia/shared';

/**
 * Renderiza el PDF de BORRADOR del caso desde el GeneratedAssessment.
 * Fiel al Diseño Oficial, branding del perfil, marca BORRADOR mientras el examen esté pendiente.
 * Guarda el PDF vía StorageProvider. El borrador es regenerable (no inmutable).
 */
export async function renderDraftForCase(caseId: string, fechaValoracion: string): Promise<void> {
  const assessment = await prisma.generatedAssessment.findUnique({ where: { caseId } });
  if (!assessment) throw new Error('No hay borrador generado para el caso.');

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { anesthesiologist: true },
  });
  const a = kase?.anesthesiologist;

  const branding: Branding = {
    logoUrl: await brandingDataUri(a?.clinicLogoUrl),
    signatureUrl: await brandingDataUri(a?.signatureUrl),
    doctorName: a?.fullName ?? 'Anestesiólogo',
    specialty: a?.specialty ?? null,
    registry: a?.medicalRegistry ?? null,
    footer: a?.footerText ?? 'AnestIA',
  };

  const html = buildDocumentHtml(assessment.fields as DocumentJSON, branding, {
    draft: true,
    fechaValoracion,
  });
  const pdf = await renderPdf(html);

  const storage = getStorageProvider();
  await storage.put(pdf, { caseId, type: 'DRAFT_PDF', filename: 'borrador.pdf' });

  await logAudit({ action: 'document.rendered', entity: 'Case', entityId: caseId, meta: { draft: true } });
}

/**
 * Renderiza al vuelo el PDF del documento ACTUAL (con los campos vigentes) para
 * previsualización en la revisión. Verifica propiedad del caso. No persiste ni audita
 * (es sólo lectura). Marca BORRADOR si el examen sigue pendiente o el caso no está aprobado.
 * Devuelve null si el caso no existe o no pertenece al anestesiólogo.
 */
export async function previewPdfForCase(
  caseId: string,
  anesthesiologistId: string,
): Promise<{ pdf: Buffer; filename: string } | null> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { anesthesiologist: true, patient: { select: { fullName: true } } },
  });
  if (!kase || kase.anesthesiologistId !== anesthesiologistId) return null;

  const assessment = await prisma.generatedAssessment.findUnique({ where: { caseId } });
  if (!assessment) return null;

  const a = kase.anesthesiologist;
  const branding: Branding = {
    logoUrl: await brandingDataUri(a?.clinicLogoUrl),
    signatureUrl: await brandingDataUri(a?.signatureUrl),
    doctorName: a?.fullName ?? 'Anestesiólogo',
    specialty: a?.specialty ?? null,
    registry: a?.medicalRegistry ?? null,
    footer: a?.footerText ?? 'AnestIA',
  };

  // Borrador salvo que el caso ya esté aprobado/entregado (documento final).
  const isFinal = kase.status === 'APROBADO' || kase.status === 'ENTREGADO';
  const html = buildDocumentHtml(assessment.fields as DocumentJSON, branding, {
    draft: !isFinal,
    fechaValoracion: new Date().toLocaleDateString('es-CO'),
  });
  const pdf = await renderPdf(html);
  return { pdf, filename: documentFilename(kase.patient?.fullName) };
}

/** Nombre del archivo PDF: "VALORACIÓN PREANESTÉSICA - {paciente}.pdf". */
export function documentFilename(patientName?: string | null): string {
  const name = (patientName ?? '').trim();
  const base = name ? `VALORACIÓN PREANESTÉSICA - ${toTitleCase(name)}` : 'VALORACIÓN PREANESTÉSICA';
  return `${base}.pdf`;
}
