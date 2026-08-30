import type { CaseSchedule } from '@prisma/client';
import { CaseStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { publish } from '../queue';
import { logAudit } from '../audit';
import { upsertFromForm } from './patient.service';
import {
  CONSENT_VERSION,
  formAnswersSchema,
  validateAnswers,
  questionSchema,
  medicalTerm,
  type FormAnswers,
  type QuestionDef,
  CODES,
  buildFacts,
  pruneHiddenAnswers,
} from '@anestia/shared';

/** Carga el formulario por caso (preset + preguntas + respuestas parciales + consentimiento). */
export async function getFormForCase(caseId: string) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      preset: { include: { questions: { orderBy: { order: 'asc' } } } },
      schedule: true,
      formResponse: true,
      consent: true,
      anesthesiologist: { select: { fullName: true, clinicLogoUrl: true } },
    },
  });
  if (!kase) return null;
  // Los datos de AGENDA no se le envían al paciente: la Especificación es explícita en que no
  // decide si su cirugía es de alto riesgo, cuánto dura ni qué incisión tendrá. El filtro va
  // por FUENTE, no por obligatoriedad: PX10/PX11 vienen de la agenda pero los verifica el
  // anestesiólogo (obligacion V), así que un filtro por `obligacion !== SISTEMA` los dejaba pasar.
  const questions = (kase.preset?.questions ?? []).filter((q) => q.fuente === 'PACIENTE');
  return {
    caseId: kase.id,
    branding: { logo: kase.anesthesiologist.clinicLogoUrl, doctor: kase.anesthesiologist.fullName },
    questions,
    answers: (kase.formResponse?.answers as FormAnswers) ?? {},
    // La edad y, con ella, la ruta clínica se derivan contra la fecha del procedimiento.
    procedureDate: kase.procedureDate ? kase.procedureDate.toISOString().slice(0, 10) : null,
    // Atributos de la agenda. NO son preguntas: son los hechos con los que el formulario decide
    // qué ramas abrir (Caprini por cirugía mayor, DASI por sitio quirúrgico elevado…).
    schedule: scheduleFactsDe(kase.schedule),
    consentAccepted: Boolean(kase.consent),
    submitted: Boolean(kase.formResponse?.submittedAt),
  };
}

/** Acepta el consentimiento Ley 1581 (idempotente por caso). */
export async function acceptConsent(caseId: string): Promise<void> {
  const existing = await prisma.consent.findUnique({ where: { caseId } });
  if (existing) return;
  await prisma.consent.create({ data: { caseId, textVersion: CONSENT_VERSION } });
  await logAudit({ action: 'consent.accepted', entity: 'Case', entityId: caseId, meta: { version: CONSENT_VERSION } });
}

/** Guardado parcial: valida forma, persiste partial=true. NO emite evento. */
export async function savePartial(caseId: string, rawAnswers: unknown): Promise<void> {
  let answers = formAnswersSchema.parse(rawAnswers);

  // Tras enviar, el autosave NO puede pisar las respuestas. El token del formulario sigue
  // vivo 7 días, así que una pestaña abierta puede disparar un save mientras el worker ya
  // está leyendo las respuestas: sobrescribirlas (partial=true) es una carrera contra el
  // pipeline y además revierte el estado a RESPONDIENDO. Una vez enviado, es inmutable.
  const fr = await prisma.formResponse.findUnique({ where: { caseId }, select: { submittedAt: true } });
  if (fr?.submittedAt) return;

  await prisma.formResponse.upsert({
    where: { caseId },
    update: { answers: answers as never, partial: true },
    create: { caseId, answers: answers as never, partial: true },
  });
  await prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.RESPONDIENDO } });
}

/** Primer valor de una respuesta como texto plano, o null si no hay. */
function answerText(answers: FormAnswers, order: string): string | null {
  const v = answers[order]?.value;
  if (v == null || v === '') return null;
  const s = Array.isArray(v) ? v.join(', ') : String(v);
  return s.trim() === '' ? null : s;
}

/**
 * Procedimiento y fecha del caso desde el formulario (P9 y P10). El panel los lee de
 * `Case`, no del documento, así que sin esto las columnas salen vacías.
 * Sólo se rellenan si están vacíos: lo que escribió el anestesiólogo al crear el caso manda.
 */
function procedureFromAnswers(
  answers: FormAnswers,
  kase: { procedure: string | null; procedureDate: Date | null },
): { procedure?: string; procedureDate?: Date } {
  const out: { procedure?: string; procedureDate?: Date } = {};

  if (!kase.procedure) {
    // Mismo término médico que usa el documento ('lipo' → 'Liposucción'), para que el
    // panel y el PDF no muestren textos distintos del mismo procedimiento.
    const p = medicalTerm(answerText(answers, CODES.procedimiento));
    if (p) out.procedure = p;
  }

  if (!kase.procedureDate) {
    const raw = answerText(answers, CODES.fechaProcedimiento);
    const d = raw ? new Date(raw) : null;
    if (d && !isNaN(d.getTime())) out.procedureDate = d;
  }

  return out;
}

