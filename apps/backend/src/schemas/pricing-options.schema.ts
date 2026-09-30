import { z } from 'zod';

const optionalText = z.string().optional().nullable();

export const priceTypeSchema = z.enum([
  'per_person',
  'per_group',
  'per_child',
  'single_supplement',
  'upgrade',
  'discount'
]);

const pricingOptionBaseSchema = z.object({
  tour_id: z.string().uuid(),
  title: z.string().trim().min(2),
  description: optionalText,
  price: z.coerce.number().min(0),
  currency: z.string().trim().min(3).max(3).default('USD'),
  price_type: priceTypeSchema.default('per_person'),
  sort_order: z.coerce.number().int().default(0)
});

export const pricingOptionCreateSchema = pricingOptionBaseSchema;
export const pricingOptionUpdateSchema = pricingOptionBaseSchema.partial();

const groupPriceSchema = z.object({
  id: z.string().uuid().optional(),
  minimum_travelers: z.coerce.number().int().min(1),
  maximum_travelers: z.coerce.number().int().min(1).optional().nullable(),
  room_count: z.coerce.number().int().min(0).default(1),
  price: z.coerce.number().min(0).optional().nullable(),
  price_status: z.enum(['FIXED_PRICE', 'ON_REQUEST', 'NOT_AVAILABLE']).default('FIXED_PRICE'),
  sort_order: z.coerce.number().int().default(0)
}).superRefine((value, ctx) => {
  if (value.maximum_travelers != null && value.maximum_travelers < value.minimum_travelers) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maximum_travelers'], message: 'Maximum travelers must be at least the minimum.' });
  if (value.price_status === 'FIXED_PRICE' && value.price == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'A fixed price is required.' });
});

export const pricingSeasonSaveSchema = z.object({
  tour_id: z.string().uuid(),
  seasons: z.array(z.object({
    id: z.string().uuid().optional(),
    // Comfort level these prices are for; seasons saved before styles existed read as midrange.
    safari_style: z.enum(['budget', 'midrange', 'luxury']).default('midrange'),
    season_type: z.enum(['STANDARD_SEASON', 'PEAK_SEASON', 'CUSTOM']),
    season_name: z.string().trim().min(2),
    start_date: z.string().date().optional().nullable(),
    end_date: z.string().date().optional().nullable(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    pricing_basis: z.enum(['PER_PERSON', 'PER_GROUP']),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    sort_order: z.coerce.number().int().default(0),
    group_prices: z.array(groupPriceSchema).min(1)
  })).max(30)
});
