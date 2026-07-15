/**
 * Rate limit in-memory (piloto). Ventana deslizante por clave (IP+ruta).
 * Migrable a Redis/gateway en producción. SECURITY-11.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= limit;
}

/** Limpia entradas viejas (evita crecimiento ilimitado). */
export function sweep(windowMs: number): void {
  const now = Date.now();
  for (const [k, arr] of hits) {
    const kept = arr.filter((t) => now - t < windowMs);
    if (kept.length === 0) hits.delete(k);
    else hits.set(k, kept);
  }
}
