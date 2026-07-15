import { PrismaClient, QuestionType } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const SEED_EMAIL = 'jherrerae16@gmail.com';

/**
 * Las 22 preguntas del preset base "Preanestésica general" (docs/form-mapping.md / Anexo A).
 * order = número de pregunta. conditional/options en JSON.
 */
const PATOLOGIAS = [
  'HTA', 'Diabetes mellitus', 'Hipotiroidismo', 'Hipertiroidismo', 'Arritmia',
  'Infarto de miocardio', 'EPOC', 'Asma', 'Hipertensión pulmonar', 'Apnea del sueño',
  'Litiasis renal', 'Infección renal a repetición', 'Insuficiencia renal', 'Gastritis',
  'Migraña', 'Enfermedades articulares', 'Otra',
];

const GRUPOS_SANGUINEOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'No sé'];

type QDef = {
  order: number;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: unknown;
  conditional?: unknown;
};

const QUESTIONS: QDef[] = [
  { order: 1, label: 'Nombre completo', type: 'TEXTO_CORTO', required: true },
  { order: 2, label: 'Número de documento', type: 'TEXTO_CORTO', required: true },
  { order: 3, label: 'Fecha de nacimiento', type: 'FECHA', required: true },
  { order: 4, label: 'Sexo', type: 'SELECCION_UNICA', required: true, options: ['Masculino', 'Femenino', 'Otro'] },
  { order: 5, label: 'Peso (kg)', type: 'NUMERO', required: true },
  { order: 6, label: 'Estatura (cm)', type: 'NUMERO', required: true },
  { order: 7, label: 'Teléfono de contacto', type: 'TEXTO_CORTO' },
  { order: 8, label: 'Entidad aseguradora', type: 'TEXTO_CORTO' },
  { order: 9, label: 'Cirugía o procedimiento', type: 'TEXTO_CORTO', required: true },
  { order: 10, label: 'Fecha de cirugía', type: 'FECHA' },
  { order: 11, label: 'Grupo sanguíneo', type: 'SELECCION_UNICA', options: GRUPOS_SANGUINEOS },
  { order: 12, label: '¿Sufre alguna enfermedad?', type: 'SI_NO' },
  {
    order: 13, label: 'Patologías', type: 'SELECCION_MULTIPLE', options: PATOLOGIAS,
    conditional: { showIf: { questionOrder: 12, equals: 'si' } },
  },
  { order: 14, label: '¿Toma medicamentos? ¿Cuáles?', type: 'TEXTO_LARGO' },
  { order: 15, label: '¿Tiene alergias? ¿A qué?', type: 'TEXTO_LARGO' },
  { order: 16, label: '¿Cirugías o anestesias previas?', type: 'TEXTO_LARGO' },
  { order: 17, label: '¿Transfusiones previas? (detalle)', type: 'TEXTO_LARGO' },
  { order: 18, label: '¿Consume sustancias psicoactivas?', type: 'SI_NO' },
  { order: 19, label: '¿Consume alcohol?', type: 'SI_NO' },
  { order: 20, label: '¿Fuma o vapea?', type: 'SI_NO' },
  {
    order: 21, label: 'Cantidad de cigarrillos/vapeo por día', type: 'NUMERO',
    conditional: { showIf: { questionOrder: 20, equals: 'si' } },
  },
  { order: 22, label: '¿Usa prótesis dental o tiene diseño de sonrisa? (detalle)', type: 'TEXTO_LARGO' },
];

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
      clinicLogoUrl: '/branding/logo-placeholder.png',
      signatureUrl: '/branding/firma-placeholder.png',
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

  // --- 22 preguntas (idempotente: borra y recrea para el preset base) ---
  await prisma.question.deleteMany({ where: { presetId: preset.id } });
  for (const q of QUESTIONS) {
    await prisma.question.create({
      data: {
        presetId: preset.id,
        order: q.order,
        label: q.label,
        type: q.type,
        required: q.required ?? false,
        options: (q.options ?? undefined) as never,
        conditional: (q.conditional ?? undefined) as never,
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
