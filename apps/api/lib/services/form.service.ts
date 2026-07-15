import { prisma } from '../prisma';
import { publish } from '../queue';
import { logAudit } from '../audit';
import { upsertFromForm } from './patient.service';
import {
  CONSENT_VERSION,
  formAnswersSchema,
  validateAnswers,
  questionSchema,
  type FormAnswers,
  type QuestionDef,
} from '@anestia/shared';

/** Carga el formulario por caso (preset + preguntas + respuestas parciales + consentimiento). */
export async function getFormForCase(caseId: string) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      preset: { include: { questions: { orderBy: { order: 'asc' } } } },
      formResponse: true,
      consent: true,
      anesthesiologist: { select: { fullName: true, clinicLogoUrl: true } },
    },
  });
  if (!kase) return null;
  return {
    caseId: kase.id,
    branding: { logo: kase.anesthesiologist.clinicLogoUrl, doctor: kase.anesthesiologist.fullName },
    questions: kase.preset?.questions ?? [],
    answers: (kase.formResponse?.answers as FormAnswers) ?? {},
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
  const answers = formAnswersSchema.parse(rawAnswers);
  await prisma.formResponse.upsert({
    where: { caseId },
    update: { answers: answers as never, partial: true },
    create: { caseId, answers: answers as never, partial: true },
  });
  await prisma.case.update({ where: { id: caseId }, data: { status: 'RESPONDIENDO' } });
}

/**
 * Submit: exige consentimiento, valida completitud contra el preset (condicionales incluidas),
 * persiste en transacción, upserta el paciente y emite `form.submitted` (una sola vez, idempotente).
 */
export async function submitForm(caseId: string, rawAnswers: unknown): Promise<{ errors?: string[] }> {
  const answers = formAnswersSchema.parse(rawAnswers);

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      preset: { include: { questions: { orderBy: { order: 'asc' } } } },
      formResponse: true,
      consent: true,
    },
  });
  if (!kase) return { errors: ['Caso no encontrado.'] };

  // Idempotencia: ya enviado → no re-dispara.
  if (kase.formResponse?.submittedAt) return {};

  if (!kase.consent) return { errors: ['Debes aceptar el consentimiento antes de enviar.'] };

  // Validación de completitud contra el preset (por order → Answer).
  const byOrder: Record<number, { value: unknown }> = {};
  for (const [k, v] of Object.entries(answers)) byOrder[Number(k)] = { value: v.value };
  const questions: QuestionDef[] = (kase.preset?.questions ?? []).map((q) =>
    questionSchema.parse({
      order: q.order,
      label: q.label,
      type: q.type,
      required: q.required,
      options: q.options ?? undefined,
      conditional: q.conditional ?? undefined,
    }),
  );
  const errors = validateAnswers(questions, byOrder as never);
  if (errors.length) return { errors };

  const anesthesiologistId = kase.anesthesiologistId;

  await prisma.$transaction(async (tx) => {
    await tx.formResponse.upsert({
      where: { caseId },
      update: { answers: answers as never, partial: false, submittedAt: new Date() },
      create: { caseId, answers: answers as never, partial: false, submittedAt: new Date() },
    });
    await tx.case.update({ where: { id: caseId }, data: { status: 'RESPUESTAS_RECIBIDAS' } });
  });

  // Upsert paciente + vincular al caso (fuera de la tx para no bloquear; idempotente).
  const patientId = await upsertFromForm(anesthesiologistId, answers);
  if (patientId) {
    await prisma.case.update({ where: { id: caseId }, data: { patientId } });
  }

  await logAudit({ action: 'form.submitted', entity: 'Case', entityId: caseId });
  await publish('form.submitted', { caseId });

  return {};
}
