import { PrismaClient, QuestionType } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const SEED_EMAIL = 'jherrerae16@gmail.com';

/**
 * Las 28 preguntas del preset base "Preanestésica general" (docs/form-mapping.md / Anexo A).
 * order = número de pregunta. conditional/options en JSON.
 */
// Patologías del Google Form real del doctor (SELECCION_MULTIPLE).
const PATOLOGIAS = [
  'Hipertensión arterial', 'Diabetes mellitus', 'Hipotiroidismo', 'Hipertiroidismo',
  'Arritmia cardiaca', 'Infarto de miocardio', 'EPOC', 'Asma', 'Hipertensión pulmonar',
  'Apnea del sueño', 'Litiasis renal', 'Infección renal a repetición', 'Insuficiencia renal',
  'Gastritis', 'Migraña', 'Enfermedades articulares', 'Otra',
];

const GRUPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

type QDef = {
  order: number;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: unknown;
  conditional?: unknown;
};

/**
 * Preguntas EXACTAS del Google Form del Dr. Luquetta. Todas requeridas.
 * Condicionales (showIf): patologías (P12=Sí), medicamentos (P14), alergias (P16),
 * cirugías (P18), cigarrillos (P22), frecuencia de alcohol (P24), sustancias (P26).
 * El correo (P28) lo agrega la plataforma para registrar/contactar al paciente.
 */
const QUESTIONS: QDef[] = [
  { order: 1, label: 'Nombre completo', type: 'TEXTO_CORTO', required: true },
  { order: 2, label: 'Número de documento de identificación', type: 'TEXTO_CORTO', required: true },
  { order: 3, label: 'Fecha de nacimiento', type: 'FECHA', required: true },
  { order: 4, label: 'Sexo', type: 'SELECCION_UNICA', required: true, options: ['Hombre', 'Mujer', 'Prefiero no decirlo'] },
  { order: 5, label: 'Peso (kg)', type: 'NUMERO', required: true },
  { order: 6, label: 'Estatura (cm)', type: 'NUMERO', required: true },
  { order: 7, label: 'Teléfono de contacto', type: 'TEXTO_CORTO', required: true },
  { order: 8, label: 'Entidad aseguradora', type: 'SELECCION_UNICA', required: true, options: ['Particular', 'Otra'] },
  { order: 9, label: 'Cirugía o procedimiento que le van a realizar', type: 'TEXTO_CORTO', required: true },
  { order: 10, label: 'Fecha de cirugía o procedimiento', type: 'FECHA', required: true },
  { order: 11, label: 'Grupo sanguíneo', type: 'SELECCION_UNICA', required: true, options: GRUPOS_SANGUINEOS },
  { order: 12, label: '¿Sufre de alguna enfermedad?', type: 'SI_NO', required: true },
  {
    order: 13, label: 'Seleccione una o varias de las siguientes patologías según su caso',
    type: 'SELECCION_MULTIPLE', required: true, options: PATOLOGIAS,
    conditional: { showIf: { questionOrder: 12, equals: 'si' } },
  },
  { order: 14, label: '¿Está en tratamiento o utiliza algún medicamento actualmente?', type: 'SI_NO', required: true },
  {
    order: 15, label: '¿Cuáles medicamentos? (especifique)', type: 'TEXTO_CORTO', required: true,
    conditional: { showIf: { questionOrder: 14, equals: 'si' } },
  },
  { order: 16, label: '¿Es alérgico a algún medicamento o sustancia?', type: 'SI_NO', required: true },
  {
    order: 17, label: '¿A qué es alérgico? (especifique)', type: 'TEXTO_CORTO', required: true,
    conditional: { showIf: { questionOrder: 16, equals: 'si' } },
  },
  { order: 18, label: '¿Le han realizado alguna cirugía o procedimiento bajo anestesia previamente?', type: 'SI_NO', required: true },
  {
    order: 19, label: '¿Cuáles cirugías o procedimientos? (especifique)', type: 'TEXTO_CORTO', required: true,
    conditional: { showIf: { questionOrder: 18, equals: 'si' } },
  },
  { order: 20, label: '¿Le han realizado alguna transfusión sanguínea?', type: 'SI_NO', required: true },
  { order: 21, label: '¿Utiliza prótesis dental o tiene diseño de sonrisa?', type: 'SI_NO', required: true },
  { order: 22, label: '¿Fuma o utiliza vapeadores actualmente?', type: 'SI_NO', required: true },
  {
    order: 23, label: '¿Cuántos cigarrillos fuma o cuántas veces usa el vapeador al día? (especifique)',
    type: 'TEXTO_CORTO', required: true,
    conditional: { showIf: { questionOrder: 22, equals: 'si' } },
  },
  { order: 24, label: '¿Consume alcohol?', type: 'SI_NO', required: true },
  {
    order: 25, label: '¿Cuántas veces a la semana consume alcohol? (especifique)',
    type: 'TEXTO_CORTO', required: true,
    conditional: { showIf: { questionOrder: 24, equals: 'si' } },
  },
  { order: 26, label: '¿Consume alguna sustancia psicoactiva?', type: 'SI_NO', required: true },
  {
    order: 27, label: '¿Cuáles sustancias psicoactivas? (especifique)',
    type: 'TEXTO_CORTO', required: true,
    conditional: { showIf: { questionOrder: 26, equals: 'si' } },
  },
  { order: 28, label: 'Correo electrónico', type: 'TEXTO_CORTO', required: true },
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

  // --- 28 preguntas (idempotente: borra y recrea para el preset base) ---
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
