import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

/**
 * In-memory cache for anonymous public GETs.
 *
 * Every page view fans out into the same handful of list calls (categories,
 * homepage, languages, settings...) and each one re-queried Supabase, which
 * bills the returned rows as egress. One answer is now shared by every visitor
 * until it expires or the content changes.
 *
 * Safe by construction:
 *  - GET only, and only without an Authorization header. The CMS always sends
 *    its token, so editors read live data and drafts never enter the cache.
 *  - Content routes only (PUBLIC_PREFIXES). Availability, bookings, currencies,
 *    the trip portal and the AI routes are never cached.
 *  - 200 responses only; errors are never replayed.
 *  - Any successful write empties the whole cache, so a CMS save shows on the
 *    very next request. Visitor writes that never change content (enquiries,
 *    analytics, chat) are the only exceptions, or they would flush it on every
 *    page view.
 */

const PUBLIC_PREFIXES = [
  '/api/tours',
  '/api/tour-inclusions',
  '/api/tour-exclusions',
  '/api/tour-images',
  '/api/itineraries',
  '/api/pricing-options',
  '/api/categories',
  '/api/translations',
  '/api/destinations',
  '/api/lodges',
  '/api/activities',
  '/api/trip-points',
  '/api/safety-topics',
  '/api/travel-styles',
  '/api/safari-packages',
  '/api/comparisons',
  '/api/blog',
  '/api/blog-categories',
  '/api/gallery',
  '/api/testimonials',
  '/api/specialists',
  '/api/faqs',
  '/api/homepage',
  '/api/public',
  '/api/branding',
  '/api/reviews',
  '/api/migration-calendar',
  '/api/redirects',
  '/api/page-seo'
];

// Writes that visitors make on ordinary page views. None of them changes what
// a cached route returns.
const NON_CONTENT_WRITES = [
  '/api/analytics',
  '/api/errors',
  '/api/bookings',
  '/api/contact',
  '/api/ai',
  '/api/trip',
  '/api/whatsapp',
  '/api/webhooks',
  '/api/hubspot',
  '/api/payments',
  '/api/auth'
];

const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
const MAX_ENTRIES = 1500;

type Entry = { body: string; bytes: number; expires: number };

const store = new Map<string, Entry>();
let totalBytes = 0;
// Bumped by every flush. A read that started before a write must not store the
// pre-write answer it is still holding.
let generation = 0;

const under = (path: string, prefixes: string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const drop = (key: string) => {
  const entry = store.get(key);
  if (!entry) return;
  totalBytes -= entry.bytes;
  store.delete(key);
};

export const clearPublicCache = () => {
  store.clear();
  totalBytes = 0;
  generation += 1;
};

const remember = (key: string, body: string) => {
  const bytes = Buffer.byteLength(body);
  if (bytes > MAX_ENTRY_BYTES) return;
  drop(key);
  // Map iteration is insertion order, so the first keys are the oldest.
  for (const oldest of store.keys()) {
    if (store.size < MAX_ENTRIES && totalBytes + bytes <= MAX_TOTAL_BYTES) break;
    drop(oldest);
  }
  store.set(key, { body, bytes, expires: Date.now() + env.PUBLIC_CACHE_TTL_SECONDS * 1000 });
  totalBytes += bytes;
};

export const publicCache = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (!under(path, NON_CONTENT_WRITES)) {
      res.on('finish', () => {
        if (res.statusCode < 400) clearPublicCache();
      });
    }
    return next();
  }

  if (
    req.method !== 'GET' ||
    env.PUBLIC_CACHE_TTL_SECONDS <= 0 ||
    req.headers.authorization ||
    !under(path, PUBLIC_PREFIXES)
  ) {
    return next();
  }

  const key = req.originalUrl;
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    res.set('X-Cache', 'HIT');
    return res.status(200).type('application/json').send(hit.body);
  }
  if (hit) drop(key);

  const startedAt = generation;
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode === 200 && generation === startedAt) {
      const serialized = JSON.stringify(body);
      if (serialized !== undefined) remember(key, serialized);
    }
    res.set('X-Cache', 'MISS');
    return json(body);
  };
  return next();
};
