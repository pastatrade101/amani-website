import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Robust boolean parser for env strings. z.coerce.boolean() treats the string
// "false" as true (any non-empty string is truthy), so we parse explicitly.
const boolish = (def: boolean) =>
  z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
    return def;
  }, z.boolean());

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  // Global API flood-protection. Each page view fans out ~10-15 read requests,
  // so this is generous by design; abusive/write endpoints have their own tight
  // limiters (contact, bookings, AI chat, trip access).
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3000),
  // How long an anonymous public GET is served from memory before Supabase is
  // asked again (middleware/public-cache). Any CMS save empties the cache at
  // once, so this only bounds changes made outside the app. 0 turns it off.
  PUBLIC_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(600),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_STORAGE_BUCKET: z.string().default('goldfinch-media'),
  // Cloudflare R2 is S3-compatible. It is enabled only when the toggle and all
  // credentials are present, so removing R2_ENABLED immediately restores the
  // existing Supabase Storage write path.
  R2_ENABLED: boolish(false),
  R2_ACCOUNT_ID: z.string().optional().or(z.literal('')),
  R2_ACCESS_KEY_ID: z.string().optional().or(z.literal('')),
  R2_SECRET_ACCESS_KEY: z.string().optional().or(z.literal('')),
  R2_BUCKET_NAME: z.string().optional().or(z.literal('')),
  R2_PUBLIC_URL: z.string().url().optional().or(z.literal('')),
  MEDIA_MAX_ORIGINAL_WIDTH: z.coerce.number().int().positive().default(2400),
  MEDIA_ORIGINAL_QUALITY: z.coerce.number().int().min(50).max(95).default(82),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').default('development-only-change-this-secret'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal('')),
  HUBSPOT_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  HUBSPOT_PORTAL_ID: z.string().optional().or(z.literal('')),

  // ── Exchange rates (backend only) ─────────────────────────────────────────
  // Open Exchange Rates App ID must never be exposed to the browser. Visitor
  // requests read cached snapshots only; scheduled/admin refreshes use this key.
  OPEN_EXCHANGE_RATES_APP_ID: z.string().optional().or(z.literal('')),
  EXCHANGE_RATE_REFRESH_ENABLED: boolish(true),
  EXCHANGE_RATE_REFRESH_CRON: z.string().default('0 6,18 * * *'),
  EXCHANGE_RATE_TIMEZONE: z.string().default('Africa/Dar_es_Salaam'),
  EXCHANGE_RATE_CACHE_HOURS: z.coerce.number().positive().default(12),
  EXCHANGE_RATE_MARKUP_PERCENT: z.coerce.number().min(0).max(25).default(0),
  EXCHANGE_RATE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  EXCHANGE_RATE_LOCK_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  // ── Email (transactional) — pluggable provider ────────────────────────────
  // Set EITHER Resend (recommended: just an API key) OR SMTP (your domain
  // mailbox). If neither is set, email sends are skipped (nothing breaks).
  EMAIL_FROM: z.string().default('Goldfinch Adventures <onboarding@resend.dev>'),
  // Set to false to stop sending email without removing the credentials, so
  // turning it back on is a restart rather than a secrets change.
  EMAIL_ENABLED: z.string().optional().or(z.literal('')),
  RESEND_API_KEY: z.string().optional().or(z.literal('')),
  SMTP_HOST: z.string().optional().or(z.literal('')),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: boolish(false),
  SMTP_USER: z.string().optional().or(z.literal('')),
  SMTP_PASS: z.string().optional().or(z.literal('')),
  // Where new-booking notifications go (defaults to none → skipped).
  SPECIALIST_EMAIL: z.string().optional().or(z.literal('')),

  // ── GA4 Data API (Phase 2 analytics traffic) — backend only ───────────────
  // Service-account credentials. GOOGLE_PRIVATE_KEY keeps literal "\n" newlines
  // (we un-escape them at use). Leave blank to run without GA4 (dashboard shows
  // a "not configured" state and never errors).
  GA4_PROPERTY_ID: z.string().optional().or(z.literal('')),
  GOOGLE_CLIENT_EMAIL: z.string().optional().or(z.literal('')),
  GOOGLE_PRIVATE_KEY: z.string().optional().or(z.literal('')),

  // ── Microsoft Clarity Data Export API — backend only ──────────────────────
  // Bearer token generated in Clarity → Settings → Data export. Powers the real
  // UX-intelligence metrics (rage/dead clicks, scroll depth, sessions). Leave
  // blank to run without it (dashboard shows deep-links + an onboarding state).
  // The public project id (for building deep-links) is optional here.
  CLARITY_API_TOKEN: z.string().optional().or(z.literal('')),
  CLARITY_PROJECT_ID: z.string().optional().or(z.literal('')),

  // Analytics event retention: delete analytics_events older than N days (nightly).
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().default(180),

  // ── Goldfinch AI Travel Advisor (v2) ──────────────────────────────────────
  AI_ENABLED: boolish(true),
  AI_DAILY_BUDGET_USD: z.coerce.number().default(5),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().default(100),
  AI_MAX_MESSAGES_PER_SESSION: z.coerce.number().int().default(15),
  AI_MAX_MESSAGES_PER_IP_PER_DAY: z.coerce.number().int().default(30), // weak signal only (CGNAT)
  AI_MAX_INPUT_TOKENS: z.coerce.number().int().default(8000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().default(700),
  AI_USE_PROMPT_CACHING: boolish(true),
  AI_PROMPT_CACHE_TTL: z.enum(['5m', '1h']).default('1h'),
  // Step down to Haiku-for-everything once daily spend crosses this fraction.
  AI_DEGRADE_AT_BUDGET_FRACTION: z.coerce.number().default(0.8),
  ANTHROPIC_SIMPLE_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  ANTHROPIC_REASONING_MODEL: z.string().default('claude-sonnet-4-6'),
  ANTHROPIC_VERSION: z.string().default('2023-06-01'),
  // Semantic layer (pgvector). Provider is pluggable; dimension must match the
  // cms_embeddings / ai_answer_cache vector(N) columns in the v2 migration.
  AI_EMBEDDING_PROVIDER: z.string().optional().or(z.literal('')), // 'openai' | 'voyage'
  AI_EMBEDDING_MODEL: z.string().optional().or(z.literal('')),
  AI_EMBEDDING_API_KEY: z.string().optional().or(z.literal('')),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().default(1536),
  AI_SEMANTIC_CACHE_THRESHOLD: z.coerce.number().default(0.92),
  // Abuse protection (CGNAT-aware): Turnstile is the primary control.
  TURNSTILE_SECRET_KEY: z.string().optional().or(z.literal('')),
  // ── WhatsApp Business Cloud API ───────────────────────────────────────────
  // App level: these belong to the Meta app, are shared by every business
  // account it serves, and sign the webhook. They stay here.
  WHATSAPP_APP_ID: z.string().optional().or(z.literal('')),
  // The Embedded Signup configuration id. Public — the browser SDK needs it.
  META_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional().or(z.literal('')),
  // Account level: the fallback sender for a site whose business has not
  // connected their own account yet. A connected account overrides both.
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().or(z.literal('')),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  // Privacy: purge anonymous conversations after N days (§27).
  AI_DATA_RETENTION_DAYS: z.coerce.number().int().default(90)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`);
  throw new Error(`Invalid environment configuration: ${messages.join(', ')}`);
}

if (parsed.data.NODE_ENV === 'production') {
  if (!parsed.data.SUPABASE_URL || !parsed.data.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
  }

  if (parsed.data.JWT_SECRET === 'development-only-change-this-secret') {
    throw new Error('JWT_SECRET must be changed in production.');
  }
}

export const env = parsed.data;
// Comma-separated list of allowed front-end origins for CORS. Trailing slashes are
// stripped so e.g. "https://goldfinch.makutano.co.tz/" matches the browser's origin.
export const allowedOrigins = env.FRONTEND_URL.split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

/** Outside production, accept any localhost/127.0.0.1 port.
 *
 *  FRONTEND_URL pins a single port, but Vite silently moves to the next free one
 *  (5173 -> 5174 -> …) whenever the configured port is taken. When that happened
 *  every browser-side call failed CORS preflight, so the nav mega menus — which
 *  fetch their links client-side — rendered as plain links with no dropdown.
 *  Production still matches FRONTEND_URL exactly. */
export const isOriginAllowed = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  if (env.NODE_ENV === 'production') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
};
