import { prisma } from '../prisma';
import { getStorageProvider } from '../storage';
import { logAudit } from '../audit';

const ALLOWED_IMG = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BRANDING_BYTES = 5 * 1024 * 1024; // 5 MB

/** Perfil del anestesiólogo (branding + datos de firma). */
export function getProfile(anesthesiologistId: string) {
  return prisma.anesthesiologist.findUnique({
    where: { id: anesthesiologistId },
    select: {
      id: true, fullName: true, specialty: true, medicalRegistry: true, email: true,
      clinicLogoUrl: true, signatureUrl: true, footerText: true,
    },
  });
}

/** Actualiza los datos textuales del perfil (nombre, especialidad, registro, pie). */
export function updateProfile(
  anesthesiologistId: string,
  data: { fullName?: string; specialty?: string; medicalRegistry?: string; footerText?: string },
) {
  return prisma.anesthesiologist.update({
    where: { id: anesthesiologistId },
    data: {
      ...(data.fullName ? { fullName: data.fullName } : {}),
      ...(data.specialty !== undefined ? { specialty: data.specialty } : {}),
      ...(data.medicalRegistry !== undefined ? { medicalRegistry: data.medicalRegistry } : {}),
      ...(data.footerText !== undefined ? { footerText: data.footerText } : {}),
    },
    select: { id: true, fullName: true, specialty: true, medicalRegistry: true, footerText: true },
  });
}

/**
 * Sube un asset de branding (logo o firma) que el propio usuario carga desde la plataforma.
 * Guarda el archivo vía StorageProvider bajo branding/<anesthesiologistId> y actualiza la URL
 * en el perfil (clinicLogoUrl o signatureUrl). Valida tipo/tamaño (SECURITY-05/09).
 */
export async function uploadBranding(
  anesthesiologistId: string,
  kind: 'logo' | 'signature',
  file: File,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  if (!ALLOWED_IMG.includes(file.type)) {
    return { ok: false, error: 'Formato no permitido (PNG, JPG, WEBP o SVG).' };
  }
  if (file.size > MAX_BRANDING_BYTES) {
    return { ok: false, error: 'Archivo demasiado grande (máx 5 MB).' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = getStorageProvider();
  const { key } = await storage.put(bytes, {
    caseId: `branding/${anesthesiologistId}`, // usamos el prefijo como "dir"
    type: kind,
    filename: `${kind}-${file.name}`,
  });

  const url = `/api/branding/${encodeURIComponent(key)}`;
  await prisma.anesthesiologist.update({
    where: { id: anesthesiologistId },
    data: kind === 'logo' ? { clinicLogoUrl: url } : { signatureUrl: url },
  });
  await logAudit({ action: 'profile.branding_uploaded', entity: 'Anesthesiologist', entityId: anesthesiologistId, meta: { kind } });
  return { ok: true, url };
}
