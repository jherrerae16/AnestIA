import { z } from 'zod';
import { prisma } from '../prisma';
import { getAIProvider, type FileRef } from '../ai';
import { logAudit } from '../audit';
import { logger } from '../logger';
import {
  CODES,
  detectGLP1,
  flagLab,
  getMulti,
  getClinicalText,
  getText,
  canonicalAnalyte,
  convertirUnidad,
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

  const confianza = lab.confidence ?? null;
  const dudoso =
    (confianza != null && confianza < CONFIANZA_MINIMA) ||
    !lab.unit ||
    lab.attachmentId == null;

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
  const existing = await prisma.extractedLabResult.count({ where: { caseId } });
  if (existing > 0) return; // idempotencia

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
    for (const c of visionRes.labs) persisted += await persistLab(caseId, c, now, 'vision');

    const diff =
      'error' in capasRes
        ? { error: (capasRes as { error: string }).error }
        : diffExtractions(visionRes.labs, capasRes.labs);
    await logAudit({
      action: 'extraction.compared',
      entity: 'Case',
      entityId: caseId,
      meta: {
        vision: { labs: visionRes.labs.length, perFile: visionRes.perFile },
        capas: 'error' in capasRes ? { error: (capasRes as { error: string }).error } : { labs: capasRes.labs.length, perFile: capasRes.perFile },
        discrepancia: 'discrepancia' in diff ? diff.discrepancia : false,
        ...diff,
      },
    });
    logger.info({ caseId, mode, persisted, discrepancia: 'discrepancia' in diff ? diff.discrepancia : 'error' }, 'lab_extract_compared');
  } else {
    // 'capas' o 'vision'. Cada lab ya trae su capa de origen (extractionLayer), así que el
    // método persistido es fiel por analito, no una aproximación del caso.
    const res = await provider.extractLabs(files, mode);
    let persisted = 0;
    for (const c of res.labs) persisted += await persistLab(caseId, c, now);
    await logAudit({
      action: 'extraction.done',
      entity: 'Case',
      entityId: caseId,
      meta: { mode, persisted, perFile: res.perFile },
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
