import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { sembrarPresetBase, NOMBRE_PRESET_BASE } from './sembrar-preset';

const prisma = new PrismaClient();

const SEED_EMAIL = 'jherrerae16@gmail.com';

/**
 * El cuestionario se materializa desde `QUESTION_DICTIONARY` — la Especificación de Datos
 * Mínimos del Dr. Luquetta. Este archivo YA NO define preguntas: antes había tres copias
 * sincronizadas a mano del mismo diccionario (aquí, en el bloque `PREGUNTAS` del prompt
 * clínico y en `docs/form-mapping.md`) y se desincronizaban. Ahora hay una sola fuente, y el
 * mapeo diccionario→fila vive en `sembrar-preset.ts` porque también lo usa el alta de un
 * anestesiólogo nuevo.
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

  // --- Preset base con los 134 ítems del diccionario ---
  const { preguntas } = await sembrarPresetBase(prisma, luquetta.id);

  console.log(`✔ Seed completo: ${luquetta.fullName} <${luquetta.email}>`);
  console.log(`✔ Preset "${NOMBRE_PRESET_BASE}" con ${preguntas} preguntas.`);
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