/**
 * Submit: exige consentimiento, valida completitud contra el preset (condicionales incluidas),
 * persiste en transacción, upserta el paciente y emite `form.submitted` (una sola vez, idempotente).
 */
export async function submitForm(caseId: string, rawAnswers: unknown): Promise<{ errors?: string[] }> {
  let answers = formAnswersSchema.parse(rawAnswers);

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      preset: { include: { questions: { orderBy: { order: 'asc' } } } },
      schedule: true,
      formResponse: true,
      consent: true,
    },
  });
  if (!kase) return { errors: ['Caso no encontrado.'] };

  // Idempotencia: ya enviado → no re-dispara.
  if (kase.formResponse?.submittedAt) return {};

  if (!kase.consent) return { errors: ['Debes aceptar el consentimiento antes de enviar.'] };

  // Validación contra el cuestionario: completitud, opciones válidas, "Ninguna" excluyente y
  // que ningún dato de agenda venga del formulario público. El adaptador `byOrder` que había
  // aquí desapareció: las respuestas ya vienen indexadas por código.
  const questions: QuestionDef[] = (kase.preset?.questions ?? []).map((q) =>
    questionSchema.parse({
      code: q.code,
      order: q.order,
      label: q.label,
      type: q.type,
      required: q.required,
      obligacion: OBLIGACION_A_CODIGO[q.obligacion],
      seccion: q.seccion ?? undefined,
      grupo: q.grupo ?? undefined,
      alimenta: q.alimenta ?? [],
      options: q.options ?? undefined,
      conditional: q.conditional ?? undefined,
    }),
  );

  // Los hechos derivados (edad, banda etaria, ruta) deciden qué ramas estaban abiertas. La
  // fecha de referencia es la del procedimiento, que viene de la agenda — no del paciente.
  const facts = buildFacts({
    answers,
    schedule: scheduleFactsDe(kase.schedule),
    refDateISO: kase.procedureDate ? kase.procedureDate.toISOString().slice(0, 10) : null,
  });

  // Se descartan las respuestas de ramas que quedaron cerradas. Sin esto, responder "Sí",
  // escribir el detalle y volver a "No" dejaba el detalle guardado y se enviaba igual.
  const limpias = pruneHiddenAnswers(
    questions.map((q) => ({ code: q.code, activacion: q.conditional ?? null })),
    answers,
    facts,
  );

  const errors = validateAnswers(questions, limpias, facts);
  if (errors.length) return { errors };
  answers = limpias;

  const anesthesiologistId = kase.anesthesiologistId;

  // Atómico: respuesta + upsert de paciente + vínculo + avance de estado en UNA transacción.
  // Evita el caso huérfano (estado avanzado sin paciente vinculado) — C1.
  await prisma.$transaction(async (tx) => {
    await tx.formResponse.upsert({
      where: { caseId },
      update: { answers: answers as never, partial: false, submittedAt: new Date() },
      create: { caseId, answers: answers as never, partial: false, submittedAt: new Date() },
    });
    const patientId = await upsertFromForm(anesthesiologistId, answers, tx);
    await tx.case.update({
      where: { id: caseId },
      data: {
        status: CaseStatus.RESPUESTAS_RECIBIDAS,
        ...(patientId ? { patientId } : {}),
        ...procedureFromAnswers(answers, kase),
      },
    });
  });

  await logAudit({ action: 'form.submitted', entity: 'Case', entityId: caseId });

  // Emitir el evento del pipeline DESPUÉS del commit.
  //
  // Si el publish falla, el caso queda en RESPUESTAS_RECIBIDAS con datos completos pero el
  // pipeline no arranca, y `submittedAt` impide un re-envío del paciente. Red de seguridad:
  // el reconciliador (reconciler.service.ts) corre al arrancar el worker, detecta estos casos
  // (enviados, sin assessment, en estado intermedio) y les re-emite `form.submitted`.
  try {
    await publish('form.submitted', { caseId });
  } catch (err) {
    await logAudit({
      action: 'form.submitted.publish_failed',
      entity: 'Case',
      entityId: caseId,
      meta: { error: err instanceof Error ? err.message : 'unknown' },
    });
  }

  return {};
}

/**
 * Fila de `CaseSchedule` → hechos de agenda. Se envían al formulario del paciente como HECHOS,
 * nunca como preguntas: el paciente no ve la programación, pero sus ramas dependen de ella.
 */
function scheduleFactsDe(s: CaseSchedule | null) {
  if (s == null) return null;
  return {
    especialidad: s.especialidad,
    modalidad: s.modalidad,
    prioridad: s.prioridad,
    sitioQuirurgico: s.sitioQuirurgico,
    duracionEstimada: s.duracionEstimada,
    altoRiesgoRcri: s.altoRiesgoRcri,
    opioidesPostop: s.opioidesPostop,
    anestesiaProbable: s.anestesiaProbable,
  };
}

/** Enum de la BD → código de obligatoriedad de la especificación. */
const OBLIGACION_A_CODIGO = {
  OBLIGATORIA: 'O',
  CONDICIONAL: 'C',
  SISTEMA: 'S',
  VERIFICA: 'V',
} as const;
