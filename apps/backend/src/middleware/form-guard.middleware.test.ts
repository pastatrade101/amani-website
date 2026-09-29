import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { __resetFormGuard, formGuard, noteSubmission, recentCount } from './form-guard.middleware';

/**
 * The behaviour that matters here is the balance: a real traveller enquiring
 * about a few trips must never be challenged, and the guard must never take the
 * forms offline just because Turnstile has no keys yet.
 */

type Res = { code?: number; body?: unknown; status: (c: number) => Res; json: (b: unknown) => Res };

const mockRes = (): Res => {
  const res: Res = {
    status(code: number) {
      res.code = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    }
  } as Res;
  return res;
};

const run = (req: Record<string, unknown>) =>
  new Promise<{ passed: boolean; res: Res }>((resolve) => {
    const res = mockRes();
    let settled = false;
    const done = (passed: boolean) => {
      if (settled) return;
      settled = true;
      resolve({ passed, res });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formGuard(req as any, res as any, () => done(true));
    setTimeout(() => done(false), 40);
  });

describe('formGuard', () => {
  beforeEach(() => __resetFormGuard());

  it('counts submissions per address inside the window', () => {
    assert.equal(recentCount('1.2.3.4'), 0);
    noteSubmission('1.2.3.4');
    noteSubmission('1.2.3.4');
    assert.equal(recentCount('1.2.3.4'), 2);
    assert.equal(recentCount('5.6.7.8'), 0, 'addresses are tracked independently');
  });

  it('forgets submissions older than the window', () => {
    const old = Date.now() - 11 * 60 * 1000;
    noteSubmission('1.2.3.4', old);
    assert.equal(recentCount('1.2.3.4'), 0);
  });

  it('lets a real traveller send several enquiries untouched', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { passed } = await run({ ip: '9.9.9.9', body: {}, socket: {} });
      assert.equal(passed, true, `submission ${attempt} should pass`);
    }
  });

  it('does not block when Turnstile is unconfigured, however many are sent', async () => {
    // No TURNSTILE_SECRET_KEY in the test env — the guard must stay out of the way
    // rather than lock everybody out.
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const { passed } = await run({ ip: '7.7.7.7', body: {}, socket: {} });
      assert.equal(passed, true, `submission ${attempt} should pass while unconfigured`);
    }
  });

  it('never challenges an authenticated admin', async () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const { passed } = await run({ ip: '8.8.8.8', body: {}, socket: {}, user: { sub: 'admin' } });
      assert.equal(passed, true);
    }
  });

  it('keeps counting an address that has been challenged', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) noteSubmission('4.4.4.4');
    assert.equal(recentCount('4.4.4.4'), 5, 'a failed challenge must still raise the count');
  });
});
