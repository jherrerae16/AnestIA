import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { sembrarPresetBase, NOMBRE_PRESET_BASE } from './sembrar-preset';

/**
 * Alta manual de un anestesiólogo.
 *
 * No hay registro público a propósito: quién puede firmar una valoración preanestésica es una
 * decisión profesional, no un formulario. Este comando lo hace el dueño de la instalación.
 *
 *   npm run anestesiologo -- --email ana@clinica.co --nombre "Dra. Ana Restrepo"
 *
 * Opcionales: --especialidad, --registro (registro médico del bloque de firma), --password.
 * Sin `--password` se genera una y se imprime UNA vez.
 *
 * Crea también su propio cuestionario con los 134 ítems de la Especificación. Un perfil sin
 * preset no puede crear casos, y esa falla aparecería mucho después, al intentar usarlo.
 */

const prisma = new PrismaClient();

/** `--clave valor` → mapa. Sin dependencias: es un script de operación, no una CLI. */
function argumentos(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const clave = a.slice(2);
    const siguiente = argv[i + 1];
    if (siguiente && !siguiente.startsWith('--')) {
      out[clave] = siguiente;
      i++;
    } else {
      out[clave] = 'true';
    }
  }
  return out;
}

function salirConAyuda(motivo: string): never {
  console.error(`\n✖ ${motivo}\n`);
  console.error('Uso:');
  console.error('  npm run anestesiologo -- --email <correo> --nombre "<nombre completo>"');
  console.error('');
  console.error('Opcionales:');
  console.error('  --especialidad "Anestesiología cardiovascular"');
  console.error('  --registro "RM 12345"        registro médico, sale en el bloque de firma');
  console.error('  --password "<clave>"          si no se da, se genera y se muestra una vez');
  console.error('');
  process.exit(1);
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const email = (args['email'] ?? '').trim().toLowerCase();
  const nombre = (args['nombre'] ?? '').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) salirConAyuda('Falta un --email válido.');
  if (nombre.length < 3) salirConAyuda('Falta --nombre (el nombre completo del anestesiólogo).');

  const existente = await prisma.anesthesiologist.findUnique({ where: { email } });
  if (existente) {
    // No se pisa un perfil existente: cambiar la contraseña de alguien por escribir mal un
    // correo es un accidente caro y silencioso.
    salirConAyuda(`Ya existe un anestesiólogo con el correo ${email} (${existente.fullName}).`);
  }

  const password = args['password']?.trim() || randomBytes(12).toString('base64url');
  const generada = !args['password'];
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const medico = await prisma.anesthesiologist.create({
    data: {
      email,
      fullName: nombre,
      specialty: args['especialidad']?.trim() || null,
      // El registro médico sale impreso en el bloque de firma del PDF. Se marca PENDIENTE en vez
      // de dejarlo vacío: un documento firmado sin registro tiene que verse incompleto.
      medicalRegistry: args['registro']?.trim() || 'PENDIENTE',
      passwordHash,
    },
  });

  const { preguntas } = await sembrarPresetBase(prisma, medico.id);

  console.log(`\n✔ Anestesiólogo creado: ${medico.fullName} <${medico.email}>`);
  console.log(`✔ Cuestionario "${NOMBRE_PRESET_BASE}" con ${preguntas} preguntas.`);
  if (medico.medicalRegistry === 'PENDIENTE') {
    console.log('⚠ Registro médico PENDIENTE: complétalo en el perfil antes de firmar documentos.');
  }
  if (generada) {
    console.log('\n============ CONTRASEÑA GENERADA (se muestra UNA vez) ============');
    console.log(`  Correo:     ${email}`);
    console.log(`  Contraseña: ${password}`);
    console.log('==================================================================\n');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
