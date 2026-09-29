/** Explicit, server-only admin provisioning. Credentials come from backend .env. */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { z } from 'zod';

const config = z.object({
  ADMIN_EMAIL: z.string().email().transform(value => value.trim().toLowerCase()),
  ADMIN_NAME: z.string().trim().min(1).default('Key2africa'),
  ADMIN_PASSWORD: z.string().min(16)
}).safeParse(process.env);

async function main() {
  if (!config.success) throw new Error('Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (at least 16 characters) in apps/backend/.env.');
  const uri = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!uri) throw new Error('A database connection URL is required.');
  const client = new Client({ connectionString: uri, connectionTimeoutMillis: 12000,
    ssl: process.env.PGSSLMODE === 'disable' || /@(?:localhost|127\.0\.0\.1)(?::|\/)/.test(uri) ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM public.admin_users WHERE email = $1', [config.data.ADMIN_EMAIL]);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      console.log('The configured admin already exists. No password or permissions were changed.');
      return;
    }
    const hash = await bcrypt.hash(config.data.ADMIN_PASSWORD, 12);
    await client.query('INSERT INTO public.admin_users (full_name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, true)',
      [config.data.ADMIN_NAME, config.data.ADMIN_EMAIL, hash, 'super_admin']);
    await client.query('COMMIT');
    console.log('Created the configured Key2africa administrator. Credentials remain in backend .env.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { await client.end(); }
}
main().catch(() => {
  console.error('Admin provisioning failed. Verify ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD and the database connection.');
  process.exitCode = 1;
});
