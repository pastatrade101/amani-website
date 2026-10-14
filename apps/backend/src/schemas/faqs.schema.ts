import { z } from 'zod';

/**
 * Where a question can be shown. FAQs are one shared library: each question is
 * written once and placed on the home page and on any number of travel styles
 * (`category`, the tour_categories table), tours and destinations. Matches the
 * `faq_placements` table's check constraint.
 */
export const FAQ_PLACEMENTS = ['home', 'category', 'tour', 'destination'] as const;

export type FaqPlacement = (typeof FAQ_PLACEMENTS)[number];

const ids = (max: number) => z.array(z.string().uuid()).max(max).default([]);

/** Every place one question shows. Saving it replaces the previous set. */
export const faqPlacementsSchema = z.object({
  home: z.boolean().default(false),
  category_ids: ids(100),
  tour_ids: ids(500),
  destination_ids: ids(200)
});

export type FaqPlacementsInput = z.infer<typeof faqPlacementsSchema>;

const faqBase = z.object({
  question: z.string().min(5),
  answer: z.string().min(5),
  // An editorial topic for the library (Safari, Visas, Payments…), not a
  // travel style. Where the question shows is `placements`.
  category: z.string().max(80).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  sort_order: z.coerce.number().int().min(0).default(0),
  placements: faqPlacementsSchema.optional()
});

export const faqCreateSchema = faqBase;
// Leaving `placements` out of an update keeps them as they are.
export const faqUpdateSchema = faqBase.partial();
