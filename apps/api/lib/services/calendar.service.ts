import { CaseStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { bogotaParts, pureDateISO, pureDayUTC } from '../tz';
import { buildSurgeryIcs, icsFilename } from '../ics';

/**
 * Servicio del calendario de cirugías. Hace visible información que YA existe
 * (Case.procedureDate = pregunta 10 del formulario). No inventa nada.
 *
 * Aislamiento por perfil: todo consulta con `anesthesiologistId` en el where — cada
 * anestesiólogo ve sólo sus cirugías.
 */

const HORAS_48 = 48 * 60 * 60 * 1000;

/** Estados en los que la valoración ya no está "pendiente" para efectos de la alerta <48h. */
const ESTADOS_LISTOS = new Set<string>([CaseStatus.APROBADO, CaseStatus.ENTREGADO]);

export interface CalendarCase {
  caseId: string;
  patientName: string | null;
  procedure: string | null;
  status: string;
  /** Fecha de cirugía en ISO corto (YYYY-MM-DD, día de Bogotá) para agrupar por día. */
  date: string;
  procedureDate: string; // ISO completo (por si el cliente lo necesita)
  /** true = cirugía en <48h y valoración aún no aprobada → trabajo pendiente que el médico debe ver. */
  alerta48h: boolean;
}

/**
 * Regla de alerta (cálculo, no dato inventado): la cirugía es en menos de 48h y el caso
 * todavía no está aprobado/entregado. Función pura para poder probarla sin BD.
 */
export function is48hAlert(procedureDate: Date, status: string, now: Date): boolean {
  if (ESTADOS_LISTOS.has(status)) return false;
  const diff = procedureDate.getTime() - now.getTime();
  // Dentro de la ventana de 48h hacia adelante (no cuenta las ya pasadas hace mucho).
  return diff <= HORAS_48 && diff >= -HORAS_48;
}

/**
 * Cirugías con fecha dentro de un rango [from, to). Los casos sin `procedureDate` no
 * aparecen (no hay nada que ubicar en el calendario).
 */
export async function listCasesForCalendar(
  anesthesiologistId: string,
  range: { from: Date; to: Date },
  now: Date,
): Promise<CalendarCase[]> {
  const cases = await prisma.case.findMany({
    where: {
      anesthesiologistId,
      procedureDate: { gte: range.from, lt: range.to },
    },
    select: {
      id: true,
      status: true,
      procedure: true,
      procedureDate: true,
      patient: { select: { fullName: true } },
    },
    orderBy: { procedureDate: 'asc' },
  });

  return cases
    .filter((c): c is typeof c & { procedureDate: Date } => c.procedureDate != null)
    .map((c) => ({
      caseId: c.id,
      patientName: c.patient?.fullName ?? null,
      procedure: c.procedure,
      status: c.status,
      // procedureDate es fecha pura (all-day): se agrupa por su día UTC tal cual, sin
      // desplazar a Bogotá (desplazarla correría la cirugía un día).
      date: pureDateISO(c.procedureDate),
      procedureDate: c.procedureDate.toISOString(),
      alerta48h: is48hAlert(c.procedureDate, c.status, now),
    }));
}

/**
 * Cirugías de hoy y mañana (día de Bogotá) para el recordatorio matutino. Marca las que
 * son en <48h sin aprobar. Devuelve listas separadas para armar el correo.
 */
export async function casesForDailyReminder(
  anesthesiologistId: string,
  now: Date,
): Promise<{ hoy: CalendarCase[]; manana: CalendarCase[]; hayPendientes48h: boolean }> {
  // "Hoy" es el día natural del médico en Bogotá; la cirugía se guarda como fecha pura (día
  // UTC). Se toma la fecha de Bogotá de `now` y se arma el rango sobre esos mismos números de
  // día en UTC — así la cirugía del 1 aparece el 1, sin corrimiento de zona.
  const b = bogotaParts(now);
  const dia0 = new Date(Date.UTC(b.year, b.month - 1, b.day));
  const hoyRange = { from: dia0, to: pureDayUTC(dia0, 1) };
  const mananaRange = { from: pureDayUTC(dia0, 1), to: pureDayUTC(dia0, 2) };

  const [hoy, manana] = await Promise.all([
    listCasesForCalendar(anesthesiologistId, hoyRange, now),
    listCasesForCalendar(anesthesiologistId, mananaRange, now),
  ]);

  const hayPendientes48h = [...hoy, ...manana].some((c) => c.alerta48h);
  return { hoy, manana, hayPendientes48h };
}

/**
 * Genera el .ics de una cirugía. Verifica propiedad del caso (aislamiento por perfil):
 * un anestesiólogo no puede descargar el evento de un caso ajeno.
 */
export async function buildIcsForCase(
  anesthesiologistId: string,
  caseId: string,
  origin: string,
  now: Date,
): Promise<{ filename: string; content: string } | null> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, anesthesiologistId },
    select: {
      id: true,
      procedure: true,
      procedureDate: true,
      patient: { select: { fullName: true, insurer: true } },
    },
  });
  if (!kase || !kase.procedureDate) return null; // ajeno o sin fecha → no hay evento

  const patientName = kase.patient?.fullName ?? 'Paciente';
  const content = buildSurgeryIcs({
    caseId: kase.id,
    patientName,
    procedure: kase.procedure,
    insurer: kase.patient?.insurer ?? null,
    date: kase.procedureDate,
    caseUrl: `${origin}/cases/${kase.id}/review`,
    now,
  });
  return { filename: icsFilename(patientName), content };
}
