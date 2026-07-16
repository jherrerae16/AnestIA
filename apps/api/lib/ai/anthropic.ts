import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { documentSchema, type DocumentJSON } from '@anestia/shared';
import { logger } from '../logger';
import { getStorageProvider } from '../storage';
import type { AIProvider, ClinicalInput, ExtractedLab, FileRef } from './index';

/**
 * Proveedor Anthropic (Claude) — el único punto donde el sistema depende de la key.
 * Dos funciones: extracción de labs por visión y motor clínico.
 *
 * Reglas de oro que respeta:
 *  - CS2: nunca fabricar. El prompt lo exige; Zod lo comprueba; sin `sourceRef` se descarta.
 *  - CS3: el examen físico no se genera aquí. Los guardarraíles lo re-fuerzan aguas abajo.
 *  - CS5/CS6: salida estructurada + validación Zod en el borde. Lo malformado se rechaza.
 */

const MODEL = 'claude-opus-4-8';

/** Campos permitidos por sección. Un esquema cerrado impide poblar campos prohibidos (CS5). */
const ID_FIELDS = [
  'paciente', 'documento', 'edad_sexo', 'peso_talla_imc', 'procedimiento',
  'fecha_procedimiento', 'fecha_valoracion', 'capacidad_funcional', 'tipo_cirugia',
  'condicion_actual', 'diagnostico_preoperatorio', 'asa',
] as const;

const ANTECEDENTES_FIELDS = [
  'patologicos', 'quirurgicos', 'medicamentos', 'glp1', 'alergias',
  'transfusionales', 'protesis_dental', 'habitos', 'grupo_sanguineo',
] as const;

const PLAN_FIELDS = ['concepto', 'plan', 'recomendaciones'] as const;

/** Un campo del documento en JSON Schema (espejo de docFieldSchema). */
const docFieldJson = {
  type: 'object',
  properties: {
    valor: { type: ['string', 'null'] },
    estado: { type: 'string', enum: ['ok', 'pendiente_examen', 'no_reportado', 'no_disponible'] },
    fuente: { type: ['string', 'null'] },
    alerta: { type: 'boolean' },
    nota: { type: 'string' },
  },
  required: ['valor', 'estado', 'fuente'],
  additionalProperties: false,
} as const;

function sectionJson(fields: readonly string[]) {
  return {
    type: 'object',
    properties: Object.fromEntries(fields.map((f) => [f, docFieldJson])),
    required: [...fields],
    additionalProperties: false,
  };
}

/**
 * Esquema del documento clínico. `examen_fisico` se omite a propósito: lo registra el
 * anestesiólogo (CS3) y el guardarraíl lo re-fuerza a pendiente_examen aguas abajo.
 * `paraclinicos` también se omite: lo arma el código desde los labs extraídos, no la IA.
 */
const clinicalJsonSchema = {
  type: 'object',
  properties: {
    identificacion: sectionJson(ID_FIELDS),
    antecedentes: sectionJson(ANTECEDENTES_FIELDS),
    valoracion_plan: sectionJson(PLAN_FIELDS),
  },
  required: ['identificacion', 'antecedentes', 'valoracion_plan'],
  additionalProperties: false,
} as const;

const extractionJsonSchema = {
  type: 'object',
  properties: {
    labs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          analyte: { type: 'string' },
          value: { type: 'string' },
          unit: { type: ['string', 'null'] },
          refRange: { type: ['string', 'null'] },
          sourceRef: { type: 'string' },
        },
        required: ['analyte', 'value', 'unit', 'refRange', 'sourceRef'],
        additionalProperties: false,
      },
    },
  },
  required: ['labs'],
  additionalProperties: false,
} as const;

/** Borde Zod de la extracción: sin sourceRef no hay trazabilidad → se rechaza (CS2). */
const extractionSchema = z.object({
  labs: z.array(
    z.object({
      analyte: z.string().min(1),
      value: z.string().min(1),
      unit: z.string().nullish(),
      refRange: z.string().nullish(),
      sourceRef: z.string().min(1),
    }),
  ),
});

/** Borde Zod del motor clínico (secciones que genera la IA). */
const clinicalOutputSchema = documentSchema.partial({
  paraclinicos: true,
  examen_fisico: true,
} as never);

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

function mimeFor(filename: string): string | null {
  const i = filename.lastIndexOf('.');
  if (i < 0) return null;
  return MIME_BY_EXT[filename.slice(i).toLowerCase()] ?? null;
}

/** Carga el prompt maestro (system prompt del motor clínico, docs/prompt-maestro-v2.md). */
async function loadPromptMaestro(): Promise<string> {
  const path = join(process.cwd(), '..', '..', 'docs', 'prompt-maestro-v2.md');
  return readFile(path, 'utf8');
}

