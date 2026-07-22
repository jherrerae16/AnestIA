import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { documentSchema, LAB_GRUPOS, type DocumentJSON } from '@anestia/shared';
import { logger } from '../logger';
import { mimeFor } from '../mime';
import { readPdfText } from './pdf-text';
import { getStorageProvider } from '../storage';
import type {
  AIProvider,
  ClinicalInput,
  ExtractedLab,
  ExtractionMethod,
  ExtractLabsResult,
  FileRef,
} from './index';

/**
 * Proveedor Anthropic (Claude) — el único punto donde el sistema depende de la key.
 * Dos funciones: extracción de labs por visión y motor clínico.
 *
 * Reglas de oro que respeta:
 *  - CS2: nunca fabricar. El prompt lo exige; Zod lo comprueba; sin `sourceRef` se descarta.
 *  - CS3: el examen físico no se genera aquí. Los guardarraíles lo re-fuerzan aguas abajo.
 *  - CS5/CS6: salida estructurada + validación Zod en el borde. Lo malformado se rechaza.
 */

/**
 * Motor clínico: Opus. Es juicio médico (ASA, riesgo, plan) y lo firma el anestesiólogo.
 * Extracción de labs: Sonnet. Leer "15.9 g/dL" de una tabla es visión, no razonamiento —
 * y es la llamada cara (los PDFs pesan miles de tokens de imagen) y la que más se repite.
 */
const CLINICAL_MODEL_ID = 'claude-opus-4-8';
// Extracción por texto (Capa 3): Haiku basta para leer una tabla ya en texto plano, y es la
// palanca de ahorro real. La visión (Capa 4, fallback) usa un modelo con mejor lectura de
// imagen para los escaneados; Sonnet lee tablas de imagen de sobra.
const TEXT_EXTRACTION_MODEL_ID = 'claude-haiku-4-5';
const VISION_EXTRACTION_MODEL_ID = 'claude-sonnet-5';

/**
 * Techo de salida de la extracción. Un perfil completo real (hemograma + bioquímica +
 * uroanálisis + hormonal ≈ 70 analitos) ronda los 12k tokens de JSON; 8000 lo cortaba a
 * media respuesta. Con streaming el margen no cuesta latencia si no se usa.
 */
const EXTRACTION_MAX_TOKENS = 32000;

/** Techo de salida del motor clínico (el documento + el pensamiento adaptativo). */
const CLINICAL_MAX_TOKENS = 32000;

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
          grupo: { type: 'string', enum: [...LAB_GRUPOS] },
          // Cadena vacía si el informe no la reporta (evita uniones nullable).
          reportDate: { type: 'string' },
          sourceRef: { type: 'string' },
        },
        required: ['analyte', 'value', 'unit', 'refRange', 'grupo', 'reportDate', 'sourceRef'],
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
      grupo: z.string().nullish(),
      reportDate: z.string().nullish(),
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

/**
 * Quita la fila `glp1` de antecedentes cuando el paciente NO declaró uso de GLP-1. El schema
 * fijo del motor siempre incluye la clave; sin esto quedaría una fila vacía/no_reportado que no
 * debería aparecer (simetría con el stub, que omite la clave). Pura para poder probarla.
 */
export function stripUndeclaredGlp1<T extends Record<string, unknown>>(antecedentes: T, declared: boolean): T {
  if (declared) return antecedentes;
  const { glp1: _omit, ...rest } = antecedentes as Record<string, unknown>;
  return rest as T;
}

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
Si el documento no es un laboratorio (p. ej. un ECG o un ecocardiograma), devuelve una lista vacía.

TIPO DE ESTUDIO (campo "grupo"):
- Asigna cada analito al estudio bajo el cual aparece en el informe, usando los encabezados
  de sección del propio documento ("HEMOGRAMA", "PRUEBAS DE COAGULACIÓN", "PARCIAL DE ORINA"…).
