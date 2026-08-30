import { PrismaClient, type FuenteDato, type Obligacion } from '@prisma/client';
import {
  QUESTION_DICTIONARY,
  validateDictionary,
  type DictQuestion,
} from '../packages/shared/src/dictionary/index';

/**
 * Materializa el cuestionario de la Especificación para un anestesiólogo.
 *
 * Vive aparte del seed porque lo usan dos: la siembra inicial y el alta de un anestesiólogo
 * nuevo. Duplicar el mapeo diccionario→fila garantizaba que se separaran, y lo que se separaría
 * es qué preguntas ve cada médico — que es justo la clase de desincronización silenciosa que
 * este proyecto lleva toda la sesión persiguiendo.
 */

/** Códigos de obligatoriedad de la spec → enum de la BD. */
const OBLIGACION: Record<DictQuestion['obligacion'], Obligacion> = {
  O: 'OBLIGATORIA',
  C: 'CONDICIONAL',
  S: 'SISTEMA',
  V: 'VERIFICA',
};

/** Origen del dato de la spec (P/S/D/C) → enum de la BD. */
const FUENTE: Record<DictQuestion['fuente'], FuenteDato> = {
  P: 'PACIENTE',
  S: 'SISTEMA',
  D: 'DOCUMENTO',
  C: 'CLINICO',
};

export const NOMBRE_PRESET_BASE = 'Preanestésica general';

/**
 * Crea (o repuebla) el preset base de un anestesiólogo con los 134 ítems del diccionario.
 *
 * Idempotente por dueño y nombre. **Solo toca filas del diccionario**: las preguntas propias
 * del médico (`origen: 'PROPIA'`) se conservan, así que re-sembrar no le borra las suyas.
 */
export async function sembrarPresetBase(
  prisma: PrismaClient,
  ownerId: string,
): Promise<{ presetId: string; preguntas: number }> {
  // Se valida ANTES de escribir: un diccionario con un código duplicado o una regla que
  // referencia un código inexistente produce ramas que nunca se abren y fuentes equivocadas
  // en el documento. Fallar aquí es barato; fallar en un documento firmado no lo es.
  const errores = validateDictionary();
  if (errores.length > 0) {
    throw new Error(`Diccionario inválido, no se siembra:\n- ${errores.join('\n- ')}`);
  }

  let preset = await prisma.questionnairePreset.findFirst({
    where: { ownerId, name: NOMBRE_PRESET_BASE },
  });
  if (!preset) {
    preset = await prisma.questionnairePreset.create({
      data: { ownerId, name: NOMBRE_PRESET_BASE, version: 1, isDefault: true },
    });
  }

  await prisma.question.deleteMany({ where: { presetId: preset.id, origen: 'DICCIONARIO' } });
  for (const q of QUESTION_DICTIONARY) {
    await prisma.question.create({
      data: {
        presetId: preset.id,
        origen: 'DICCIONARIO',
        code: q.code,
        order: q.order,
        label: q.label,
        type: q.type,
        // Solo lo obligatorio para continuar bloquea el envío. Lo condicional se vuelve
        // obligatorio únicamente cuando su rama está abierta (lo resuelve `validateAnswers`).
        required: q.obligacion === 'O',
        obligacion: OBLIGACION[q.obligacion],
        fuente: FUENTE[q.fuente],
        seccion: q.seccion,
        grupo: q.grupo ?? null,
        modulo: q.modulo ?? null,
        ayuda: q.ayuda ?? null,
        alimenta: [...(q.alimenta ?? [])],
        repiteSobre: q.repiteSobre ?? null,
        campos: (q.campos ?? undefined) as never,
        validacion: (q.validacion ?? undefined) as never,
        options: (q.opciones ?? undefined) as never,
        conditional: (q.activacion ?? undefined) as never,
      },
    });
  }

  const preguntas = await prisma.question.count({ where: { presetId: preset.id } });
  return { presetId: preset.id, preguntas };
}
