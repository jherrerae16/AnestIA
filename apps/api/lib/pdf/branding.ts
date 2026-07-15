import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStorageProvider } from '../storage';

/**
 * Resuelve una URL de branding a un data URI para incrustarlo en el PDF (Playwright sin red).
 * Soporta:
 *  - `/api/branding/<key>`  → asset subido por el usuario (StorageProvider).
 *  - `/branding/<file>`     → placeholder en public/ del proyecto.
 * Devuelve null si no se puede leer.
 */
export async function brandingDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    let bytes: Buffer;
    if (url.startsWith('/api/branding/')) {
      const key = decodeURIComponent(url.replace('/api/branding/', ''));
      bytes = await getStorageProvider().get(key);
    } else {
      const rel = url.replace(/^\//, '');
      bytes = await readFile(join(process.cwd(), 'public', rel));
    }
    const mime = url.endsWith('.svg') ? 'image/svg+xml'
      : url.endsWith('.png') ? 'image/png'
      : url.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}