- Valores permitidos: ${LAB_GRUPOS.join(' | ')}.
- Si el informe no indica bajo qué estudio está el analito, usa "otros". No lo deduzcas por
  el nombre del analito: el encabezado del informe manda.

FECHA DEL INFORME (campo "reportDate"):
- Fecha en que se TOMÓ o PROCESÓ la muestra, tal como aparece impresa en el informe
  ("Fecha de toma", "Fecha de proceso", "Fecha de impresión" — en ese orden de preferencia).
- Formato AAAA-MM-DD. Ojo con el formato colombiano DD/MM/AAAA: "07/11/2025" es 2025-11-07.
- Si el informe no la trae o no es legible, devuelve cadena vacía. NUNCA la inventes ni uses
  la fecha de hoy: un examen sin fecha es un dato ausente, no un examen reciente.`;

export class AnthropicAIProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    // El SDK lee ANTHROPIC_API_KEY del entorno. La key nunca se registra ni se imprime.
    this.client = new Anthropic();
  }

  /**
   * Extracción de laboratorios en CASCADA sobre los archivos reales del paciente.
   *
   *  - method 'capas' (por defecto): por cada archivo, intenta leer el texto embebido (Capa 1,
   *    cero tokens) y extraer con Haiku sobre texto (Capa 3). Si el texto no sirve — escaneado,
   *    foto, formato ilegible — ese archivo escala automáticamente a visión (Capa 4). El
   *    fallback es por archivo y queda registrado en `perFile` para el audit log.
   *  - method 'vision': fuerza visión sobre todos los archivos (método conocido, base del modo
   *    comparativo).
   *
   * Un documento ilegible produce lista vacía — nunca valores inventados (CS2).
   */
  async extractLabs(files: FileRef[], method: ExtractionMethod = 'capas'): Promise<ExtractLabsResult> {
    if (!files || files.length === 0) return { labs: [], perFile: [] };

    if (method === 'vision') {
      const raw = await this.extractByVision(files);
      const labs = raw.map((l) => ({ ...l, extractionLayer: 'vision' as const }));
      return { labs, perFile: files.map((f) => ({ file: f.filename, layer: 'vision' })) };
    }

    // Modo capas: decidir capa archivo por archivo.
    const storage = getStorageProvider();
    const textFiles: FileRef[] = [];
    const visionFiles: FileRef[] = [];
    const perFile: ExtractLabsResult['perFile'] = [];

    for (const f of files) {
      const bytes = await storage.get(f.key);
      // El texto embebido sólo aplica a PDF; una imagen va directa a visión.
      const isPdf = mimeFor(f.filename) === 'application/pdf';
      const text = isPdf ? await readPdfText(bytes, f.filename) : { usable: false, text: '', reason: 'sin_texto' as const };
      if (text.usable) {
        textFiles.push(f);
        perFile.push({ file: f.filename, layer: 'texto' });
      } else {
        visionFiles.push(f);
        perFile.push({ file: f.filename, layer: 'vision', fallbackReason: text.reason });
      }
    }

    const labs: ExtractedLab[] = [];
    // Capa 3: los archivos con texto usable, extraídos por Haiku (uno por archivo para no
    // mezclar sourceRef entre informes distintos). Cada lab lleva su método de origen.
    for (const f of textFiles) {
      const t = await readPdfText(await storage.get(f.key), f.filename);
      const fromText = await this.extractFromText(t.text, f.filename);
      labs.push(...fromText.map((l) => ({ ...l, extractionLayer: 'texto' as const })));
    }
    // Capa 4: fallback a visión para lo que el texto no resolvió.
    if (visionFiles.length > 0) {
      const byVision = await this.extractByVision(visionFiles);
      labs.push(...byVision.map((l) => ({ ...l, extractionLayer: 'vision' as const })));
    }
    return { labs, perFile };
  }

  /** Capa 3 — extracción a JSON con Haiku sobre el TEXTO ya extraído (cero imagen). */
  private async extractFromText(text: string, label: string): Promise<ExtractedLab[]> {
    // Sin thinking: Haiku 4.5 no soporta adaptive thinking, y transcribir una tabla ya en
    // texto plano a JSON no lo necesita — es lectura estructurada, no razonamiento.
    const stream = this.client.messages.stream({
      model: TEXT_EXTRACTION_MODEL_ID,
      max_tokens: EXTRACTION_MAX_TOKENS,
      system: EXTRACTION_SYSTEM,
      output_config: { format: { type: 'json_schema', schema: extractionJsonSchema as never } },
      messages: [{ role: 'user', content: `Extrae los laboratorios de este informe:\n\n${text}` }],
    });
    const response = await stream.finalMessage();
    this.guardResponse(response, `texto:${label}`);
    const parsed = extractionSchema.parse(parseJson(firstText(response)));
    logger.info(
      { label, layer: 'texto', model: TEXT_EXTRACTION_MODEL_ID, labs: parsed.labs.length,
        inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      'anthropic_extract_done',
    );
    return parsed.labs;
  }

  /** Capa 4 — extracción por visión sobre los archivos (PDF como documento, imagen como imagen). */
  private async extractByVision(files: FileRef[]): Promise<ExtractedLab[]> {
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
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
      } else {
        content.push({ type: 'image', source: { type: 'base64', media_type: mime as 'image/png', data } });
      }
    }
    if (content.length === 0) return [];
    content.push({ type: 'text', text: 'Extrae los laboratorios de estos documentos.' });

    // Streaming + max_tokens alto: por encima de ~16k una petición no-streaming se cae por
    // timeout HTTP del SDK, y con poco margen el JSON se corta a medias (CS2).
    const stream = this.client.messages.stream({
      model: VISION_EXTRACTION_MODEL_ID,
      max_tokens: EXTRACTION_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: EXTRACTION_SYSTEM,
      output_config: { format: { type: 'json_schema', schema: extractionJsonSchema as never } },
      messages: [{ role: 'user', content }],
    });
    const response = await stream.finalMessage();
    this.guardResponse(response, 'vision');
    const parsed = extractionSchema.parse(parseJson(firstText(response)));
    logger.info(
      { files: files.length, layer: 'vision', model: VISION_EXTRACTION_MODEL_ID, labs: parsed.labs.length,
        inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      'anthropic_extract_done',
    );
    return parsed.labs;
  }

  /** Rechazo o truncamiento: se falla explícito. Un JSON a medias no se parsea (CS2). */
  private guardResponse(response: Anthropic.Message, ctx: string): void {
    if (response.stop_reason === 'refusal') {
      logger.error({ ctx, stopDetails: response.stop_details }, 'anthropic_extract_refused');
      throw new Error('El extractor de laboratorios rechazó el documento.');
    }
    if (response.stop_reason === 'max_tokens') {
      logger.error({ ctx, maxTokens: EXTRACTION_MAX_TOKENS, outputTokens: response.usage.output_tokens }, 'anthropic_extract_truncated');
      throw new Error(`La extracción excedió el límite de ${EXTRACTION_MAX_TOKENS} tokens de salida.`);
    }
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
      '- peso_talla_imc: déjalo en no_reportado; lo pone el sistema con el peso y la talla',
      '  reales del paciente. NO transcribas ni estimes peso/talla/IMC tú.',
      '- fecha_procedimiento: dd-mm-aaaa.',
      '- fecha_valoracion: déjalo en no_reportado; lo pone el sistema al renderizar.',
      '- capacidad_funcional: el formulario NO la pregunta. Déjala en no_reportado salvo que',
      '  una respuesta la sustente explícitamente; la evalúa el anestesiólogo.',
      '- tipo_cirugia: sólo si se deduce del procedimiento declarado; si no, no_reportado.',
      '- asa: formato CONCISO — el grado + los hallazgos clave en frases cortas, p. ej.',
      '  "ASA II: Anemia leve (Hb 10.3 g/dL). Tratamiento con isotretinoína." SIN muletillas',
      '  ("paciente joven sin comorbilidades declaradas, con … como factores clínicos relevantes").',
      '- condicion_actual: si refiere patologías, descríbelas brevemente. NO escribas',
      '  "Asintomático" porque niegue enfermedad: no tener diagnóstico no es estar sin',
      '  síntomas, y nadie lo ha examinado. Sin sustento → no_reportado. NO repitas las cifras',
      '  que ya van en el ASA (p. ej. no vuelvas a escribir "Hb 10.3 g/dL" si ya está en asa):',
      '  resume el cuadro ("Anemia leve sugestiva de ferropenia."), no lo dupliques.',
      '- concepto: sintetiza el cuadro clínico y el riesgo perioperatorio (de comorbilidades y',
      '  hallazgos reales) y la necesidad de optimización si aplica; cierra ahí. NO declares al',
      '  paciente apto/no apto, NO cites capacidad funcional en METs y NO menciones el acto de',
      '  evaluar ni sus tiempos: prohibido "se definirá/establecerá tras el examen", "pendiente de',
      '  evaluación presencial" y similares. La conclusión de aptitud la emite el anestesiólogo.',
      '- plan, concepto y recomendaciones: cierra cada campo con la CONCLUSIÓN clínica concreta, NO',
      '  con disclaimers de proceso. Este documento lo firma un anestesiólogo que YA evaluó; el',
      '  receptor recibe el resultado final, no un borrador. PROHIBIDO cerrar con frases genéricas',
      '  de cobertura: "sujeto a valoración presencial", "confirmar hallazgos en la evaluación',
      '  presencial", "según protocolo institucional", "deben precisarse"/"queda por confirmar" sin',
      '  acción concreta, "monitorización estándar" (di cuál), "continuar estudios" (di cuál y para',
      '  qué). Excepción: SÍ va una acción atada a un hallazgo específico declarado (p. ej. "precisar',
      '  los parámetros del CPAP" si declaró CPAP), porque es accionable, no defensiva.',
      '',
      contractSpec(),
      '',
      'DATOS:',
      JSON.stringify(datos, null, 2),
    ].join('\n');

    // Streaming: con effort alto el pensamiento adaptativo consume parte del presupuesto y
    // una petición no-streaming a este tamaño arriesga timeout HTTP del SDK.
    const stream = this.client.messages.stream({
      model: CLINICAL_MODEL_ID,
      max_tokens: CLINICAL_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    const response = await stream.finalMessage();

    if (response.stop_reason === 'refusal') {
      logger.error({ stopDetails: response.stop_details }, 'anthropic_clinical_refused');
      throw new Error('El motor clínico rechazó la solicitud.');
    }

    // Igual que en la extracción: un documento truncado se rechaza, no se parsea a medias.
    if (response.stop_reason === 'max_tokens') {
      logger.error(
        { caseId: input.caseId, maxTokens: CLINICAL_MAX_TOKENS, outputTokens: response.usage.output_tokens },
        'anthropic_clinical_truncated',
      );
      throw new Error(`El motor clínico excedió el límite de ${CLINICAL_MAX_TOKENS} tokens de salida.`);
    }

    // CS5/CS6: el contrato se valida aquí. Un campo fuera del esquema hace fallar el parse
    // (.strict()) y el documento se rechaza. Los guardarraíles (CS2/CS3/CS4) corren después.
    const generated = clinicalOutputSchema.parse(parseJson(firstText(response)));
    logger.info(
      {
        caseId: input.caseId,
        model: CLINICAL_MODEL_ID,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      'anthropic_clinical_done',
    );

    // Secciones que NO vienen de la IA: el examen lo registra el médico; los paraclínicos,
    // el código desde los labs realmente extraídos.
    // GLP-1: si el paciente NO declaró uso, la fila no debe aparecer (simetría con el stub).
    const antecedentes = stripUndeclaredGlp1(toDocFields(generated.antecedentes), Boolean(input.glp1?.declared));
    return {
      identificacion: toDocFields(generated.identificacion),
      antecedentes,
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
