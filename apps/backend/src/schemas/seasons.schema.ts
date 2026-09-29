import { z } from 'zod';

/** Keys the frontend maps to a Lucide icon (apps/frontend/src/lib/seasons.ts). */
export const SEASON_ICONS = ['leaf', 'sprout', 'cloud-rain', 'cloud-drizzle', 'cloud-sun', 'sun', 'thermometer-sun', 'droplets', 'wind', 'snowflake'] as const;
/** Keys the frontend maps to a card, icon and month-strip colour set. */
export const SEASON_TONES = ['green', 'blue', 'amber', 'rose', 'slate'] as const;

const month = z.coerce.number().int().min(1).max(12);
const points = z.array(z.string().trim().min(1).max(160)).max(12);

// No defaults here: an update sends only what changed, and a default would
// silently reset the fields it left out.
const fields = {
  name: z.string().trim().min(2).max(60),
  start_month: month,
  end_month: month,
  description: z.string().trim().max(600).optional().nullable(),
  icon: z.enum(SEASON_ICONS),
  tone: z.enum(SEASON_TONES),
  advantages: points,
  disadvantages: points,
  best_for: z.string().trim().max(160).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  sort_order: z.coerce.number().int().min(0)
};

export const seasonCreateSchema = z.object({
  ...fields,
  icon: fields.icon.default('leaf'),
  tone: fields.tone.default('green'),
  advantages: fields.advantages.default([]),
  disadvantages: fields.disadvantages.default([]),
  status: fields.status.default('draft'),
  sort_order: fields.sort_order.default(0)
});

export const seasonUpdateSchema = z.object(fields).partial();
