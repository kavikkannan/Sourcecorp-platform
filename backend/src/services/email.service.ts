import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { logger } from '../config/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (config.smtp.host && config.smtp.user) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
    } else {
      logger.warn('SMTP not configured. Email notifications will be logged only.');
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const from = config.smtp.from || 'noreply@sourcecorp.com';

    if (!this.transporter) {
      logger.info('Email would be sent (SMTP not configured):', {
        from,
        to: options.to,
        subject: options.subject,
      });
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });
      logger.info(`Email sent to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    } catch (error) {
      logger.error('Failed to send email', error);
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
