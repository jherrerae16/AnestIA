import { z } from 'zod';
import { prisma } from '../prisma';
import { getAIProvider, type FileRef } from '../ai';
import { logAudit } from '../audit';
import { computeScalesForCase } from './scales.service';
import { logger } from '../logger';
import { getStorageProvider } from '../storage';
import { mimeFor } from '../mime';
import { readPdfText } from '../ai/pdf-text';
import {
  CODES,
  detectGLP1,
  flagLab,
  getMulti,
  getClinicalText,
  getText,
  canonicalAnalyte,
  canonicalEstudio,
  convertirUnidad,
  verificarIdentidad,
  normalizeGrupo,
  type FormAnswers,
} from '@anestia/shared';

/**
 * Borde de validación de la extracción (CS2/CS6). Un lab sin `sourceRef` no es
 * trazable y por tanto no se persiste: la ausencia de sustento se descarta, no se rellena.
 */
const extractedLabSchema = z.object({
  analyte: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().nullish(),
  refRange: z.string().nullish(),
  // Tipo de estudio leído del informe. Ausente → el render lo agrupa en "otros".
  grupo: z.string().nullish(),
  reportDate: z.string().nullish(),
  sourceRef: z.string().min(1),
  // Nombre y valor tal como están IMPRESOS. Se conservan siempre junto al normalizado: la
  // Especificación §15 exige "valor original, valor normalizado, unidad y rango del laboratorio".
  analyteRaw: z.string().nullish(),
  valueRaw: z.string().nullish(),
  institucion: z.string().nullish(),
  // Página del informe y confianza de la lectura. Los aporta el extractor.
  page: z.number().int().positive().nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  // Lo ponen el adaptador y el servicio (NO el modelo): la capa que produjo este lab y el
  // archivo del que salió. El modelo no puede conocer el id del adjunto.
  extractionLayer: z.enum(['texto', 'vision']).nullish(),
  attachmentId: z.string().nullish(),
  // Identidad impresa en el informe y fecha de toma de la muestra.
  pacienteNombre: z.string().nullish(),
  pacienteDocumento: z.string().nullish(),
  collectedAt: z.string().nullish(),
});

/**
 * Borde de validación de los informes NO de laboratorio (§16). Mismo criterio que los labs: sin
 * `sourceRef` no hay trazabilidad y no se persiste.
 */
const extractedEstudioSchema = z.object({
  tipo: z.string().nullish(),
  tipoRaw: z.string().nullish(),
  ritmo: z.string().nullish(),
  frecuencia: z.string().nullish(),
  intervalos: z.string().nullish(),
  conclusion: z.string().nullish(),
  hallazgos: z.string().nullish(),
  institucion: z.string().nullish(),
  collectedAt: z.string().nullish(),
  reportDate: z.string().nullish(),
  page: z.number().int().positive().nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  pacienteNombre: z.string().nullish(),
  pacienteDocumento: z.string().nullish(),
  extractionLayer: z.enum(['texto', 'vision']).nullish(),
  attachmentId: z.string().nullish(),
  sourceRef: z.string().min(1),
});

/**
 * Fecha del informe → Date, o null. Sólo acepta AAAA-MM-DD real y descarta lo absurdo
 * (futuro, o anterior a 1900): una fecha inventada es peor que ninguna — el médico
 * la usa para decidir si el examen sigue vigente (CS2).
 */
function parseReportDate(raw: string | null | undefined, now: Date): Date | null {
  const s = (raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() > now.getTime() || d.getUTCFullYear() < 1900) return null;
  return d;
}

