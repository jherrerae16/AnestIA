/**
 * Formato del número de documento.
 * - Cédula (solo dígitos) → separadores de miles con punto, estilo Colombia: 1.042.246.578.
 * - Pasaporte / otros con letras (ej. PE19028) → se deja tal cual, en mayúsculas, sin puntos.
 */
export function formatDocumentId(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  const digitsOnly = v.replace(/[.\s]/g, '');
  // Solo dígitos → cédula → puntos de miles.
  if (/^\d+$/.test(digitsOnly)) {
    return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  // Contiene letras → pasaporte u otro documento → sin puntos, mayúsculas.
  return v.toUpperCase();
}
