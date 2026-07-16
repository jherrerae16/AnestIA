import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../prisma';
import { activeModelLabel, getAIProvider, type ClinicalInput } from '../ai';
import { logAudit } from '../audit';
import {
  computeIMC,
  enforceGuardrails,
  documentSchema,
  detectGLP1,
  PROMPT_MAESTRO_VERSION,
  type DocField,
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
/**
 * Arma la sección de paraclínicos desde los labs realmente extraídos (código, no IA).
 * Incluye una observación resumen: alteraciones detectadas o normalidad global.
 * Si el proveedor ya devolvió paraclínicos (stub), se respetan.
 */
function buildParaclinicos(
  labs: ClinicalInput['labs'],
  provided?: Record<string, DocField>,
): Record<string, DocField> {
  if (provided && Object.keys(provided).length > 0) return provided;
  const out: Record<string, DocField> = {};
  for (const l of labs ?? []) {
    out[l.analyte.toLowerCase().replace(/\s+/g, '_')] = {
      valor: `${l.value}${l.unit ? ' ' + l.unit : ''}`,
      estado: 'ok',
      fuente: l.sourceRef ?? 'lab',
      alerta: l.flag !== 'NORMAL',
    };
  }
  if ((labs ?? []).length > 0) {
    const alterados = labs.filter((l) => l.flag !== 'NORMAL');
    out['observacion'] = alterados.length
      ? {
          valor: `Se observa alteración en: ${alterados.map((l) => `${l.analyte} (${l.flag.toLowerCase()})`).join(', ')}. Correlacionar clínicamente.`,
          estado: 'ok',
          fuente: 'derivado:IA',
          alerta: true,
        }
      : {
          valor: 'Sin alteraciones hematológicas ni de coagulación relevantes.',
          estado: 'ok',
          fuente: 'derivado:IA',
        };
  }
  return out;
}

export async function generateForCase(caseId: string): Promise<void> {
  const existing = await prisma.generatedAssessment.findUnique({ where: { caseId } });
  if (existing) return;

  const input = await assembleInput(caseId);
  const raw = await getAIProvider().generateAssessment(input);

  // Paraclínicos: los arma el CÓDIGO desde los labs realmente extraídos, nunca el modelo.
  // Así los valores del documento son los del laboratorio, no los que el modelo recuerde (CS2).
  const withParaclinicos = {
    ...raw,
    paraclinicos: buildParaclinicos(input.labs, raw.paraclinicos),
  };

  // Validación de contrato (rechaza malformado / campos prohibidos) — CS5.
  const parsed = documentSchema.parse(withParaclinicos);

  // Guardarraíles (segunda línea) — CS2/CS3/CS4.
  const doc = enforceGuardrails(parsed, input.imc ?? null);

  // Trazabilidad: la etiqueta la da el propio adaptador (un solo punto de verdad).
  const modelUsed = activeModelLabel();

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
