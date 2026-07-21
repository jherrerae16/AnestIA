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
  groupLabsToProse,
  parseNumeric,
  isAmbiguousProcedure,
  autoCorrectTerm,
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

  // parseNumeric normaliza la coma decimal ("78,5"→78.5) — un paciente que teclea coma no
  // debe hacer que el IMC se caiga en silencio (C-3). Un solo helper compartido para todos
  // los sitios de lectura de peso/talla.
  const peso = answers['5']?.value != null ? parseNumeric(answers['5'].value as string | number) : null;
  const talla = answers['6']?.value != null ? parseNumeric(answers['6'].value as string | number) : null;
  const pesoKg = peso != null && peso > 0 ? peso : null;
  const tallaCm = talla != null && talla > 0 ? talla : null;
  const imc = pesoKg != null && tallaCm != null ? computeIMC(pesoKg, tallaCm) : null;

  return {
    caseId,
    answers,
    pesoKg,
    tallaCm,
    labs: labs.map((l) => ({
      analyte: l.analyte,
      value: l.value,
      unit: l.unit,
      grupo: l.grupo,
      reportDate: l.reportDate ? l.reportDate.toISOString().slice(0, 10) : null,
      flag: l.flag,
      sourceRef: l.sourceRef,
    })),
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
 * Una fila por TIPO DE ESTUDIO (hemograma, coagulación…) con los analitos en prosa, en vez
 * de una fila por analito: así el documento no crece sin control. El tipo lo trae el
 * extractor desde el informe; lo no reconocido cae en "otros" (CS2).
 * Si el proveedor ya devolvió paraclínicos, se respetan.
 */
function buildParaclinicos(
  labs: ClinicalInput['labs'],
  provided: Record<string, DocField> | undefined,
  hoy: string,
): Record<string, DocField> {
  if (provided && Object.keys(provided).length > 0) return provided;
  const out: Record<string, DocField> = {};
  for (const g of groupLabsToProse(labs ?? [], hoy)) {
    out[g.grupo] = {
      valor: g.texto,
      estado: 'ok',
      fuente: g.fuentes.length ? g.fuentes.join(', ') : 'lab',
      alerta: g.alerta,
    };
  }
  return out;
}

/**
 * Flag EFECTIVO de un lab para la prosa del documento (Opción 1 — se congela al aprobar):
 *  - el médico marcó (`manualFlag`) → manda su veredicto.
 *  - no marcó y el sistema pudo leer el rango → manda el veredicto del sistema (`flag`).
 *  - no marcó y el rango era ilegible (`rangeUnparsed`) → se EXCLUYE de la prosa: no es normal
 *    ni alteración confirmada; si el médico no lo revisó, no lo declaramos alterado ni en rango.
 * Devuelve el flag efectivo, o null si el lab debe excluirse de la prosa.
 */
export function effectiveFlagForProse(l: { flag: string; manualFlag: string | null; rangeUnparsed: boolean }): string | null {
  if (l.manualFlag != null) return l.manualFlag;
  if (l.rangeUnparsed) return null; // no revisado + rango ilegible → fuera de la prosa
  return l.flag;
}

/**
 * Regenera SÓLO la sección paraclínicos con los flags EFECTIVOS (manual ?? sistema), para
 * congelarla en el documento al aprobar. Prosa determinística (groupLabsToProse), sin IA. NO
 * toca concepto/plan/recomendaciones (prosa clínica que el médico ya revisó con contexto).
 */
export async function regenerateParaclinicos(caseId: string, hoy: string): Promise<Record<string, DocField>> {
  const labs = await prisma.extractedLabResult.findMany({ where: { caseId } });
  const groupable = labs
    .map((l) => ({ lab: l, eff: effectiveFlagForProse(l) }))
    .filter((x) => x.eff !== null) // excluye los ilegibles sin revisar
    .map(({ lab, eff }) => ({
      analyte: lab.analyte,
      value: lab.value,
      unit: lab.unit,
      grupo: lab.grupo,
      reportDate: lab.reportDate ? lab.reportDate.toISOString().slice(0, 10) : null,
      flag: eff, // flag efectivo, no el crudo del sistema
      sourceRef: lab.sourceRef,
    }));

  const out: Record<string, DocField> = {};
  for (const g of groupLabsToProse(groupable, hoy)) {
    out[g.grupo] = {
      valor: g.texto,
      estado: 'ok',
      fuente: g.fuentes.length ? g.fuentes.join(', ') : 'lab',
      alerta: g.alerta,
    };
  }
  return out;
}

/** Texto plano de una respuesta del formulario (string, o array unido). null si vacía. */
function valorTexto(v: unknown): string | null {
  if (v == null) return null;
  const s = Array.isArray(v) ? v.join(', ') : String(v);
  return s.trim() || null;
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
    paraclinicos: buildParaclinicos(input.labs, raw.paraclinicos, new Date().toISOString().slice(0, 10)),
  };

  // Validación de contrato (rechaza malformado / campos prohibidos) — CS5.
  const parsed = documentSchema.parse(withParaclinicos);

  // Guardarraíles (segunda línea) — CS2/CS3/CS4. peso/talla/IMC se fuerzan a los datos reales
  // del paciente: el modelo no decide esos números (evita el 71/188 fabricado sobre 78/193).
  const doc = enforceGuardrails(parsed, { imc: input.imc ?? null, pesoKg: input.pesoKg, tallaCm: input.tallaCm });

  // Procedimiento ambiguo ("operación de la nariz"): el modelo tiende a elegir una cirugía
  // específica (rinoplastia) por sesgo, pero eso es inventar el procedimiento — en anestesia el
  // manejo depende de cuál sea. Guardarraíl determinístico: si el P9 del paciente es ambiguo, se
  // conserva su texto original en procedimiento y diagnóstico, sin importar lo que puso el modelo.
  const procOriginal = valorTexto(input.answers['9']?.value);
  if (procOriginal && isAmbiguousProcedure(procOriginal)) {
    const fuente = 'formulario:P9';
    doc.identificacion['procedimiento'] = { valor: procOriginal, estado: 'ok', fuente };
    if (doc.identificacion['diagnostico_preoperatorio']) {
      doc.identificacion['diagnostico_preoperatorio'] = { valor: procOriginal, estado: 'ok', fuente };
    }
  }

  // Auto-corrección de terminología ANTES del auditor: aplica la traducción médica cuando es
  // SEGURA y sin pérdida (coloquialismo unívoco, sin calificadores). Así el borrador que ve el
  // médico ya trae el término correcto y el auditor no lo molesta con algo que el sistema puede
  // arreglar solo. Los casos con contexto ("candidato a…") o ambiguos NO se tocan: autoCorrectTerm
  // devuelve null y el auditor los deja como advertencia para el criterio del médico.
  const correcciones: { campo: string; de: string; a: string }[] = [];
  for (const clave of ['procedimiento', 'diagnostico_preoperatorio'] as const) {
    const f = doc.identificacion[clave];
    if (f?.estado !== 'ok' || f.valor == null) continue;
    const original = String(f.valor);
    const corregido = autoCorrectTerm(original);
    if (corregido && corregido !== original) {
      doc.identificacion[clave] = { ...f, valor: corregido, nota: 'terminología normalizada por el sistema' };
      correcciones.push({ campo: clave, de: original, a: corregido });
    }
  }

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

  await logAudit({
    action: 'clinical.generated',
    entity: 'Case',
    entityId: caseId,
    meta: { modelUsed, ...(correcciones.length ? { terminologiaCorregida: correcciones } : {}) },
  });
}
