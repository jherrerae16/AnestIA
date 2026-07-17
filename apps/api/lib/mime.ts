/**
 * Tipo MIME por extensión. Compartido entre la extracción por visión (que decide si un
 * adjunto va como `document` o `image`) y la descarga al panel (que necesita el tipo real
 * para que el navegador muestre el examen en vez de descargarlo).
 */
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

/** MIME del archivo, o null si la extensión no está soportada. */
export function mimeFor(filename: string): string | null {
  const i = filename.lastIndexOf('.');
  if (i < 0) return null;
  return MIME_BY_EXT[filename.slice(i).toLowerCase()] ?? null;
}

/** ¿El navegador puede renderizarlo embebido (PDF o imagen)? */
export function isViewableInline(mime: string | null): boolean {
  return !!mime && (mime === 'application/pdf' || mime.startsWith('image/'));
}

/**
 * Nombre original del archivo a partir de la clave de storage.
 * La clave es `<caseId>/<sha256>-<nombre original>` — se corta por el primer guion tras
 * el hash, no por el último, porque el nombre del paciente puede traer guiones.
 */
export function filenameFromKey(key: string): string {
  const base = key.slice(key.lastIndexOf('/') + 1);
  const dash = base.indexOf('-');
  return dash >= 0 ? base.slice(dash + 1) : base;
}
