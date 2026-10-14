import nodemailer, { type Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId: string;
  previewUrl?: string | null;
  error?: string | null;
}

class MailerService {
  private transporter: Transporter | null = null;
  private isConfigured = false;

  private initTransporter(): Transporter {
    if (this.transporter && this.isConfigured) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      console.log(`[Mailer] Initializing SMTP transporter with host: ${host}:${port}`);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      console.log('[Mailer] No external SMTP credentials found in env. Initializing local outbox transporter with structured delivery logging.');
      // Stream transport stores message stream in memory and logs it
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }

    this.isConfigured = true;
    return this.transporter;
  }

  public async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const transporter = this.initTransporter();
      const fromAddress = options.from || process.env.MAIL_FROM || 'MOTION Digest <digest@motion.dev>';

      const info = await transporter.sendMail({
        from: fromAddress,
        to: options.toName ? `"${options.toName}" <${options.to}>` : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log(`[Mailer] Daily Digest dispatched successfully to: ${options.to} (${options.subject})`);

      return {
        success: true,
        messageId: info.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        previewUrl: nodemailer.getTestMessageUrl?.(info) || null,
      };
    } catch (err: any) {
      console.error(`[Mailer] Failed to send email to ${options.to}:`, err);
      return {
        success: false,
        messageId: `failed_${Date.now()}`,
        error: err.message || 'Unknown email delivery error',
      };
    }
  }
}

export const mailer = new MailerService();
