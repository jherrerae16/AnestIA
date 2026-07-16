import { z } from 'zod';
import { prisma } from '../prisma';
import { getAIProvider, type FileRef } from '../ai';
import { logAudit } from '../audit';
import { logger } from '../logger';
import { flagLab, detectGLP1, type FormAnswers } from '@anestia/shared';

/**
 * Borde de validación de la extracción (CS2/CS6). Un lab sin `sourceRef` no es
 * trazable y por tanto no se persiste: la ausencia de sustento se descarta, no se rellena.
 */
const extractedLabSchema = z.object({
  analyte: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().nullish(),
  refRange: z.string().nullish(),
  sourceRef: z.string().min(1),
});

/**
 * lab.extract: extrae valores de los adjuntos del caso (AIProvider) y persiste
 * ExtractedLabResult con sourceRef. Idempotente. NUNCA fabrica valores ausentes (CS2).
 * También detecta GLP-1 declarado (P14) y lo registra en audit.
 */
export async function extractForCase(caseId: string): Promise<void> {
  const existing = await prisma.extractedLabResult.count({ where: { caseId } });
  if (existing > 0) return; // idempotencia

  const attachments = await prisma.attachment.findMany({ where: { caseId } });
  const files: FileRef[] = attachments.map((a) => ({ key: a.url, type: a.type, filename: a.url }));

  const raw = await getAIProvider().extractLabs(files);

  // CS2/CS6: sólo se persiste lo trazable. Un lab sin sourceRef se descarta y se registra.
  for (const candidate of raw) {
    const parsed = extractedLabSchema.safeParse(candidate);
    if (!parsed.success) {
      logger.warn(
        { caseId, analyte: (candidate as { analyte?: string })?.analyte },
        'lab_extract_discarded_untraceable',
      );
      continue;
    }
    const lab = parsed.data;
    await prisma.extractedLabResult.create({
      data: {
        caseId,
        analyte: lab.analyte,
        value: lab.value,
        unit: lab.unit ?? null,
        refRange: lab.refRange ?? null,
        sourceRef: lab.sourceRef,
        flag: 'NORMAL',
      },
    });
  }

  // Detección GLP-1 desde la respuesta P14.
  const fr = await prisma.formResponse.findUnique({ where: { caseId } });
  const answers = (fr?.answers as FormAnswers) ?? {};
  const p14 = answers['14']?.value;
  const glp1 = detectGLP1(typeof p14 === 'string' ? p14 : Array.isArray(p14) ? p14.join(' ') : '');
  if (glp1.declared) {
    await logAudit({ action: 'glp1.detected', entity: 'Case', entityId: caseId, meta: { drug: glp1.drug } });
  }
}

/**
 * lab.flag: aplica reglas determinísticas por sexo del paciente. Actualiza flags.
 */
export async function flagForCase(caseId: string): Promise<void> {
  const kase = await prisma.case.findUnique({ where: { id: caseId }, include: { patient: true } });
  const sex = kase?.patient?.sex ?? null;

  const results = await prisma.extractedLabResult.findMany({ where: { caseId } });
  for (const r of results) {
    const flag = flagLab(r.analyte, r.value, sex as never);
    if (flag !== r.flag) {
      await prisma.extractedLabResult.update({ where: { id: r.id }, data: { flag } });
    }
  }
}
