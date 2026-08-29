import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';
import { CODES, getText, toTitleCase, type FormAnswers } from '@anestia/shared';

/** Cliente Prisma o cliente transaccional (para composición atómica). */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Opción de ID04 → enum de la BD. Conjunto cerrado del diccionario: no se adivina por prefijo.
 * "No sabe" y "Prefiero no responder" se conservan como estados propios — colapsarlos en un
 * genérico perdería la distinción que STOP-Bang y Apfel necesitan y que la spec pide guardar.
 */
const SEXO_POR_OPCION: Record<string, 'MUJER' | 'HOMBRE' | 'INTERSEXUAL' | 'NO_SABE' | 'PREFIERE_NO_RESPONDER'> = {
  mujer: 'MUJER',
  hombre: 'HOMBRE',
  intersexual: 'INTERSEXUAL',
  'no sabe': 'NO_SABE',
  'prefiero no responder': 'PREFIERE_NO_RESPONDER',
};

/**
 * Upsert de Patient a partir de las respuestas del formulario (US-1.7 / RF-11.2).
 * Lee por CÓDIGO de la especificación (ver `CODES`), no por posición.
 * Idempotente por (anesthesiologistId, documentId).
 */
export async function upsertFromForm(
  anesthesiologistId: string,
  answers: FormAnswers,
  db: Db = prisma,
): Promise<string | null> {
  const get = (code: string) => getText(answers, code);
  // Clave del documento sin puntos de miles (cédula "1.042" ≡ "1042"); pasaporte se conserva.
  const documentId = get(CODES.documento).replace(/\.(?=\d)/g, '').trim();
  const rawName = get(CODES.nombre);
  if (!documentId || !rawName) return null; // sin identificación no se crea paciente
  // Nombre normalizado a Title-Case en un solo punto (el guardado): corrige "juan herrera"
  // → "Juan Herrera" y "MARIA HERRERA" → "Maria Herrera" en BD, panel, PDF y export por
  // igual. toTitleCase respeta partículas ("de la cruz") y es el mismo que usa el documento.
  const fullName = toTitleCase(rawName);

  // Sexo registrado al nacer (ID04). Las opciones son un conjunto CERRADO del diccionario, así
  // que se mapean por igualdad y no con heurísticas de prefijo: la spec necesita distinguir
  // intersexual y "no sabe", que un regex `/^(masc|hombre|m$)/` no puede expresar.
  const sexAtBirth = SEXO_POR_OPCION[get(CODES.sexoNacimiento).trim().toLowerCase()] ?? null;
  const birth = get(CODES.fechaNacimiento);
  const birthDate = birth ? new Date(birth) : null;

  const patient = await db.patient.upsert({
    where: { anesthesiologistId_documentId: { anesthesiologistId, documentId } },
    update: {
      fullName,
      phone: get(CODES.telefono) || undefined,
      email: normalizeEmail(get(CODES.correo)) || undefined,
      insurer: get(CODES.aseguradora) || undefined,
      bloodType: get(CODES.grupoSanguineo) || undefined,
      ...(sexAtBirth ? { sexAtBirth } : {}),
      ...(birthDate && !isNaN(birthDate.getTime()) ? { birthDate } : {}),
    },
    create: {
      anesthesiologistId,
      documentId,
      fullName,
      phone: get(CODES.telefono) || null,
      email: normalizeEmail(get(CODES.correo)) || null,
      insurer: get(CODES.aseguradora) || null,
      bloodType: get(CODES.grupoSanguineo) || null,
      sexAtBirth: (sexAtBirth ?? undefined) as never,
      birthDate: birthDate && !isNaN(birthDate.getTime()) ? birthDate : null,
    },
  });
  return patient.id;
}

function str(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/** Normaliza correo: trim + minúsculas. Devuelve '' si no parece un correo válido. */
function normalizeEmail(v: string): string {
  const e = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
}

/** Búsqueda de pacientes por documento o nombre (aislado por anesthesiologist). [US-6.3] */
export function searchPatients(anesthesiologistId: string, query: string) {
  return prisma.patient.findMany({
    where: {
      anesthesiologistId,
      OR: [
        { documentId: { contains: query } },
        { fullName: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { fullName: 'asc' },
    take: 50,
  });
}

/** Ficha del paciente con su historial de valoraciones. [US-6.3] */
export function getPatientWithHistory(anesthesiologistId: string, patientId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, anesthesiologistId },
    include: {
      cases: {
        orderBy: { createdAt: 'desc' },
        include: { assessment: { select: { id: true } }, approval: { select: { approvedAt: true } } },
      },
    },
  });
}
