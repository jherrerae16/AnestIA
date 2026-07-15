import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../prisma';
import { renderPdf } from '../pdf/renderer';
import { getStorageProvider } from '../storage';
import { logAudit } from '../audit';
import { buildDocumentHtml, type Branding, type DocumentJSON } from '@anestia/shared';

/**
 * Convierte un asset de branding (ruta bajo /public) en data URI para que Playwright
 * lo incruste sin depender de la red. Devuelve null si no se puede leer.
 */
async function toDataUri(publicPath: string | null | undefined): Promise<string | null> {
  if (!publicPath) return null;
  try {
    const rel = publicPath.replace(/^\//, '');
    const full = join(process.cwd(), 'public', rel);
    const bytes = await readFile(full);
    const mime = full.endsWith('.svg') ? 'image/svg+xml' : full.endsWith('.png') ? 'image/png' : 'application/octet-stream';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

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
    logoUrl: await toDataUri(a?.clinicLogoUrl),
    signatureUrl: await toDataUri(a?.signatureUrl),
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
