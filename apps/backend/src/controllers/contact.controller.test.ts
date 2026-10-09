import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DUPLICATE_WINDOW_MS, findRecentPlan, splitContactBody } from './contact.controller';

/**
 * contact_messages only has the columns the old contact form needed, so the
 * planner's extra fields must never reach the insert. And a resent plan must
 * find the first one rather than email the team and the traveller twice.
 */

describe('splitContactBody', () => {
  it('keeps the fields that are not columns out of the row', () => {
    const { row, source, reference } = splitContactBody({
      full_name: 'Amina Hassan',
      email: 'amina@example.com',
      subject: 'Plan my trip · K2A-1A2B3C4D',
      message: 'Trip plan K2A-1A2B3C4D: Safari',
      source: 'plan_my_trip',
      reference: 'K2A-1A2B3C4D',
      captcha_token: 'token'
    });
    assert.deepEqual(Object.keys(row).sort(), ['email', 'full_name', 'message', 'subject']);
    assert.equal(source, 'plan_my_trip');
    assert.equal(reference, 'K2A-1A2B3C4D');
  });

  it('treats the enquiry form, which sends neither, as the contact form', () => {
    const body = { full_name: 'John Smith', email: 'john@example.com', phone: null, subject: 'Safari enquiry: Tanzania', message: 'Hello there, two of us in July.' };
    const { row, source, reference } = splitContactBody(body);
    assert.deepEqual(row, body);
    assert.equal(source, 'contact_form');
    assert.equal(reference, '');
  });
});

/** Records the query the guard builds and answers with `found`. */
const fakeClient = (found: Record<string, unknown> | null) => {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'select', 'ilike', 'gte', 'is', 'order', 'limit']) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }
  chain.maybeSingle = async () => {
    calls.push(['maybeSingle', []]);
    return { data: found, error: null };
  };
  return { client: chain, calls };
};

describe('findRecentPlan', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');

  it('looks for the same reference from the same address in the last 30 minutes', async () => {
    const { client, calls } = fakeClient({ id: 'row-1' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await findRecentPlan('Amina@Example.com', 'K2A-1A2B3C4D', now, client as any);
    assert.deepEqual(found, { id: 'row-1' });
    assert.deepEqual(calls.find(([m]) => m === 'from')?.[1], ['contact_messages']);
    const likes = calls.filter(([m]) => m === 'ilike').map(([, args]) => args);
    assert.deepEqual(likes, [
      ['email', 'Amina@Example.com'],
      ['subject', '%K2A-1A2B3C4D%']
    ]);
    assert.deepEqual(calls.find(([m]) => m === 'gte')?.[1], ['created_at', new Date(now - DUPLICATE_WINDOW_MS).toISOString()]);
    assert.deepEqual(calls.find(([m]) => m === 'is')?.[1], ['deleted_at', null]);
  });

  it('escapes wildcards so one address cannot match another', async () => {
    const { client, calls } = fakeClient(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await findRecentPlan('a_b%c@example.com', 'K2A-1A2B3C4D', now, client as any);
    assert.deepEqual(calls.find(([m]) => m === 'ilike')?.[1], ['email', 'a\\_b\\%c@example.com']);
  });

  it('answers null when nothing was sent before', async () => {
    const { client } = fakeClient(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.equal(await findRecentPlan('amina@example.com', 'K2A-1A2B3C4D', now, client as any), null);
  });

  it('does not query at all without a reference', async () => {
    const { client, calls } = fakeClient({ id: 'row-1' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.equal(await findRecentPlan('amina@example.com', '', now, client as any), null);
    assert.equal(calls.length, 0);
  });
});
