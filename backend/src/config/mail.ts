import nodemailer, { Transporter } from 'nodemailer';
import { env } from './env';
import { logger } from '../utils/logger';

let transporter: Transporter;

export function getMailTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth:
        env.smtp.user && env.smtp.pass
          ? { user: env.smtp.user, pass: env.smtp.pass }
          : undefined,
    });
  }
  return transporter;
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  try {
    const transport = getMailTransporter();
    await transport.sendMail({
      from: env.smtp.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    logger.info(`Email sent to ${options.to}: ${options.subject}`);
  } catch (error) {
    logger.error('Failed to send email:', error);
    // Don't throw — email failures shouldn't crash the app
  }
}

export function verificationEmailTemplate(name: string, link: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FFFDF0; padding: 40px; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="background: #0A0A08; display: inline-block; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
          <span style="color: #FFFF00; font-size: 28px;">✝</span>
        </div>
        <h1 style="color: #0A0A08; font-size: 24px; margin: 0;">Morija Cantiques</h1>
      </div>
      <h2 style="color: #0A0A08;">Welcome, ${name}!</h2>
      <p style="color: #6B6857; line-height: 1.6;">
        Thank you for joining Morija Cantiques. Please verify your email address to access all hymns.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="background: #FFFF00; color: #0A0A08; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          Verify Email
        </a>
      </div>
      <p style="color: #A8A592; font-size: 13px;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
    </div>`;
}

export function passwordResetEmailTemplate(name: string, link: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FFFDF0; padding: 40px; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="background: #0A0A08; display: inline-block; padding: 16px; border-radius: 12px;">
          <span style="color: #FFFF00; font-size: 28px;">✝</span>
        </div>
        <h1 style="color: #0A0A08; font-size: 24px; margin-top: 12px;">Morija Cantiques</h1>
      </div>
      <h2 style="color: #0A0A08;">Password Reset</h2>
      <p style="color: #6B6857; line-height: 1.6;">
        Hi ${name}, we received a request to reset your password.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="background: #FFFF00; color: #0A0A08; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          Reset Password
        </a>
      </div>
      <p style="color: #A8A592; font-size: 13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>`;
}
