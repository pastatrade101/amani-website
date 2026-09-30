import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { adminRoles } from '../config/permissions';
import type { AuthTokenPayload } from '../types';

const isAdminRole = (role: unknown): boolean => (adminRoles as string[]).includes(String(role));

/**
 * The admin behind an `Authorization: Bearer …` header, or null.
 *
 * The token is verified, never trusted for being present: public routes decide
 * from this whether drafts may leave the API. The role is checked too, because
 * trip-portal sessions are signed with the same secret and must not count.
 */
export const staffFromAuthorization = (header: string | undefined, secret = env.JWT_SECRET): AuthTokenPayload | null => {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret) as Partial<AuthTokenPayload>;
    return typeof payload?.sub === 'string' && isAdminRole(payload.role) ? (payload as AuthTokenPayload) : null;
  } catch {
    return null;
  }
};

/** True only for a request carrying a valid admin token. */
export const isStaffRequest = (req: Pick<Request, 'headers' | 'user'>): boolean => {
  // authenticate() already verified it on protected routes.
  if (req.user && isAdminRole(req.user.role)) return true;
  return staffFromAuthorization(req.headers.authorization) !== null;
};
