import {
  CODES,
  buildFacts,
  canonicalAnalyte,
  evaluarTodas,
  getNumber,
  parseNumeric,
  scheduleToFacts,
  type FormAnswers,
  type ScaleResult,
} from '@anestia/shared';
import { prisma } from '../prisma';
import { logAudit } from '../audit';

/**
 * Cálculo y persistencia de las ocho escalas de riesgo.
 *
 * Determinístico y sin IA: el motor clínico NUNCA las produce. Es el mismo patrón que ya usan
 * los paraclínicos —`clinical.service` los arma por código y sobrescribe lo que devolviera el
 * proveedor— y por la misma razón: un puntaje que firma el anestesiólogo no puede depender de
 * que un modelo lo recuerde bien.
 */

/**
 * Analitos que consumen las escalas. Las claves son las que produce `canonicalAnalyte`
 * ("Hemoglobina", no "hemoglobina"): normalizar por mi cuenta aquí fue justo el error que dejó
 * ARISCAT y RCRI pendientes con los laboratorios ya cargados.
 */
const ANALITOS_DE_ESCALA: Record<string, 'hemoglobina' | 'creatinina'> = {
  Hemoglobina: 'hemoglobina',
  Creatinina: 'creatinina',
};

/**
 * Laboratorios validados que alimentan escalas, indexados por analito canónico.
 *
 * Sólo entra lo que tiene valor numérico legible. Un resultado que el sistema no pudo parsear
 * (`rangeUnparsed`) NO se usa: dejar la escala pendiente es correcto; puntuar con un número
 * dudoso, no.
 */
async function labsDeEscala(caseId: string): Promise<Record<string, number | null>> {
  const filas = await prisma.extractedLabResult.findMany({
    where: {
      caseId,
      // Un resultado de baja confianza, sin unidad o sin archivo de procedencia NO alimenta una
      // escala: queda PENDIENTE_CONFIRMACION hasta que el médico lo revise. Dejar la escala
      // pendiente es correcto; puntuarla con un número dudoso, no (Especificación §15).
      estadoExtraccion: { not: 'PENDIENTE_CONFIRMACION' },
      // Y tampoco si el sistema no pudo leer el rango: ahí el flagging es ciego.
      rangeUnparsed: false,
    },
    orderBy: { reportDate: 'desc' },
  });
  const out: Record<string, number | null> = {};
  for (const f of filas) {
    const canon = canonicalAnalyte(f.analyte);
    const clave = canon ? ANALITOS_DE_ESCALA[canon] : undefined;
    if (!clave) continue;
    const n = parseNumeric(f.value);
    if (n == null) continue;
    // Con varios resultados del mismo analito, manda el primero que llega (ya vienen ordenados).
    if (out[clave] == null) out[clave] = n;
  }
  return out;
}

/**
 * Calcula las ocho escalas de un caso y las persiste.
 *
 * Idempotente: se puede re-correr tras editar la agenda o tras el examen presencial, y cada
 * escala se recalcula desde cero con los datos vigentes.
 */
