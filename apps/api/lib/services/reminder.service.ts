import { prisma } from '../prisma';
import { getMailer } from '../mailer';
import { logAudit } from '../audit';
import { logger } from '../logger';
import { caseStatusLabel } from '@anestia/shared';
import { casesForDailyReminder, type CalendarCase } from './calendar.service';

/**
 * Recordatorio matutino de cirugías (cero setup). Un correo por anestesiólogo con las
 * cirugías de hoy y de mañana, resaltando las que son en <48h y aún no están aprobadas.
 *
 * Reglas:
 *  - ON por defecto para todos los perfiles; el médico apaga con `dailyReminderOptOut`.
 *  - NO se manda si no hay cirugías hoy ni mañana (no llenar la bandeja de correos vacíos).
 *  - Usa el mailer existente (stub o Gmail SMTP) — funciona con o sin SMTP real.
 */

/** Base para los deep-links del correo. El cron no tiene request, por eso viene de env. */
function appOrigin(): string {
  return process.env.APP_ORIGIN ?? 'http://localhost:3000';
}

/** Recorre los perfiles suscritos y envía el correo a los que tengan cirugías. */
export async function sendDailyReminders(now: Date): Promise<{ enviados: number; omitidos: number }> {
  const perfiles = await prisma.anesthesiologist.findMany({
    where: { dailyReminderOptOut: false },
    select: { id: true, fullName: true, email: true },
  });

  let enviados = 0;
  let omitidos = 0;
  const origin = appOrigin();

  for (const p of perfiles) {
    const { hoy, manana } = await casesForDailyReminder(p.id, now);
    if (hoy.length === 0 && manana.length === 0) {
      omitidos++;
      continue; // bandeja limpia: nada que recordar hoy
    }

    const html = buildReminderHtml({ nombre: p.fullName, hoy, manana, origin });
    const subject = buildSubject(hoy, manana);
    await getMailer().send({ to: [p.email], subject, html });
    await logAudit({
      action: 'reminder.sent',
      entity: 'Anesthesiologist',
      entityId: p.id,
      meta: { hoy: hoy.length, manana: manana.length },
    });
    enviados++;
  }

  logger.info({ enviados, omitidos }, 'daily_reminder_run');
  return { enviados, omitidos };
}

/** Asunto del correo, con aviso si hay cirugías pendientes en <48h. */
export function buildSubject(hoy: CalendarCase[], manana: CalendarCase[]): string {
  const pendientes = [...hoy, ...manana].filter((c) => c.alerta48h).length;
  const base = `Cirugías: ${hoy.length} hoy, ${manana.length} mañana`;
  return pendientes > 0 ? `⚠ ${base} (${pendientes} sin aprobar <48h)` : base;
}

/** Cuerpo HTML del recordatorio. Función pura para poder probar el contenido sin BD ni mailer. */
export function buildReminderHtml(input: {
  nombre: string;
  hoy: CalendarCase[];
  manana: CalendarCase[];
  origin: string;
}): string {
  const { nombre, hoy, manana, origin } = input;
  const pendientes = [...hoy, ...manana].filter((c) => c.alerta48h);

  const alerta = pendientes.length
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin:0 0 18px;">
         <strong style="color:#b91c1c;">⚠ ${pendientes.length} cirugía(s) en menos de 48 horas sin valoración aprobada.</strong>
         <div style="color:#7f1d1d;font-size:13px;margin-top:4px;">Requieren tu atención antes de la cirugía.</div>
       </div>`
    : '';

  return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:16px;">
    <h2 style="font-size:18px;margin:0 0 4px;">Buenos días, ${escapeHtml(nombre)}</h2>
    <p style="color:#6b7280;font-size:13px;margin:0 0 18px;">Tus cirugías de hoy y mañana.</p>
    ${alerta}
    ${section('Hoy', hoy, origin)}
    ${section('Mañana', manana, origin)}
    <p style="color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
      Recibes este correo automáticamente. Puedes desactivarlo desde tu perfil en AnestIA.
    </p>
  </body></html>`;
}

function section(titulo: string, casos: CalendarCase[], origin: string): string {
  if (casos.length === 0) {
    return `<h3 style="font-size:14px;margin:16px 0 6px;">${titulo}</h3>
            <p style="color:#9ca3af;font-size:13px;margin:0;">Sin cirugías.</p>`;
  }
  const filas = casos
    .map((c) => {
      const url = `${origin}/cases/${c.caseId}/review`;
      const flag = c.alerta48h
        ? ' <span style="color:#b91c1c;font-weight:600;">· &lt;48h sin aprobar</span>'
        : '';
      return `<li style="margin:0 0 8px;">
        <a href="${url}" style="color:#2563eb;text-decoration:none;font-weight:600;">${escapeHtml(c.patientName ?? 'Paciente')}</a>
        <span style="color:#4b5563;"> — ${escapeHtml(c.procedure ?? 'Procedimiento')}</span>${flag}
        <div style="color:#9ca3af;font-size:12px;">${caseStatusLabel(c.status)}</div>
      </li>`;
    })
    .join('');
  return `<h3 style="font-size:14px;margin:16px 0 6px;">${titulo}</h3>
          <ul style="list-style:none;padding:0;margin:0;">${filas}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
