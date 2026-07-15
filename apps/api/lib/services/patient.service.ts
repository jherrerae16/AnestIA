import { prisma } from '../prisma';
import type { FormAnswers } from '@anestia/shared';

/**
 * Upsert de Patient a partir de las respuestas del formulario (US-1.7 / RF-11.2).
 * Mapeo por order del preset base: P1 nombre, P2 documento, P3 nacimiento, P4 sexo,
 * P7 teléfono, P8 aseguradora, P11 grupo sanguíneo. Idempotente por (anesthesiologistId, documentId).
 */
export async function upsertFromForm(
  anesthesiologistId: string,
  answers: FormAnswers,
): Promise<string | null> {
  const get = (order: number) => answers[String(order)]?.value;
  const documentId = str(get(2));
  const fullName = str(get(1));
  if (!documentId || !fullName) return null; // sin identificación no se crea paciente

  const sexRaw = str(get(4)).toLowerCase();
  const sex =
    sexRaw.startsWith('masc') ? 'MASCULINO' : sexRaw.startsWith('feme') ? 'FEMENINO' : sexRaw ? 'OTRO' : null;
  const birth = str(get(3));
  const birthDate = birth ? new Date(birth) : null;

  const patient = await prisma.patient.upsert({
    where: { anesthesiologistId_documentId: { anesthesiologistId, documentId } },
    update: {
      fullName,
      phone: str(get(7)) || undefined,
      insurer: str(get(8)) || undefined,
      bloodType: str(get(11)) || undefined,
      ...(sex ? { sex } : {}),
      ...(birthDate && !isNaN(birthDate.getTime()) ? { birthDate } : {}),
    },
    create: {
      anesthesiologistId,
      documentId,
      fullName,
      phone: str(get(7)) || null,
      insurer: str(get(8)) || null,
      bloodType: str(get(11)) || null,
      sex: (sex ?? undefined) as never,
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
