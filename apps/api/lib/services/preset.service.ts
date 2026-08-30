import { prisma } from '../prisma';
import {
  propiaAQuestionDef,
  validarPropias,
  type PreguntaPropia,
  type PresetDef,
} from '@anestia/shared';

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
        create: def.questions.map(toQuestionRow),
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
          create: def.questions.map(toQuestionRow),
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
        create: def.questions.map(toQuestionRow),
      },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
}

/**
 * `QuestionDef` (contrato compartido) → fila de `Question`. Un solo sitio: antes este mapeo
 * estaba copiado en las tres rutas de escritura del servicio y era donde se perdían campos.
 */
function toQuestionRow(q: PresetDef['questions'][number]) {
  return {
    code: q.code,
    order: q.order,
    label: q.label,
    type: q.type,
    required: q.required ?? false,
    obligacion: OBLIGACION[q.obligacion ?? 'C'],
    seccion: q.seccion ?? null,
    grupo: q.grupo ?? null,
    modulo: q.modulo ?? null,
    ayuda: q.ayuda ?? null,
    alimenta: q.alimenta ?? [],
    repiteSobre: q.repiteSobre ?? null,
    campos: (q.campos ?? undefined) as never,
    validacion: (q.validacion ?? undefined) as never,
    options: (q.options ?? undefined) as never,
    conditional: (q.conditional ?? undefined) as never,
  };
}

const OBLIGACION = {
  O: 'OBLIGATORIA',
  C: 'CONDICIONAL',
  S: 'SISTEMA',
  V: 'VERIFICA',
} as const;

/** Las preguntas propias del anestesiólogo en un preset suyo. */
export async function listPropias(anesthesiologistId: string, presetId: string) {
  const preset = await prisma.questionnairePreset.findFirst({
    where: { id: presetId, ownerId: anesthesiologistId },
    select: { id: true },
  });
  if (!preset) return null;
  return prisma.question.findMany({
    where: { presetId, origen: 'PROPIA' },
    orderBy: { order: 'asc' },
  });
}

/**
 * Reemplaza las preguntas propias de un preset.
 *
 * **Sólo toca filas `PROPIA`.** Las del diccionario no se leen, no se borran y no se reescriben:
 * la garantía de que una pantalla no puede corromper la Especificación del Dr. es el `where` de
 * este `deleteMany`, no la disciplina de quien llame. De ellas dependen el prompt clínico, la
 * trazabilidad por código y las variables de las ocho escalas.
 *
 * Tampoco versiona el preset. Una pregunta propia es informativa y no cambia el significado de
 * ninguna respuesta anterior: los casos ya enviados conservan las suyas, y los que estén a medias
 * simplemente ven la pregunta nueva.
 */
export async function savePropias(
  anesthesiologistId: string,
  presetId: string,
  propias: PreguntaPropia[],
): Promise<{ errores: string[]; guardadas: number }> {
  const preset = await prisma.questionnairePreset.findFirst({
    where: { id: presetId, ownerId: anesthesiologistId },
    select: { id: true },
  });
  if (!preset) return { errores: ['El cuestionario no existe o no es tuyo.'], guardadas: 0 };

  const errores = validarPropias(propias);
  if (errores.length > 0) return { errores, guardadas: 0 };

  await prisma.$transaction([
    prisma.question.deleteMany({ where: { presetId, origen: 'PROPIA' } }),
    prisma.question.createMany({
      data: propias.map((q, i) => {
        const def = propiaAQuestionDef(q, i);
        return {
          presetId,
          origen: 'PROPIA' as const,
          code: def.code,
          order: def.order,
          label: def.label,
          type: def.type as never,
          required: def.required,
          obligacion: 'CONDICIONAL' as const,
          fuente: 'PACIENTE' as const,
          ayuda: def.ayuda,
          alimenta: [],
          options: (def.options ?? undefined) as never,
        };
      }),
    }),
  ]);

  return { errores: [], guardadas: propias.length };
}
