import { z } from 'zod';

export const reviewCreateSchema = z.object({
  platform: z.enum(['TripAdvisor', 'SafariBookings', 'Google']),
  author_name: z.string().min(2),
  author_initials: z.string().optional().nullable(),
  author_photo_url: z.union([z.string().url(), z.literal('')]).optional().nullable(),
  country: z.string().optional().nullable(),
  message: z.string().min(5),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  source_url: z.union([z.string().url(), z.literal('')]).optional().nullable(),
  tour_id: z.union([z.string().uuid(), z.literal('')]).optional().nullable(),
  tour_title: z.string().optional().nullable(),
  status: z.enum(['pending', 'approved']).default('pending'),
  is_featured: z.boolean().optional().default(false),
  sort_order: z.coerce.number().int().min(0).default(0)
});

export const reviewUpdateSchema = reviewCreateSchema.partial();
