import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../prisma';
import { getAIProvider, type ClinicalInput } from '../ai';
import { logAudit } from '../audit';
import {
  computeIMC,
  enforceGuardrails,
  documentSchema,
  detectGLP1,
  PROMPT_MAESTRO_VERSION,
  type FormAnswers,
} from '@anestia/shared';

/** Carga el system prompt (prompt-maestro-v2) desde docs/. */
export async function loadPromptMaestro(): Promise<string> {
  try {
    return await readFile(join(process.cwd(), '..', '..', 'docs', 'prompt-maestro-v2.md'), 'utf8');
  } catch {
    return '';
  }
}

/** Ensambla el ClinicalInput desde el caso (respuestas + labs + GLP-1 + IMC por código). */
export async function assembleInput(caseId: string): Promise<ClinicalInput> {
  const fr = await prisma.formResponse.findUnique({ where: { caseId } });
  const labs = await prisma.extractedLabResult.findMany({ where: { caseId } });
  const answers = (fr?.answers as FormAnswers) ?? {};

  // GLP-1 se detecta del detalle de medicamentos (P15 ¿cuáles?).
  const p15 = answers['15']?.value;
  const glp1 = detectGLP1(typeof p15 === 'string' ? p15 : Array.isArray(p15) ? p15.join(' ') : '');

  const peso = Number(answers['5']?.value);
  const talla = Number(answers['6']?.value);
  const imc = isFinite(peso) && isFinite(talla) ? computeIMC(peso, talla) : null;

  return {
    caseId,
    answers,
    labs: labs.map((l) => ({ analyte: l.analyte, value: l.value, unit: l.unit, flag: l.flag, sourceRef: l.sourceRef })),
    glp1,
    imc,
  };
}

/**
 * Genera el borrador estructurado: IMC por código → provider → valida documentSchema →
 * enforceGuardrails (CS2/CS3/CS4) → persiste GeneratedAssessment. Idempotente.
 */
export async function generateForCase(caseId: string): Promise<void> {
  const existing = await prisma.generatedAssessment.findUnique({ where: { caseId } });
  if (existing) return;

  const input = await assembleInput(caseId);
  const raw = await getAIProvider().generateAssessment(input);

  // Validación de contrato (rechaza malformado / campos prohibidos) — CS5.
  const parsed = documentSchema.parse(raw);

  // Guardarraíles (segunda línea) — CS2/CS3/CS4.
  const doc = enforceGuardrails(parsed, input.imc ?? null);

  const modelUsed = process.env.AI_PROVIDER === 'anthropic' ? 'claude-opus' : 'stub';

  await prisma.generatedAssessment.create({
    data: {
      caseId,
      fields: doc as never,
      promptVersion: PROMPT_MAESTRO_VERSION,
      modelUsed,
    },
  });

  await logAudit({ action: 'clinical.generated', entity: 'Case', entityId: caseId, meta: { modelUsed } });
}
