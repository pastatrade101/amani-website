import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isStaffRequest, staffFromAuthorization } from './staff';

/**
 * Public routes use this to decide whether drafts may leave the API, so a
 * header that merely looks like a token must never count.
 */

const secret = 'a-test-secret-that-is-long-enough';
const admin = { sub: 'user-1', email: 'editor@example.com', role: 'content_manager' as const, name: 'Editor' };

describe('staff requests', () => {
  it('accepts a valid admin token', () => {
    const token = jwt.sign(admin, secret);
    assert.equal(staffFromAuthorization(`Bearer ${token}`, secret)?.sub, 'user-1');
  });

  it('refuses a token signed with another secret', () => {
    const token = jwt.sign(admin, 'somebody-elses-secret-value');
    assert.equal(staffFromAuthorization(`Bearer ${token}`, secret), null);
  });

  it('refuses an expired token', () => {
    const token = jwt.sign({ ...admin, exp: Math.floor(Date.now() / 1000) - 60 }, secret);
    assert.equal(staffFromAuthorization(`Bearer ${token}`, secret), null);
  });

  it('refuses a trip-portal session, which shares the secret but is no admin', () => {
    const token = jwt.sign({ bid: 'booking-1', scope: 'trip' }, secret);
    assert.equal(staffFromAuthorization(`Bearer ${token}`, secret), null);
  });

  it('refuses an unknown role', () => {
    const token = jwt.sign({ ...admin, role: 'visitor' }, secret);
    assert.equal(staffFromAuthorization(`Bearer ${token}`, secret), null);
  });

  it('refuses a missing or malformed header', () => {
    assert.equal(staffFromAuthorization(undefined, secret), null);
    assert.equal(staffFromAuthorization('Bearer', secret), null);
    assert.equal(staffFromAuthorization('Bearer not-a-token', secret), null);
    assert.equal(staffFromAuthorization(jwt.sign(admin, secret), secret), null);
  });

  it('reads the request header with the configured secret', () => {
    const token = jwt.sign(admin, env.JWT_SECRET);
    assert.equal(isStaffRequest({ headers: { authorization: `Bearer ${token}` } }), true);
    assert.equal(isStaffRequest({ headers: { authorization: 'Bearer anything' } }), false);
    assert.equal(isStaffRequest({ headers: {} }), false);
  });

  it('trusts a user that authenticate() already verified', () => {
    assert.equal(isStaffRequest({ headers: {}, user: { ...admin, role: 'viewer' as const } }), true);
  });
});
