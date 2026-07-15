import { prisma } from '../prisma';
import type { PresetDef } from '@anestia/shared';

/** Lista los presets del anesthesiologist. */
export function listPresets(anesthesiologistId: string) {
  return prisma.questionnairePreset.findMany({
    where: { ownerId: anesthesiologistId },
    include: { questions: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
}

export function getPreset(anesthesiologistId: string, id: string) {
  return prisma.questionnairePreset.findFirst({
    where: { id, ownerId: anesthesiologistId },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
}

/** Crea un preset con sus preguntas. */
export async function createPreset(anesthesiologistId: string, def: PresetDef) {
  return prisma.questionnairePreset.create({
    data: {
      ownerId: anesthesiologistId,
      name: def.name,
      version: 1,
      questions: {
        create: def.questions.map((q) => ({
          order: q.order,
          label: q.label,
          type: q.type,
          required: q.required ?? false,
          options: (q.options ?? undefined) as never,
          conditional: (q.conditional ?? undefined) as never,
        })),
      },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
}

/**
 * Actualiza un preset. Si ya tiene casos asociados, crea una NUEVA versión
 * (no rompe los casos enviados). Devuelve el preset resultante.
 */
export async function updatePreset(anesthesiologistId: string, id: string, def: PresetDef) {
  const existing = await prisma.questionnairePreset.findFirst({
    where: { id, ownerId: anesthesiologistId },
    include: { _count: { select: { cases: true } } },
  });
  if (!existing) return null;

  if (existing._count.cases > 0) {
    // Versionar: crear un preset nuevo con version+1, mismo nombre.
    return prisma.questionnairePreset.create({
      data: {
        ownerId: anesthesiologistId,
        name: def.name,
        version: existing.version + 1,
        isDefault: existing.isDefault,
        questions: {
          create: def.questions.map((q) => ({
            order: q.order,
            label: q.label,
            type: q.type,
            required: q.required ?? false,
            options: (q.options ?? undefined) as never,
            conditional: (q.conditional ?? undefined) as never,
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  }

  // Sin casos: editar en sitio (reemplaza preguntas).
  await prisma.question.deleteMany({ where: { presetId: id } });
  return prisma.questionnairePreset.update({
    where: { id },
    data: {
      name: def.name,
      questions: {
        create: def.questions.map((q) => ({
          order: q.order,
          label: q.label,
          type: q.type,
          required: q.required ?? false,
          options: (q.options ?? undefined) as never,
          conditional: (q.conditional ?? undefined) as never,
        })),
      },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
}
