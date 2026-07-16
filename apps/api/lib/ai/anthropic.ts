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

/**
 * Mapa de preguntas del formulario. El modelo NO puede adivinar la numeración: sin esto
 * cita fuentes equivocadas (`formulario:P18` para alergias, que en realidad es P16) y la
 * trazabilidad —que es el punto de CS2— queda inservible.
 */
const PREGUNTAS = `P1 nombre · P2 documento · P3 fecha de nacimiento · P4 sexo · P5 peso (kg) ·
P6 estatura (cm) · P7 teléfono · P8 aseguradora · P9 cirugía o procedimiento · P10 fecha de cirugía ·
P11 grupo sanguíneo · P12 ¿sufre alguna enfermedad? · P13 patologías (checklist) ·
P14 ¿toma medicamentos? · P15 ¿cuáles medicamentos? · P16 ¿es alérgico? · P17 ¿a qué es alérgico? ·
P18 ¿cirugía o anestesia previa? · P19 ¿cuáles cirugías? · P20 ¿transfusión previa? ·
P21 ¿prótesis dental o diseño de sonrisa? · P22 ¿fuma o vapea? · P23 cigarrillos por día ·
P24 ¿consume alcohol? · P25 ¿sustancias psicoactivas? · P26 correo`;

/**
 * Contrato de salida del motor clínico, descrito en el prompt.
 *
 * No se usa `output_config.format` aquí: el documento tiene 24 campos anidados y la
 * gramática de structured outputs no admite un esquema de ese tamaño (la API lo rechaza).
 * El borde real es Zod — `clinicalOutputSchema` es `.strict()`, así que un campo fuera del
 * contrato hace fallar el parse y el documento se rechaza (CS5).
 */
function contractSpec(): string {
  const sec = (name: string, fields: readonly string[]) =>
    `  "${name}": { ${fields.map((f) => `"${f}": Campo`).join(', ')} }`;
  return [
    'Devuelve ÚNICAMENTE un objeto JSON con esta forma exacta, sin texto alrededor y sin ```:',
    '',
    'Campo = { "valor": string, "estado": "ok"|"no_reportado", "fuente": string }',
    '  - Con sustento     → estado "ok", valor con el dato, fuente citada (formulario:Pn | lab:... | derivado:IA).',
    '  - Sin sustento     → estado "no_reportado", valor "", fuente "".',
    '',
    '{',
    sec('identificacion', ID_FIELDS) + ',',
    sec('antecedentes', ANTECEDENTES_FIELDS) + ',',
    sec('valoracion_plan', PLAN_FIELDS),
    '}',
    '',
    'No añadas ninguna clave que no esté en esta lista: se rechazará el documento completo.',
  ].join('\n');
}

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
          // Cadena vacía cuando el documento no reporta unidad/rango (evita uniones nullable).
          unit: { type: 'string' },
          refRange: { type: 'string' },
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

/**
 * Borde Zod del motor clínico — ESTE es el control real (CS5/CS6).
 * Claves explícitas + `.strict()`: si el modelo inventa un campo fuera del contrato,
 * el parse falla y el documento se rechaza entero, en vez de colarse.
 */
const aiFieldSchema = z
  .object({
    valor: z.string(),
    estado: z.enum(['ok', 'pendiente_examen', 'no_reportado', 'no_disponible']),
    fuente: z.string(),
  })
  .strict();

const sectionSchema = (fields: readonly string[]) =>
  z.object(Object.fromEntries(fields.map((f) => [f, aiFieldSchema])) as Record<string, typeof aiFieldSchema>).strict();

const clinicalOutputSchema = z
  .object({
    identificacion: sectionSchema(ID_FIELDS),
    antecedentes: sectionSchema(ANTECEDENTES_FIELDS),
    valoracion_plan: sectionSchema(PLAN_FIELDS),
  })
  .strict();

/** Normaliza al contrato interno: '' → null cuando el campo no tiene sustento (CS2). */
function toDocFields(section: Record<string, { valor: string; estado: string; fuente: string }>) {
  const out: Record<string, { valor: string | null; estado: string; fuente: string | null }> = {};
  for (const [k, f] of Object.entries(section)) {
    const ok = f.estado === 'ok' && f.valor.trim() !== '';
    out[k] = {
      valor: ok ? f.valor : null,
      estado: ok ? 'ok' : f.estado === 'ok' ? 'no_reportado' : f.estado,
      fuente: ok && f.fuente.trim() !== '' ? f.fuente : null,
    };
  }
  return out;
}

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

    const parsed = extractionSchema.parse(parseJson(firstText(response)));
    logger.info({ files: files.length, labs: parsed.labs.length, model: MODEL }, 'anthropic_extract_done');
    return parsed.labs;
  }

  /**
   * Motor clínico: genera el documento desde datos verificados.
   * No genera examen físico ni paraclínicos — los pone el anestesiólogo y el código.
   */
  async generateAssessment(input: ClinicalInput): Promise<DocumentJSON> {
    const system = await loadPromptMaestro();

    const datos = {
      respuestas_del_paciente: input.answers,
      paraclinicos_extraidos: input.labs,
      glp1_detectado: input.glp1 ?? { declared: false },
      imc_calculado_por_el_sistema: input.imc,
    };

    const prompt = [
      'Genera la valoración preanestésica a partir de estos datos verificados.',
      '',
      'No generes el examen físico, los signos vitales ni los paraclínicos: los aporta el',
      'anestesiólogo y el sistema.',
      '',
      'PREGUNTAS DEL FORMULARIO (cita la fuente con este número exacto):',
      PREGUNTAS,
      '',
      'FORMATO DE ALGUNOS CAMPOS:',
      '- edad_sexo: "N años / Masculino" (o Femenino).',
      '- peso_talla_imc: "95 kg / 1.70 m / 32.9 kg/m²" (talla en metros).',
      '- fecha_procedimiento: dd-mm-aaaa.',
      '- fecha_valoracion: déjalo en no_reportado; lo pone el sistema al renderizar.',
      '- capacidad_funcional: derívala si los datos la sustentan; si no, no_reportado.',
      '- condicion_actual: "Asintomático" sólo si el paciente niega enfermedad y síntomas;',
      '  si refiere patologías, descríbela brevemente; si no hay sustento, no_reportado.',
      '',
      contractSpec(),
      '',
      'DATOS:',
      JSON.stringify(datos, null, 2),
    ].join('\n');

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal') {
      logger.error({ stopDetails: response.stop_details }, 'anthropic_clinical_refused');
      throw new Error('El motor clínico rechazó la solicitud.');
    }

    // CS5/CS6: el contrato se valida aquí. Un campo fuera del esquema hace fallar el parse
    // (.strict()) y el documento se rechaza. Los guardarraíles (CS2/CS3/CS4) corren después.
    const generated = clinicalOutputSchema.parse(parseJson(firstText(response)));
    logger.info(
      { caseId: input.caseId, model: MODEL, outputTokens: response.usage.output_tokens },
      'anthropic_clinical_done',
    );

    // Secciones que NO vienen de la IA: el examen lo registra el médico; los paraclínicos,
    // el código desde los labs realmente extraídos.
    return {
      identificacion: toDocFields(generated.identificacion),
      antecedentes: toDocFields(generated.antecedentes),
      valoracion_plan: toDocFields(generated.valoracion_plan),
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

/** Parsea el JSON de la respuesta, tolerando que venga envuelto en un fence ```json. */
function parseJson(text: string): unknown {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? t;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('La respuesta del modelo no contiene un objeto JSON.');
  return JSON.parse(body.slice(start, end + 1));
}
