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

export function getMailer(): Mailer {
  const provider = process.env.MAILER_PROVIDER ?? 'stub';
  switch (provider) {
    case 'gmail-smtp':
      // Se implementa en U6 con nodemailer + SMTP_* (Gmail App Password).
      throw new Error('Mailer "gmail-smtp" se implementa en U6 (requiere SMTP_* / App Password).');
    case 'stub':
    default:
      return new StubMailer();
  }
}
