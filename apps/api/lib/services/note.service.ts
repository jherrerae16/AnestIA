import { prisma } from '../prisma';
import { logAudit } from '../audit';

/**
 * Notas privadas del anestesiólogo por paciente. Libreta personal del médico, separada del
 * documento clínico oficial: nunca entra al PDF, ni a la distribución, ni la ve el paciente.
 * No aplica la regla de no-fabricación (CS2) — es texto libre y subjetivo del médico, no un
 * dato clínico derivado.
 *
 * Aislamiento estricto: sólo el dueño (anesthesiologistId) accede. Se verifica además que el
 * paciente pertenezca a ese médico antes de crear la nota (no crear notas sobre pacientes ajenos).
 * Piloto: una nota única larga por paciente (unique compuesto), no feed cronológico.
 */

export interface PatientNoteDTO {
  content: string;
  updatedAt: string;
}

/** Nota del médico sobre un paciente, o null si no hay (o el paciente es de otro médico). */
export async function getNote(
  anesthesiologistId: string,
  patientId: string,
): Promise<PatientNoteDTO | null> {
  const note = await prisma.patientNote.findFirst({
    where: { patientId, anesthesiologistId },
    select: { content: true, updatedAt: true },
  });
  if (!note) return null;
  return { content: note.content, updatedAt: note.updatedAt.toISOString() };
}

/**
 * Crea/actualiza la nota. Content vacío → borra (la sección "desaparece sola"). El borrado
 * por vaciado se confirma en el cliente antes de llegar aquí.
 * Devuelve la nota resultante o null si se borró. Registra el cambio en el audit log.
 */
export async function upsertNote(
  anesthesiologistId: string,
  patientId: string,
  content: string,
): Promise<PatientNoteDTO | null> {
  // El paciente debe ser de este médico (aislamiento). findFirst con ambas claves.
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, anesthesiologistId },
    select: { id: true },
  });
  if (!patient) throw new NoteOwnershipError();

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    // Vaciar = borrar. deleteMany no falla si no existía.
    const del = await prisma.patientNote.deleteMany({ where: { patientId, anesthesiologistId } });
    if (del.count > 0) {
      await logAudit({
        actorId: anesthesiologistId,
        action: 'patient_note.deleted',
        entity: 'PatientNote',
        entityId: patientId,
      });
    }
    return null;
  }

  const note = await prisma.patientNote.upsert({
    where: { patientId_anesthesiologistId: { patientId, anesthesiologistId } },
    create: { patientId, anesthesiologistId, content: trimmed },
    update: { content: trimmed },
    select: { content: true, updatedAt: true },
  });
  await logAudit({
    actorId: anesthesiologistId,
    action: 'patient_note.updated',
    entity: 'PatientNote',
    entityId: patientId,
  });
  return { content: note.content, updatedAt: note.updatedAt.toISOString() };
}

/** Nota asociada a un caso (por su paciente), para mostrarla en la pantalla del caso. */
export async function getNoteForCase(
  anesthesiologistId: string,
  patientId: string | null,
): Promise<PatientNoteDTO | null> {
  if (!patientId) return null;
  return getNote(anesthesiologistId, patientId);
}

export class NoteOwnershipError extends Error {
  constructor() {
    super('El paciente no pertenece a este anestesiólogo.');
    this.name = 'NoteOwnershipError';
  }
}