const EXTRACTION_SYSTEM = `Eres el extractor de paraclínicos de una plataforma de valoración preanestésica.

REGLA DE ORO — NUNCA FABRICAR:
- Extrae ÚNICAMENTE valores que leas literalmente en el documento.
- Si un valor no está presente o no es legible, NO lo incluyas. La ausencia se declara omitiendo, nunca rellenando.
- Nunca infieras, estimes ni completes valores "esperables".
- Cada valor lleva sourceRef indicando dónde se leyó (p. ej. "hemograma:hemoglobina", "coagulacion:INR").

Extrae los analitos de laboratorio con su valor, unidad y rango de referencia si aparecen.
Si el documento no es un laboratorio (p. ej. un ECG o un ecocardiograma), devuelve una lista vacía.`;

export class AnthropicAIProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    // El SDK lee ANTHROPIC_API_KEY del entorno. La key nunca se registra ni se imprime.
    this.client = new Anthropic();
  }

  /**
   * Extracción de laboratorios por visión, sobre el archivo real del paciente.
   * Un documento ilegible produce lista vacía — nunca valores inventados.
   */
  async extractLabs(files: FileRef[]): Promise<ExtractedLab[]> {
    if (!files || files.length === 0) return [];

    const storage = getStorageProvider();
    const content: Anthropic.ContentBlockParam[] = [];

    for (const f of files) {
      const mime = mimeFor(f.filename);
      if (!mime) {
        logger.warn({ filename: f.filename }, 'anthropic_extract_skip_unsupported_type');
        continue;
      }
      const data = (await storage.get(f.key)).toString('base64');
      if (mime === 'application/pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data },
        });
      } else {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: mime as 'image/png', data },
        });
      }
    }
    if (content.length === 0) return [];
    content.push({ type: 'text', text: 'Extrae los laboratorios de estos documentos.' });

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: EXTRACTION_SYSTEM,
      output_config: { format: { type: 'json_schema', schema: extractionJsonSchema as never } },
      messages: [{ role: 'user', content }],
    });

    if (response.stop_reason === 'refusal') {
      logger.error({ stopDetails: response.stop_details }, 'anthropic_extract_refused');
      throw new Error('El extractor de laboratorios rechazó el documento.');
    }

    const parsed = extractionSchema.parse(JSON.parse(firstText(response)));
    logger.info({ files: files.length, labs: parsed.labs.length, model: MODEL }, 'anthropic_extract_done');
    return parsed.labs;
  }

  /**
   * Motor clínico: genera el documento desde datos verificados.
   * No genera examen físico ni paraclínicos — los pone el anestesiólogo y el código.
   */
  async generateAssessment(input: ClinicalInput): Promise<DocumentJSON> {
    const system = await loadPromptMaestro();

    const payload = {
      respuestas_del_paciente: input.answers,
      paraclinicos_extraidos: input.labs,
      glp1_detectado: input.glp1 ?? { declared: false },
      imc_calculado_por_el_sistema: input.imc,
      instrucciones:
        'Genera la valoración preanestésica. No generes el examen físico, los signos vitales ' +
        'ni los paraclínicos: los aporta el anestesiólogo y el sistema. Cada campo lleva ' +
        '{ valor, estado, fuente }. Si un dato no tiene sustento, usa estado "no_reportado" ' +
        'con valor null — nunca lo inventes. Cita la fuente de cada dato (formulario:Pn, lab:..., derivado:IA).',
    };

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: clinicalJsonSchema as never },
      },
      system,
      messages: [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
    });

    if (response.stop_reason === 'refusal') {
      logger.error({ stopDetails: response.stop_details }, 'anthropic_clinical_refused');
      throw new Error('El motor clínico rechazó la solicitud.');
    }

    // CS5/CS6: validación de contrato. Los guardarraíles (CS2/CS3/CS4) corren después.
    const generated = clinicalOutputSchema.parse(JSON.parse(firstText(response)));
    logger.info(
      { caseId: input.caseId, model: MODEL, outputTokens: response.usage.output_tokens },
      'anthropic_clinical_done',
    );

    // Secciones que NO vienen de la IA: el examen lo registra el médico; los paraclínicos,
    // el código desde los labs realmente extraídos.
    return {
      ...generated,
      paraclinicos: {},
      examen_fisico: {},
    } as DocumentJSON;
  }
}

/** Primer bloque de texto de la respuesta, o error si no hay contenido. */
function firstText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Respuesta del modelo sin contenido de texto.');
  return block.text;
}
