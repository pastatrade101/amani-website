import { env } from '../config/env';

// ----------------------------------------------------------------------------
// Provider-agnostic transactional email. Pick ONE by setting env:
//   • Resend  → RESEND_API_KEY (recommended; HTTP API, no SMTP, great delivery)
//   • SMTP    → SMTP_HOST (+ port/user/pass/secure) for a domain mailbox
// If neither is configured, sends are skipped (logged) so nothing breaks.
// sendEmail never throws — callers get a boolean and decide how to proceed.
// ----------------------------------------------------------------------------

export type Mail = { to: string; subject: string; html: string; text?: string; replyTo?: string };

/**
 * Whether email may be sent at all.
 *
 * Two different reasons it might not be — no transport is configured, or
 * delivery has been switched off deliberately — and callers care about neither
 * distinction, only the answer. Every path to sending goes through here, so
 * EMAIL_ENABLED=false silences the outbox and the booking notifications alike.
 */
const emailSwitchedOff = (): boolean =>
  ['false', '0', 'off', 'no'].includes(String(env.EMAIL_ENABLED ?? '').trim().toLowerCase());

export const isEmailConfigured = (): boolean =>
  !emailSwitchedOff() && Boolean(env.RESEND_API_KEY || env.SMTP_HOST);

const sendViaResend = async (mail: Mail): Promise<void> => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      reply_to: mail.replyTo
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
};

const sendViaSmtp = async (mail: Mail): Promise<void> => {
  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: mail.replyTo
  });
};

export const sendEmail = async (mail: Mail): Promise<boolean> => {
  try {
    // Checked here rather than at each caller, so nothing can route around it.
    if (emailSwitchedOff()) {
      console.warn(`[email] delivery disabled — skipped: "${mail.subject}"`);
      return false;
    }
    if (env.RESEND_API_KEY) {
      await sendViaResend(mail);
      return true;
    }
    if (env.SMTP_HOST) {
      await sendViaSmtp(mail);
      return true;
    }
    console.warn(`[email] not configured — skipped: "${mail.subject}" -> ${mail.to}`);
    return false;
  } catch (err) {
    console.error('[email] send failed:', err instanceof Error ? err.message : err);
    return false;
  }
};

/**
 * Escapes a value for interpolation into email HTML.
 *
 * Everything a visitor types — name, message, special requests — ends up in the
 * staff notification. Without this, an enquiry can inject markup and links into
 * an email that arrives from our own domain, which is exactly the kind of mail
 * a colleague trusts.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// The branded shell lives in email-layout.ts; re-exported so every sender keeps
// importing it from here.
export { emailCaption, emailDetails, emailLayout, loadEmailBrand, EMAIL_COLORS } from './email-layout';
export type { EmailAudience, EmailDetail, EmailLayoutOptions } from './email-layout';
