import { createHash, randomBytes } from 'node:crypto';
import { RESET_TTL_MINUTOS } from '@anestia/shared';
import { prisma } from '../prisma';
import { logAudit } from '../audit';
import { logger } from '../logger';
import { getMailer } from '../mailer';
import { hashPassword, verifyPassword } from './service';

/**
 * Cambio y restablecimiento de contraseña.
 *
 * Apareció al abrir el alta manual de anestesiólogos: con un solo usuario daba igual, pero en
 * cuanto entra un colega con una contraseña generada hace falta que pueda ponerse la suya, y que
 * pueda recuperarla sin depender de que el dueño de la instalación esté disponible.
 */

/** Del token que viaja en el correo sólo se guarda su hash. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class PasswordActualIncorrecta extends Error {
  constructor() {
    super('La contraseña actual no es correcta.');
    this.name = 'PasswordActualIncorrecta';
  }
}

/**
 * Cambia la contraseña de quien ya tiene sesión, exigiendo la actual.
 *
 * Exigirla no es burocracia: sin eso, una sesión robada o un equipo desbloqueado bastan para
 * quedarse con la cuenta.
 */
export async function cambiarPassword(
  anesthesiologistId: string,
  actual: string,
  nueva: string,
): Promise<void> {
  const medico = await prisma.anesthesiologist.findUnique({ where: { id: anesthesiologistId } });
  if (!medico?.passwordHash || !(await verifyPassword(medico.passwordHash, actual))) {
    throw new PasswordActualIncorrecta();
  }

  await prisma.anesthesiologist.update({
    where: { id: medico.id },
    data: { passwordHash: await hashPassword(nueva), passwordChangedAt: new Date() },
  });
  // Los enlaces de restablecimiento pendientes dejan de valer: si alguien pidió uno porque
  // sospechaba de la cuenta, ese correo no puede seguir siendo una puerta abierta.
  await invalidarPendientes(medico.id);

  await logAudit({
    actorId: medico.id,
    action: 'auth.password_cambiada',
    entity: 'Anesthesiologist',
    entityId: medico.id,
    meta: {},
  });
}

/** Marca como usados los enlaces vivos de un médico. */
async function invalidarPendientes(anesthesiologistId: string): Promise<void> {
  await prisma.passwordReset.updateMany({
    where: { anesthesiologistId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

/**
 * Solicita un restablecimiento.
 *
 * **Siempre se comporta igual, exista el correo o no.** Devolver "ese correo no está registrado"
 * convierte el formulario en un detector de cuentas: cualquiera podría averiguar qué
 * anestesiólogos usan el sistema probando correos.
 */
export async function solicitarReset(email: string, baseUrl: string): Promise<void> {
  const medico = await prisma.anesthesiologist.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!medico) {
    logger.info({ email }, 'auth_reset_solicitado_sin_cuenta');
    return;
  }

  // Un solo enlace vivo por médico: pedir tres correos no deja tres puertas abiertas.
  await invalidarPendientes(medico.id);

  const token = randomBytes(32).toString('base64url');
  await prisma.passwordReset.create({
    data: {
      anesthesiologistId: medico.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTOS * 60_000),
    },
  });

  const enlace = `${baseUrl.replace(/\/$/, '')}/restablecer?token=${encodeURIComponent(token)}`;
  await getMailer().send({
    to: [medico.email],
    subject: 'Restablecer tu contraseña de AnestIA',
    html: `
      <p>Hola, ${medico.fullName}.</p>
      <p>Recibimos una solicitud para restablecer tu contraseña de AnestIA.
         El enlace vale ${RESET_TTL_MINUTOS} minutos y se puede usar una sola vez:</p>
      <p><a href="${enlace}">Restablecer mi contraseña</a></p>
      <p>Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.</p>
    `,
  });

  await logAudit({
    actorId: medico.id,
    action: 'auth.reset_solicitado',
    entity: 'Anesthesiologist',
    entityId: medico.id,
    meta: { expiraEnMinutos: RESET_TTL_MINUTOS },
  });
  // El token NUNCA se registra: el audit log lo leen personas y quedaría una llave escrita.
  logger.info({ anesthesiologistId: medico.id }, 'auth_reset_enviado');
}

export class TokenInvalido extends Error {
  constructor() {
    super('El enlace no es válido o ya venció. Pide uno nuevo.');
    this.name = 'TokenInvalido';
  }
}

/** Aplica el restablecimiento. El token es de un solo uso y caduca. */
export async function restablecerPassword(token: string, nueva: string): Promise<void> {
  const fila = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { anesthesiologist: { select: { id: true } } },
  });

  // Mismo error para las tres causas (no existe, ya se usó, venció): distinguirlas le diría a
  // quien prueba tokens cuál de sus intentos estuvo cerca.
  if (!fila || fila.usedAt || fila.expiresAt.getTime() < Date.now()) {
    throw new TokenInvalido();
  }

  await prisma.$transaction([
    prisma.anesthesiologist.update({
      where: { id: fila.anesthesiologistId },
      data: { passwordHash: await hashPassword(nueva), passwordChangedAt: new Date() },
    }),
    prisma.passwordReset.updateMany({
      where: { anesthesiologistId: fila.anesthesiologistId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  await logAudit({
    actorId: fila.anesthesiologistId,
    action: 'auth.password_restablecida',
    entity: 'Anesthesiologist',
    entityId: fila.anesthesiologistId,
    meta: {},
  });
}
