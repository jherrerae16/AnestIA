import { extractText, getDocumentProxy } from 'unpdf';
import { logger } from '../logger';

/**
 * Capa 1+2 de la extracción en cascada: texto embebido del PDF, sin tocar el modelo.
 *
 * La mayoría de los informes de laboratorio son PDF digitales con el texto embebido; leerlo
 * localmente cuesta cero tokens y milisegundos. Sólo cuando el texto no sirve (PDF escaneado,
 * foto del celular, formato ilegible) se escala a visión — esa decisión la toma
 * `looksLikeLabText`, por código, sin adivinar con un modelo.
 */

/** Resultado de intentar leer el texto embebido de un archivo. */
export interface PdfTextResult {
  /** true si se obtuvo texto que PARECE un laboratorio (Capa 1 resolvió). */
  usable: boolean;
  /** Texto limpio (vacío si no se pudo leer o no parece un lab). */
  text: string;
  /** Motivo cuando usable=false, para el audit log (no se adivina en silencio). */
  reason?: 'sin_texto' | 'ilegible' | 'no_parece_lab' | 'error';
  /** Páginas del documento. `unpdf` ya lo calcula; se descartaba. */
  totalPages?: number | null;
}

/**
 * Longitud mínima de texto para considerarlo un informe y no ruido. Un hemograma suelto ronda
 * los 200 chars; el patrón de unidades (LAB_HINT) es el filtro fuerte, esto sólo descarta
 * fragmentos vacíos. Bajo de más → basura a Haiku; alto de más → informes cortos a visión.
 */
const MIN_CHARS = 150;

/** Proporción mínima de caracteres imprimibles: por debajo, son glifos rotos de un escaneo. */
const MIN_PRINTABLE_RATIO = 0.85;

/**
 * Patrones de un resultado de laboratorio: un número seguido de una unidad clínica. Si el
 * texto no tiene NINGUNO, no es un laboratorio legible (p. ej. un ECG, un consentimiento) y
 * se escala a visión. No se usa para extraer valores — sólo para decidir la capa.
 */
const LAB_HINT = /\d+[.,]?\d*\s*(mg\/d[lL]|g\/d[lL]|\/u[lL]|10\^\d|mmol\/[lL]|u?U?I\/m[lL]|mm\/h|fl|pg|%)/;

/** Colapsa espacios y saltos redundantes; conserva el orden y los números intactos. */
function clean(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Proporción de caracteres imprimibles (latinos + puntuación) sobre el total. */
function printableRatio(s: string): number {
  if (s.length === 0) return 0;
  const printable = s.replace(/[^\x20-\x7EÀ-ſ\n\t]/g, '');
  return printable.length / s.length;
}

/** ¿El texto extraído parece un informe de laboratorio legible? Decide capa 1 vs fallback. */
export function looksLikeLabText(text: string): { usable: boolean; reason?: PdfTextResult['reason'] } {
  const t = text.trim();
  if (t.length < MIN_CHARS) return { usable: false, reason: 'sin_texto' };
  if (printableRatio(t) < MIN_PRINTABLE_RATIO) return { usable: false, reason: 'ilegible' };
  if (!LAB_HINT.test(t)) return { usable: false, reason: 'no_parece_lab' };
  return { usable: true };
}

/**
 * Lee el texto embebido de un PDF y decide si es usable para la extracción por texto.
 * Nunca lanza: cualquier fallo devuelve usable=false para que la cascada escale a visión.
 */
export async function readPdfText(bytes: Buffer, label: string): Promise<PdfTextResult> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const cleaned = clean(String(text ?? ''));
    const verdict = looksLikeLabText(cleaned);
    if (!verdict.usable) {
      logger.info({ label, chars: cleaned.length, reason: verdict.reason }, 'pdf_text_not_usable');
      return { usable: false, text: '', reason: verdict.reason, totalPages };
    }
    return { usable: true, text: cleaned, totalPages };
  } catch (err) {
    logger.warn({ label, err: err instanceof Error ? err.message : String(err) }, 'pdf_text_read_error');
    return { usable: false, text: '', reason: 'error' };
  }
}
