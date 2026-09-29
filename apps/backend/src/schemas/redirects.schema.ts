import { z } from 'zod';

export const redirectCreateSchema = z.object({
  from_path: z.string().min(1).startsWith('/', 'from_path must start with "/".'),
  to_path: z.string().min(1),
  status_code: z.coerce.number().int().refine((value) => [301, 302, 307, 308].includes(value), {
    message: 'status_code must be one of 301, 302, 307, 308.'
  }).default(301),
  is_active: z.boolean().default(true),
  note: z.string().optional().nullable()
});

export const redirectUpdateSchema = redirectCreateSchema.partial();