export async function computeScalesForCase(caseId: string): Promise<ScaleResult[]> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { schedule: true, formResponse: true, assessment: true },
  });
  if (!kase) return [];

  const answers = (kase.formResponse?.answers as FormAnswers) ?? {};
  const refDateISO = kase.schedule?.fechaHora
    ? kase.schedule.fechaHora.toISOString().slice(0, 10)
    : kase.procedureDate?.toISOString().slice(0, 10) ?? null;

  const facts = buildFacts({
    answers,
    schedule: scheduleToFacts(
      kase.schedule
        ? {
            procedimiento: kase.schedule.procedimiento,
            especialidad: kase.schedule.especialidad,
            modalidad: kase.schedule.modalidad,
            prioridad: kase.schedule.prioridad,
            sitioQuirurgico: kase.schedule.sitioQuirurgico,
            duracionEstimada: kase.schedule.duracionEstimada,
            altoRiesgoRcri: kase.schedule.altoRiesgoRcri,
            anestesiaProbable: kase.schedule.anestesiaProbable,
            opioidesPostop: kase.schedule.opioidesPostop,
          }
        : null,
    ),
    refDateISO,
  });

  // SpO2 y circunferencia de cuello: SÓLO si el anestesiólogo las midió. La Especificación
  // prohíbe inferir la SpO2, y `resolve.ts` lo vuelve a comprobar (CS9) por si acaso.
  const medidos = extraerMediciones(kase.assessment?.fields);

  const resultados = evaluarTodas({
    answers,
    facts,
    labs: await labsDeEscala(caseId),
    spo2: medidos.spo2,
    cuelloMedido: medidos.cuello ?? getNumber(answers, CODES.cuello),
    procedimiento: kase.schedule?.procedimiento ?? kase.procedure ?? null,
  });

  await prisma.$transaction(
    resultados.map((r) =>
      prisma.scaleResult.upsert({
        where: { caseId_escala: { caseId, escala: r.escala } },
        update: {
          version: r.version, cortesVersion: r.cortesVersion, estado: r.estado,
          puntaje: r.puntaje, categoria: r.categoria,
          variables: r.variables as never, faltantes: r.faltantes, motivo: r.motivo,
          computedAt: new Date(),
        },
        create: {
          caseId, escala: r.escala, version: r.version, cortesVersion: r.cortesVersion,
          estado: r.estado, puntaje: r.puntaje, categoria: r.categoria,
          variables: r.variables as never, faltantes: r.faltantes, motivo: r.motivo,
        },
      }),
    ),
  );

  await logAudit({
    action: 'scales.computed',
    entity: 'Case',
    entityId: caseId,
    meta: {
      calculadas: resultados.filter((r) => r.estado === 'CALCULADA').map((r) => r.escala),
      pendientes: resultados.filter((r) => r.estado === 'PENDIENTE').map((r) => r.escala),
      revision: resultados.filter((r) => r.estado === 'REVISION_CLINICA').map((r) => r.escala),
    },
  });

  return resultados;
}

/**
 * Signos que sólo valen si los midió el anestesiólogo.
 *
 * Se leen del examen físico del documento, y únicamente cuando su `fuente` empieza por
 * `anestesiologo:`. Un valor en `estimado_ia` o derivado no cuenta: es exactamente el caso que
 * CS9 existe para impedir.
 */
export function extraerMediciones(fields: unknown): { spo2: number | null; cuello: number | null } {
  const vacio = { spo2: null, cuello: null };
  if (fields == null || typeof fields !== 'object') return vacio;
  const examen = (fields as Record<string, unknown>)['examen_fisico'];
  if (examen == null || typeof examen !== 'object') return vacio;

  const campo = (examen as Record<string, { valor?: string | null; estado?: string; fuente?: string | null }>)[
    'signos_vitales'
  ];
  // El examen manual se guarda con `fuente: 'anestesiologo'` y la atestación de normalidad con
  // `anestesiologo:examen-normal-confirmado`. Las dos son mediciones del clínico.
  if (campo?.estado !== 'ok' || !campo.fuente?.startsWith('anestesiologo')) return vacio;

  const texto = String(campo.valor ?? '');
  // Anclado al signo de porcentaje, que es el marcador fiable. Sin él, un patrón laxo se
  // atascaba en el "2" de "SatO2" y no encontraba la cifra. Cubre SpO2, SpO₂, SaO2, Sat y
  // "Saturación", con o sin dos puntos.
  const spo2 = texto.match(/(?:spo[₂2]|sao[₂2]|sat(?:uraci[oó]n)?(?:\s*o[₂2])?)\s*[:=]?\s*(\d{2,3})\s*%/i);
  const cuello = texto.match(/cuello\s*[:=]?\s*(\d{2,3})\s*cm/i);
  return {
    spo2: spo2?.[1] ? Number(spo2[1]) : null,
    cuello: cuello?.[1] ? Number(cuello[1]) : null,
  };
}

/** Escalas guardadas de un caso, en el orden de presentación. */
export async function getScalesForCase(caseId: string) {
  const filas = await prisma.scaleResult.findMany({ where: { caseId } });
  const orden = ['DASI', 'STOP_BANG', 'APFEL', 'FRAIL', 'CAPRINI', 'RCRI', 'ARISCAT', 'POVOC'];
  return filas.sort((a, b) => orden.indexOf(a.escala) - orden.indexOf(b.escala));
}
