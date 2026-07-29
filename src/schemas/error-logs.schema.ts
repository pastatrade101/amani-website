import { z } from 'zod';

// Public ingest payload — a frontend reporting a broken URL / 404.
export const errorLogIngestSchema = z.object({
  url: z.string().min(1),
  error_type: z.string().default('404'),
  referrer: z.string().optional().nullable(),
  error_message: z.string().optional().nullable()
});

// Admin resolve toggle — mark an entry resolved, optionally recording where the
// broken URL now points.
export const errorLogUpdateSchema = z.object({
  is_resolved: z.boolean().optional(),
  resolved_to: z.string().optional().nullable()
});
