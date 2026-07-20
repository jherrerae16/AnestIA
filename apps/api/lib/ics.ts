import { pureDateStamp } from './tz';

/**
 * Generador de archivos .ics (iCalendar, RFC 5545) para una sola cirugía. Sin librería:
 * un VEVENT es texto plano y arrastrar una dependencia no se justifica.
 *
 * El evento es all-day (VALUE=DATE, sin hora): así ninguna app de calendario lo corre de
 * día por diferencias de zona. El .ics es de un solo disparo — una foto del estado al
 * momento de descargarlo; si la cirugía se reagenda, el médico debe volver a añadirlo (lo
 * decimos en la descripción, en lenguaje no técnico).
 */

export interface SurgeryEvent {
  caseId: string;
  patientName: string;
  procedure: string | null;
  insurer: string | null;
  /** Fecha de la cirugía (procedureDate). Se interpreta como día de Bogotá. */
  date: Date;
  /** URL absoluta al caso en el panel (deep-link). */
  caseUrl: string;
  /** Instante de generación (para DTSTAMP). Se pasa explícito: no usamos Date.now() aquí. */
  now: Date;
}

const DISCLAIMER =
  'Este evento es una copia. Si cambia la fecha, vuelve a añadir el evento actualizado.';

/** Construye el contenido .ics de una cirugía. */
export function buildSurgeryIcs(ev: SurgeryEvent): string {
  // Fecha pura (all-day): se estampa por su día UTC tal cual, sin desplazar a Bogotá.
  const dtStart = pureDateStamp(ev.date);
  const dtStamp = icsUtcStamp(ev.now);
  const summary = `Cirugía — ${ev.patientName} — ${ev.procedure ?? 'Procedimiento'}`;

  const descParts = [
    `Procedimiento: ${ev.procedure ?? 'Sin especificar'}`,
    `Aseguradora: ${ev.insurer ?? 'Sin especificar'}`,
    `Caso: ${ev.caseUrl}`,
    '',
    DISCLAIMER,
  ];

  // UID estable por caso: si el médico vuelve a descargar, el calendario reemplaza el evento
  // en vez de duplicarlo.
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AnestIA//Calendario de cirugías//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:caso-${ev.caseId}@anestia`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    'DURATION:P1D',
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(descParts.join('\n'))}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // RFC 5545 exige CRLF entre líneas de contenido.
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Nombre de archivo sugerido para la descarga. */
export function icsFilename(patientName: string): string {
  const slug = patientName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'cirugia';
  return `cirugia-${slug}.ics`;
}

/** Timestamp UTC en formato iCalendar: YYYYMMDDTHHMMSSZ. */
function icsUtcStamp(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/**
 * Escape de texto según RFC 5545: backslash, coma, punto y coma y saltos de línea.
 * El orden importa — la barra invertida se escapa primero.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Plegado de líneas largas (RFC 5545: máx 75 octetos por línea; continuación con CRLF + espacio).
 * Se cuenta por bytes UTF-8 para no partir a mitad de un carácter multibyte (acentos).
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    // La primera línea admite 75; las continuaciones llevan un espacio inicial (73 útiles).
    const limit = out.length === 0 ? 75 : 74;
    if (chunkBytes + chBytes > limit) {
      out.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += ch;
    chunkBytes += chBytes;
  }
  if (chunk) out.push(chunk);
  return out.join('\r\n ');
}
