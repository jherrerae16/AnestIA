import { PrismaClient, type FuenteDato, type Obligacion } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import {
  QUESTION_DICTIONARY,
  validateDictionary,
  type DictQuestion,
} from '../packages/shared/src/dictionary/index';

const prisma = new PrismaClient();

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

const SEED_EMAIL = 'jherrerae16@gmail.com';

/**
 * El cuestionario se materializa desde `QUESTION_DICTIONARY` — la Especificación de Datos
 * Mínimos del Dr. Luquetta. Este archivo YA NO define preguntas: antes había tres copias
 * sincronizadas a mano del mismo diccionario (aquí, en el bloque `PREGUNTAS` del prompt
 * clínico y en `docs/form-mapping.md`) y se desincronizaban. Ahora hay una sola fuente.
 */

async function main() {
  // --- Password de Luquetta (SECURITY-12: sin credencial en repo) ---
  let plain = process.env.SEED_ADMIN_PASSWORD?.trim();
  let generated = false;
  if (!plain) {
    plain = randomBytes(12).toString('base64url');
    generated = true;
  }
  const passwordHash = await argon2.hash(plain, { type: argon2.argon2id });

  // --- Anesthesiologist "Luquetta" (idempotente por email) ---
  const luquetta = await prisma.anesthesiologist.upsert({
    where: { email: SEED_EMAIL },
    update: { passwordHash },
    create: {
      email: SEED_EMAIL,
      fullName: 'Dr. Jorge A. Luquetta',
      specialty: 'Anestesiología Cardiovascular',
      medicalRegistry: 'PENDIENTE',
      clinicLogoUrl: '/branding/logo-placeholder.svg',
      signatureUrl: '/branding/firma-placeholder.svg',
      footerText: 'Clínica Portoazul — Barranquilla',
      passwordHash,
    },
  });

  // --- Preset base "Preanestésica general" (idempotente por owner+name) ---
  let preset = await prisma.questionnairePreset.findFirst({
    where: { ownerId: luquetta.id, name: 'Preanestésica general' },
  });
  if (!preset) {
    preset = await prisma.questionnairePreset.create({
      data: { ownerId: luquetta.id, name: 'Preanestésica general', version: 1, isDefault: true },
    });
  }

  // --- Preguntas del diccionario (idempotente: borra y recrea para el preset base) ---
  // Se valida ANTES de escribir: un diccionario con un código duplicado o una regla que
  // referencia un código inexistente produce ramas que nunca se abren y fuentes equivocadas
  // en el documento. Fallar aquí es barato; fallar en un documento firmado no lo es.
  const errores = validateDictionary();
  if (errores.length > 0) {
    throw new Error(`Diccionario inválido, no se siembra:\n- ${errores.join('\n- ')}`);
  }

  await prisma.question.deleteMany({ where: { presetId: preset.id } });
  for (const q of QUESTION_DICTIONARY) {
    await prisma.question.create({
      data: {
        presetId: preset.id,
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

  const count = await prisma.question.count({ where: { presetId: preset.id } });
  console.log(`✔ Seed completo: ${luquetta.fullName} <${luquetta.email}>`);
  console.log(`✔ Preset "${preset.name}" con ${count} preguntas.`);
  if (generated) {
    console.log('\n================ CONTRASEÑA GENERADA (guárdala, se muestra UNA vez) ================');
    console.log(`  Email:      ${SEED_EMAIL}`);
    console.log(`  Contraseña: ${plain}`);
    console.log('  (Para fijarla tú, define SEED_ADMIN_PASSWORD en .env y re-siembra.)');
    console.log('====================================================================================\n');
  } else {
    console.log(`✔ Contraseña tomada de SEED_ADMIN_PASSWORD para ${SEED_EMAIL}.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
