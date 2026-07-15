import { logger } from '../logger';

/**
 * Mailer — envío del reporte final (Fase 6). Piloto arranca con stub; se activa
 * Gmail SMTP (App Password, SMTP_*) detrás de este mismo adaptador — punto único de cambio.
 */
export interface MailMessage {
  to: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export interface DeliveryResult {
  ok: boolean;
  provider: string;
  messageId?: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<DeliveryResult>;
}

class StubMailer implements Mailer {
  async send(msg: MailMessage): Promise<DeliveryResult> {
    logger.info({ to: msg.to, subject: msg.subject }, 'mailer_stub_send');
    return { ok: true, provider: 'stub' };
  }
}

/** Envío real por SMTP de Gmail (App Password). Credenciales vía env (SECURITY-12). */
class GmailSmtpMailer implements Mailer {
  async send(msg: MailMessage): Promise<DeliveryResult> {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await transport.sendMail({
      from: process.env.SMTP_USER,
      to: msg.to.join(', '),
      subject: msg.subject,
      html: msg.html,
      attachments: msg.attachments,
    });
    logger.info({ to: msg.to, messageId: info.messageId }, 'mailer_gmail_send');
    return { ok: true, provider: 'gmail-smtp', messageId: info.messageId };
  }
}

export function getMailer(): Mailer {
  const provider = process.env.MAILER_PROVIDER ?? 'stub';
  switch (provider) {
    case 'gmail-smtp':
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('MAILER_PROVIDER=gmail-smtp requiere SMTP_USER y SMTP_PASS (App Password).');
      }
      return new GmailSmtpMailer();
    case 'stub':
    default:
      return new StubMailer();
  }
}
