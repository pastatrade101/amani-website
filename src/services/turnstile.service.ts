import { env } from '../config/env';

/**
 * Cloudflare Turnstile verification.
 *
 * Lifted out of the AI chat guard, which was the only thing using it, so the
 * enquiry forms can share one implementation rather than growing a second.
 */
export const isTurnstileConfigured = (): boolean => Boolean(env.TURNSTILE_SECRET_KEY);

export const verifyTurnstile = async (token: string | undefined, ip: string | undefined): Promise<boolean> => {
  if (!env.TURNSTILE_SECRET_KEY) return false;
  if (!token) return false;

  try {
    const form = new URLSearchParams();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return Boolean(data?.success);
  } catch {
    return false;
  }
};