/** Normaliza el nombre del analito para comparar entre métodos (mayúsculas, espacios). */
function normAnalyte(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Primer número de un valor, o null. Para comparar valores tolerando texto/unidad. */
function numOf(v: string | null | undefined): number | null {
  const m = String(v ?? '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

/**
 * Compara dos extracciones del mismo caso y clasifica las diferencias para el audit log.
 *
 * Distingue lo que decide tu condición de salida:
 *  - DISCREPANCIA (clínica): mismo analito con valor numérico distinto, o analito presente en
 *    un método y ausente en el otro. Es lo que cuenta para el umbral del 1%.
 *  - solo ETIQUETA: el analito coincide en valor pero difiere el nombre (p. ej. "CRISTALES" vs
 *    "CRISTALES DE OXALATO"). No es discrepancia clínica; se registra aparte.
 *
 * `base` = método de referencia (visión); `alt` = el candidato (capas).
 */
export function diffExtractions(
  base: { analyte: string; value: string | null }[],
  alt: { analyte: string; value: string | null }[],
): {
  discrepancia: boolean;
  soloEnVision: string[];
  soloEnCapas: string[];
  valorDistinto: { analyte: string; vision: string | null; capas: string | null }[];
  coincidentes: number;
} {
  const mapBase = new Map(base.map((l) => [normAnalyte(l.analyte), l]));
  const mapAlt = new Map(alt.map((l) => [normAnalyte(l.analyte), l]));

  const soloEnVision = [...mapBase.keys()].filter((k) => !mapAlt.has(k));
  const soloEnCapas = [...mapAlt.keys()].filter((k) => !mapBase.has(k));

  const valorDistinto: { analyte: string; vision: string | null; capas: string | null }[] = [];
  let coincidentes = 0;
  for (const [k, b] of mapBase) {
    const a = mapAlt.get(k);
    if (!a) continue;
    const nb = numOf(b.value);
    const na = numOf(a.value);
    const igual = nb !== null && na !== null ? Math.abs(nb - na) < 0.001 : String(b.value).trim() === String(a.value).trim();
    if (igual) coincidentes++;
    else valorDistinto.push({ analyte: k, vision: b.value, capas: a.value });
  }

  const discrepancia = soloEnVision.length > 0 || soloEnCapas.length > 0 || valorDistinto.length > 0;
  return { discrepancia, soloEnVision, soloEnCapas, valorDistinto, coincidentes };
}

/** Modo de extracción de labs (env LAB_EXTRACTION_MODE). */
type LabExtractionMode = 'capas' | 'vision' | 'comparativo';

function extractionMode(): LabExtractionMode {
  const v = (process.env.LAB_EXTRACTION_MODE ?? 'capas').toLowerCase();
  return v === 'vision' || v === 'comparativo' ? v : 'capas';
}

/**
 * Persiste un lab candidato; descarta lo no trazable (CS2/CS6). Devuelve 1 si persistió.
 * `forceMethod` fija el método (modo comparativo persiste todo como 'vision'); si no, se toma
 * la capa que produjo cada lab (`extractionLayer`), así el método queda fiel por analito.
 */
/**
 * Umbral de confianza. Por debajo, el resultado va a revisión humana en vez de darse por bueno.
 * La Especificación no fija un número; 0.7 es conservador y el Dr. puede ajustarlo.
 */
const CONFIANZA_MINIMA = 0.7;

async function persistLab(
  caseId: string,
  candidate: unknown,
  now: Date,
  forceMethod?: 'texto' | 'vision',
  identidadCaso?: { fullName: string; documentId: string } | null,
): Promise<number> {
  const parsed = extractedLabSchema.safeParse(candidate);
  if (!parsed.success) {
    logger.warn({ caseId, analyte: (candidate as { analyte?: string })?.analyte }, 'lab_extract_discarded_untraceable');
    return 0;
  }
  const lab = parsed.data;
  const method = forceMethod ?? lab.extractionLayer ?? 'vision';

  // Un resultado ilegible, sin unidad, discordante o de baja confianza pasa a revisión humana
  // (Especificación §15). No se descarta —perderlo sería peor— pero tampoco alimenta escalas
  // ni alertas hasta que el médico lo confirme.
  // Conversión de unidades SÓLO con reglas validadas; sin regla, el valor se deja como vino.
  // El original se conserva en `valueRaw`/`unitRaw` incluso cuando sí se convierte.
  const conv = convertirUnidad(lab.analyte, lab.value, lab.unit);

  // ¿Es de este paciente? Un informe de otra persona no puede alimentar escalas ni alertas
  // (Especificación §15: "identidad del paciente y concordancia con el caso activo").
  const identidad = identidadCaso
    ? verificarIdentidad(identidadCaso, {
        nombre: lab.pacienteNombre,
        documento: lab.pacienteDocumento,
      })
    : { match: 'NO_VERIFICABLE' as const, motivo: 'El caso no tiene paciente vinculado todavía.' };

  const confianza = lab.confidence ?? null;
  const dudoso =
    (confianza != null && confianza < CONFIANZA_MINIMA) ||
    !lab.unit ||
    lab.attachmentId == null ||
    // Una discordancia de identidad SIEMPRE va a revisión humana, por buena que sea la lectura.
    identidad.match === 'NO_COINCIDE';

  if (identidad.match === 'NO_COINCIDE') {
    logger.warn({ caseId, analyte: lab.analyte, motivo: identidad.motivo }, 'lab_identidad_discordante');
  }

  await prisma.extractedLabResult.create({
    data: {
      caseId,
      attachmentId: lab.attachmentId ?? null,
      page: lab.page ?? null,
      analyte: canonicalAnalyte(lab.analyte) ?? lab.analyte,
      // El nombre impreso se conserva SIEMPRE: es la trazabilidad al informe original.
      analyteRaw: lab.analyteRaw ?? lab.analyte,
      value: conv.value,
      valueRaw: lab.valueRaw ?? conv.valueRaw,
      unit: conv.unit,
      unitRaw: conv.unitRaw,
      conversionRule: conv.conversionRule,
      institucion: lab.institucion ?? null,
      collectedAt: parseReportDate(lab.collectedAt, now),
      identityMatch: identidad.match,
      confidence: confianza,
      estadoExtraccion: dudoso ? 'PENDIENTE_CONFIRMACION' : 'AUTOMATICO',
      refRange: lab.refRange ?? null,
      grupo: normalizeGrupo(lab.grupo),
      reportDate: parseReportDate(lab.reportDate, now),
      sourceRef: lab.sourceRef,
      extractionMethod: method,
      flag: 'NORMAL',
    },
  });
  return 1;
}

/**
 * Persiste un informe diagnóstico no-laboratorio. Devuelve 1 si persistió.
 *
 * Un estudio sin ningún contenido legible NO se guarda: una fila que sólo diga
 * "Electrocardiograma" le sugiere al médico que se leyó algo cuando no se leyó nada.
 *
 * Estos datos **no alimentan escalas** (§16: "interpretación clínica; no autocalcular escalas").
 * La garantía no está en esta función sino en CS9: `estudio:*` no está en la lista blanca de
 * procedencias, y hay un test que lo comprueba.
 */
async function persistEstudio(
  caseId: string,
  candidate: unknown,
  now: Date,
  forceMethod?: 'texto' | 'vision',
  identidadCaso?: { fullName: string; documentId: string } | null,
): Promise<number> {
  const parsed = extractedEstudioSchema.safeParse(candidate);
  if (!parsed.success) {
    logger.warn({ caseId, tipo: (candidate as { tipo?: string })?.tipo }, 'estudio_extract_discarded_untraceable');
    return 0;
  }
  const e = parsed.data;

  const contenido = [e.ritmo, e.frecuencia, e.intervalos, e.conclusion, e.hallazgos]
    .map((v) => (v ?? '').trim())
    .filter(Boolean);
  if (contenido.length === 0) {
    logger.warn({ caseId, tipo: e.tipo }, 'estudio_extract_sin_contenido');
    return 0;
  }

  const identidad = identidadCaso
    ? verificarIdentidad(identidadCaso, { nombre: e.pacienteNombre, documento: e.pacienteDocumento })
    : { match: 'NO_VERIFICABLE' as const, motivo: 'El caso no tiene paciente vinculado todavía.' };

  const confianza = e.confidence ?? null;
  const dudoso =
    (confianza != null && confianza < CONFIANZA_MINIMA) ||
    e.attachmentId == null ||
    identidad.match === 'NO_COINCIDE';

  if (identidad.match === 'NO_COINCIDE') {
    logger.warn({ caseId, tipo: e.tipo, motivo: identidad.motivo }, 'estudio_identidad_discordante');
  }

  await prisma.extractedStudy.create({
    data: {
      caseId,
      attachmentId: e.attachmentId ?? null,
      page: e.page ?? null,
      // El tipo se canonicaliza por código a partir de lo impreso: lo que no se reconoce cae en
      // OTRO conservando el nombre del informe, en vez de forzarlo a una categoría que no es.
      tipo: canonicalEstudio(e.tipo ?? e.tipoRaw),
      tipoRaw: e.tipoRaw ?? e.tipo ?? null,
      ritmo: e.ritmo ?? null,
      frecuencia: e.frecuencia ?? null,
      intervalos: e.intervalos ?? null,
      conclusion: e.conclusion ?? null,
      hallazgos: e.hallazgos ?? null,
      institucion: e.institucion ?? null,
      collectedAt: parseReportDate(e.collectedAt, now),
      reportDate: parseReportDate(e.reportDate, now),
      confidence: confianza,
      estadoExtraccion: dudoso ? 'PENDIENTE_CONFIRMACION' : 'AUTOMATICO',
      identityMatch: identidad.match,
      sourceRef: e.sourceRef,
      extractionMethod: forceMethod ?? e.extractionLayer ?? 'vision',
    },
  });
  return 1;
}

/**
 * lab.extract: extrae los labs de los adjuntos del caso (AIProvider) y persiste
 * ExtractedLabResult con sourceRef. Idempotente. NUNCA fabrica valores ausentes (CS2).
 *
 * Modo (LAB_EXTRACTION_MODE):
 *  - 'capas' (por defecto): cascada texto → visión de fallback. Persiste ese resultado.
 *  - 'vision': fuerza visión. Persiste ese resultado.
 *  - 'comparativo': corre AMBOS métodos, persiste SÓLO el de visión (el conocido) y registra
 *    en audit el diff — cuántas discrepancias clínicas y en qué analitos — para decidir la
 *    migración con datos. Nunca persiste los dos: duplicaría los labs del documento.
 *
 * También detecta GLP-1 declarado (P15) y lo registra en audit.
 */
export async function extractForCase(caseId: string): Promise<void> {
  const [existing, existingEstudios] = await Promise.all([
    prisma.extractedLabResult.count({ where: { caseId } }),
    prisma.extractedStudy.count({ where: { caseId } }),
  ]);
  if (existing > 0 || existingEstudios > 0) return; // idempotencia

  // Identidad del caso, para comprobar que cada informe sea de este paciente. Si el caso aún no
  // tiene paciente vinculado, la comprobación queda en NO_VERIFICABLE en vez de darse por buena.
  const kaseIdent = await prisma.case.findUnique({
    where: { id: caseId },
    select: { patient: { select: { fullName: true, documentId: true } } },
  });
  const identidadCaso = kaseIdent?.patient ?? null;

  const attachments = await prisma.attachment.findMany({ where: { caseId } });
  // `attachmentId` viaja con cada archivo para poder devolverlo en cada valor extraído. Antes
  // se pasaba la clave de almacenamiento como "filename" y el id se perdía, así que un lab no
  // se podía rastrear a su PDF.
  const files: FileRef[] = attachments.map((a) => ({
    key: a.url,
    type: a.type,
    filename: a.filename ?? a.url,
    attachmentId: a.id,
  }));

  // Número de páginas de cada PDF. `unpdf` ya lo calcula al leer el texto y se descartaba; sirve
  // para saber si la página que cita un resultado existe de verdad.
  await registrarPaginas(attachments);
  const provider = getAIProvider();
  const mode = extractionMode();
  const now = new Date();

  if (mode === 'comparativo') {
    // Corre ambos; persiste visión; audita el diff. Si una capa falla, se registra pero no
    // se cae el pipeline: el método a persistir (visión) manda.
    const [capasRes, visionRes] = await Promise.all([
      provider.extractLabs(files, 'capas').catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
      provider.extractLabs(files, 'vision'),
    ]);

    let persisted = 0;
    for (const c of visionRes.labs) persisted += await persistLab(caseId, c, now, 'vision', identidadCaso);
    let estudios = 0;
    for (const e of visionRes.estudios ?? []) estudios += await persistEstudio(caseId, e, now, 'vision', identidadCaso);

    const diff =
      'error' in capasRes
        ? { error: (capasRes as { error: string }).error }
        : diffExtractions(visionRes.labs, capasRes.labs);
    await logAudit({
      action: 'extraction.compared',
      entity: 'Case',
      entityId: caseId,
      meta: {
        vision: { labs: visionRes.labs.length, estudios: visionRes.estudios?.length ?? 0, perFile: visionRes.perFile },
        capas: 'error' in capasRes ? { error: (capasRes as { error: string }).error } : { labs: capasRes.labs.length, perFile: capasRes.perFile },
        discrepancia: 'discrepancia' in diff ? diff.discrepancia : false,
        ...diff,
      },
    });
    logger.info({ caseId, mode, persisted, estudios, discrepancia: 'discrepancia' in diff ? diff.discrepancia : 'error' }, 'lab_extract_compared');
  } else {
    // 'capas' o 'vision'. Cada lab ya trae su capa de origen (extractionLayer), así que el
    // método persistido es fiel por analito, no una aproximación del caso.
    const res = await provider.extractLabs(files, mode);
    let persisted = 0;
    for (const c of res.labs) persisted += await persistLab(caseId, c, now, undefined, identidadCaso);
    let estudios = 0;
    for (const e of res.estudios ?? []) estudios += await persistEstudio(caseId, e, now, undefined, identidadCaso);
    await logAudit({
      action: 'extraction.done',
      entity: 'Case',
      entityId: caseId,
      meta: { mode, persisted, estudios, perFile: res.perFile },
    });
  }

  // GLP-1: el módulo estructurado (GL01) es la fuente principal; el texto libre de medicamentos
  // queda como red de seguridad para lo que el paciente escriba por su cuenta. Nunca se lee el
  // sí/no de RX01: el detector recibiría la cadena "si" y no encontraría un fármaco jamás, así
  // que la alerta de vaciamiento gástrico no llegaría al audit log (CS8).
  const fr = await prisma.formResponse.findUnique({ where: { caseId } });
  const answers = (fr?.answers as FormAnswers) ?? {};
  const modulo = getMulti(answers, CODES.glp1).filter((o) => !/^(ninguno|no sabe)$/i.test(o.trim()));
  const glp1 = modulo.length > 0
    ? { declared: true, drug: modulo.join(', ') }
    : detectGLP1(getClinicalText(answers, CODES.listaMedicamentos) + ' ' + getText(answers, CODES.naturales));
  if (glp1.declared) {
    await logAudit({ action: 'glp1.detected', entity: 'Case', entityId: caseId, meta: { drug: glp1.drug } });
  }
}

/**
 * lab.flag: marca cada laboratorio comparándolo contra el RANGO IMPRESO en el propio examen
 * (refRange). Sin umbrales hardcodeados. Si el rango no se pudo interpretar, el analito queda
 * sin marcar pero con `rangeUnparsed` para avisar al médico, y se registra el string original
 * en el audit log (evidencia real de qué formatos aparecen, para ajustar el parser con datos).
 */
export async function flagForCase(caseId: string): Promise<void> {
  const results = await prisma.extractedLabResult.findMany({ where: { caseId } });
  for (const r of results) {
    const { flag, rangeUnparsed } = flagLab(r.refRange, r.value);
    if (flag !== r.flag || rangeUnparsed !== r.rangeUnparsed) {
      await prisma.extractedLabResult.update({ where: { id: r.id }, data: { flag, rangeUnparsed } });
    }
    if (rangeUnparsed) {
      await logAudit({
        action: 'lab.range_unparsed',
        entity: 'ExtractedLabResult',
        entityId: r.id,
        meta: { caseId, analyte: r.analyte, refRange: r.refRange, value: r.value },
      });
    }
  }
}

/**
 * Re-marca los labs de un caso contra el rango impreso, corrigiendo filas cuyo `flag` quedó
 * obsoleto (p. ej. casos procesados antes de la regla "marcar contra rango impreso", o por un
 * worker viejo). Idempotente y barato: sólo escribe donde el veredicto cambia y NUNCA toca el
 * `manualFlag` del médico. Devuelve cuántas filas corrigió. Es la red de seguridad para que un
 * caso ya extraído no se quede con veredictos NORMAL por defecto sin re-emitir el pipeline.
 */
export async function reflagForCase(caseId: string): Promise<number> {
  const results = await prisma.extractedLabResult.findMany({ where: { caseId } });
  let corrected = 0;
  for (const r of results) {
    const { flag, rangeUnparsed } = flagLab(r.refRange, r.value);
    if (flag !== r.flag || rangeUnparsed !== r.rangeUnparsed) {
      await prisma.extractedLabResult.update({ where: { id: r.id }, data: { flag, rangeUnparsed } });
      corrected++;
    }
  }
  if (corrected > 0) {
    await logAudit({ action: 'lab.reflagged', entity: 'Case', entityId: caseId, meta: { corrected } });
  }
  return corrected;
}

export class LabNotFoundError extends Error {
  constructor() { super('Laboratorio no encontrado.'); this.name = 'LabNotFoundError'; }
}

/**
 * Veredicto MANUAL del anestesiólogo sobre un analito (HITL). `verdict = null` deshace.
 *
 * - Conserva SIEMPRE el veredicto automático del sistema (`flag`); solo escribe `manualFlag`.
 * - `manualSource` distingue el caso: si el analito era ilegible (`rangeUnparsed`), es una
 *   verificación; si el sistema ya había dado un veredicto, es una sobrescritura.
 * - Aislamiento por perfil: el lab debe pertenecer a un caso de este anestesiólogo.
 * - Audit con el veredicto ORIGINAL del sistema + el del médico (evidencia de ambos).
 */
export async function setLabVerdict(
  anesthesiologistId: string,
  caseId: string,
  labId: string,
  verdict: 'NORMAL' | 'ALERTA' | 'CRITICO' | null,
): Promise<{ manualFlag: string | null; effectiveFlag: string }> {
  const lab = await prisma.extractedLabResult.findFirst({
    where: { id: labId, caseId, case: { anesthesiologistId } },
  });
  if (!lab) throw new LabNotFoundError();

  if (verdict === null) {
    // Deshacer: vuelve a regir el veredicto del sistema.
    await prisma.extractedLabResult.update({
      where: { id: lab.id },
      data: { manualFlag: null, manualSource: null, manualBy: null, manualAt: null },
    });
    await logAudit({
      actorId: anesthesiologistId,
      action: 'lab.verdict_cleared',
      entity: 'ExtractedLabResult',
      entityId: lab.id,
      meta: { caseId, analyte: lab.analyte, value: lab.value, sistemaFlag: lab.flag },
    });
    return { manualFlag: null, effectiveFlag: lab.flag };
  }

  // Fuente: verificación de ilegible vs sobrescritura de un veredicto del sistema.
  const source = lab.rangeUnparsed
    ? 'anestesiologo:verificado-manualmente'
    : 'anestesiologo:sobrescribio-sistema';

  await prisma.extractedLabResult.update({
    where: { id: lab.id },
    data: { manualFlag: verdict as never, manualSource: source, manualBy: anesthesiologistId, manualAt: new Date() },
  });
  await logAudit({
    actorId: anesthesiologistId,
    action: 'lab.verdict_manual',
    entity: 'ExtractedLabResult',
    entityId: lab.id,
    meta: {
      caseId,
      analyte: lab.analyte,
      value: lab.value,
      source,
      // Ambos veredictos quedan registrados: el del sistema NO se pierde al sobrescribir.
      sistemaFlag: lab.flag,
      rangeUnparsed: lab.rangeUnparsed,
      medicoFlag: verdict,
    },
  });
  return { manualFlag: verdict, effectiveFlag: verdict };
}

/**
 * Guarda cuántas páginas tiene cada PDF adjunto.
 *
 * No es decorativo: un resultado dice de qué página salió, y sin saber cuántas tiene el
 * documento no se puede detectar una cita imposible ("página 7" en un informe de 2 páginas).
 * Falla en silencio por archivo: no poder contar las páginas de uno no puede impedir la
 * extracción de los demás.
 */
async function registrarPaginas(
  attachments: readonly { id: string; url: string; filename: string | null; pageCount: number | null }[],
): Promise<void> {
  const storage = getStorageProvider();
  for (const a of attachments) {
    if (a.pageCount != null) continue;
    const nombre = a.filename ?? a.url;
    if (mimeFor(nombre) !== 'application/pdf') continue;
    try {
      const res = await readPdfText(await storage.get(a.url), nombre);
      if (res.totalPages != null) {
        await prisma.attachment.update({ where: { id: a.id }, data: { pageCount: res.totalPages } });
      }
    } catch (err) {
      logger.warn(
        { attachmentId: a.id, err: err instanceof Error ? err.message : String(err) },
        'pdf_pagecount_failed',
      );
    }
  }
}

/** Qué se confirma: un analito de laboratorio o un informe diagnóstico. */
export type TipoLectura = 'lab' | 'estudio';

/**
 * Confirma (o vuelve a retener) una lectura que el extractor marcó dudosa.
 *
 * Cierra una puerta de una sola vía. Un resultado con confianza baja, sin unidad o con identidad
 * no verificable queda en `PENDIENTE_CONFIRMACION` y **no alimenta escalas ni tendencias**, que
 * es lo correcto — pero hasta ahora nada escribía nunca `CONFIRMADO`: el dato quedaba retenido
 * para siempre, sin forma de rescatarlo y sin que el médico supiera que existía.
 *
 * Confirmar es un acto del anestesiólogo sobre el informe original, no una corrección del valor:
 * él mira el PDF y dice "sí, ahí dice 9.8". Por eso queda en el audit log con su id, y por eso
 * al confirmar un laboratorio se **recalculan las escalas** — el dato que faltaba ya está.
 */
export async function confirmarLectura(
  anesthesiologistId: string,
  caseId: string,
  tipo: TipoLectura,
  id: string,
  confirmado: boolean,
): Promise<{ estadoExtraccion: string }> {
  const estado = confirmado ? 'CONFIRMADO' : 'PENDIENTE_CONFIRMACION';

  if (tipo === 'lab') {
    const lab = await prisma.extractedLabResult.findFirst({
      where: { id, caseId, case: { anesthesiologistId } },
    });
    if (!lab) throw new LabNotFoundError();
    await prisma.extractedLabResult.update({
      where: { id: lab.id },
      data: { estadoExtraccion: estado as never },
    });
    await logAudit({
      actorId: anesthesiologistId,
      action: confirmado ? 'lab.lectura_confirmada' : 'lab.lectura_retenida',
      entity: 'ExtractedLabResult',
      entityId: lab.id,
      meta: { caseId, analyte: lab.analyte, value: lab.value, confidence: lab.confidence },
    });
  } else {
    const est = await prisma.extractedStudy.findFirst({
      where: { id, caseId, case: { anesthesiologistId } },
    });
    if (!est) throw new LabNotFoundError();
    await prisma.extractedStudy.update({
      where: { id: est.id },
      data: { estadoExtraccion: estado as never },
    });
    await logAudit({
      actorId: anesthesiologistId,
      action: confirmado ? 'estudio.lectura_confirmada' : 'estudio.lectura_retenida',
      entity: 'ExtractedStudy',
      entityId: est.id,
      meta: { caseId, tipo: est.tipo, confidence: est.confidence },
    });
  }

  // Un laboratorio confirmado entra a las escalas que lo esperaban; uno retenido sale de ellas.
  // Los estudios no alimentan ninguna (§16), así que no hay nada que recalcular.
  if (tipo === 'lab') await computeScalesForCase(caseId);

  return { estadoExtraccion: estado };
}
