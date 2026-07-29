import { supabase } from '../config/supabase';
import { AppError } from '../utils/api-response';

// Lock an identifier (email) after too many failed admin logins.
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** Throw 429 if this identifier is currently locked out. */
export const assertNotLocked = async (identifier: string): Promise<void> => {
  if (!identifier) return;
  const { data } = await supabase
    .from('login_rate_limits')
    .select('locked_until')
    .eq('identifier', identifier)
    .maybeSingle();
  const raw = (data as { locked_until?: string } | null)?.locked_until;
  const lockedUntil = raw ? new Date(raw).getTime() : 0;
  if (lockedUntil > Date.now()) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
    throw new AppError(`Too many failed attempts. Please try again in ${mins} minute(s).`, 429);
  }
};

/** Record a failed attempt; lock the identifier once the threshold is hit. */
export const recordLoginFailure = async (identifier: string): Promise<void> => {
  if (!identifier) return;
  const { data } = await supabase
    .from('login_rate_limits')
    .select('attempt_count')
    .eq('identifier', identifier)
    .maybeSingle();
  const attempts = (typeof (data as { attempt_count?: number } | null)?.attempt_count === 'number'
    ? (data as { attempt_count: number }).attempt_count
    : 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
  await supabase
    .from('login_rate_limits')
    .upsert(
      { identifier, attempt_count: attempts, locked_until: lockedUntil, last_attempt_at: new Date().toISOString() },
      { onConflict: 'identifier' }
    );
};

/** Clear the counter after a successful login. */
export const clearLoginAttempts = async (identifier: string): Promise<void> => {
  if (!identifier) return;
  await supabase.from('login_rate_limits').delete().eq('identifier', identifier);
};
