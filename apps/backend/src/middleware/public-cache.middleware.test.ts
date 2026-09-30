import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import express from 'express';
import { clearPublicCache, publicCache } from './public-cache.middleware';

/**
 * The cache exists to stop every visitor re-querying Supabase. What matters is
 * that it can never show an editor stale content or a visitor something private:
 * logged-in reads bypass it, errors are never replayed, and a save empties it.
 */

let reads = 0;
let releaseSlowRead: (() => void) | null = null;

const app = express();
app.use(publicCache);
app.get('/api/categories', (_req, res) => {
  reads += 1;
  res.json({ read: reads });
});
app.get('/api/categories/missing', (_req, res) => {
  reads += 1;
  res.status(404).json({ read: reads });
});
app.get('/api/departures', (_req, res) => {
  reads += 1;
  res.json({ read: reads });
});
app.get('/api/tours', async (_req, res) => {
  reads += 1;
  const read = reads;
  await new Promise<void>((resolve) => {
    releaseSlowRead = resolve;
  });
  res.json({ read });
});
app.put('/api/categories/saved', (_req, res) => res.json({ ok: true }));
app.put('/api/categories/rejected', (_req, res) => res.status(400).json({ ok: false }));
app.post('/api/analytics/pageview', (_req, res) => res.json({ ok: true }));

let server: Server;
let base = '';

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

beforeEach(() => {
  clearPublicCache();
  reads = 0;
});

const get = async (path: string, headers: Record<string, string> = {}) => {
  const res = await fetch(`${base}${path}`, { headers });
  return { status: res.status, cache: res.headers.get('x-cache'), body: (await res.json()) as { read: number } };
};

const send = (method: string, path: string) => fetch(`${base}${path}`, { method });

describe('public cache', () => {
  it('serves a repeated anonymous read from memory', async () => {
    const first = await get('/api/categories');
    const second = await get('/api/categories');
    assert.equal(first.cache, 'MISS');
    assert.equal(second.cache, 'HIT');
    assert.equal(second.body.read, 1);
    assert.equal(reads, 1);
  });

  it('keys on the query string, so each locale and filter is its own entry', async () => {
    await get('/api/categories?locale=de');
    await get('/api/categories?locale=fr');
    assert.equal(reads, 2);
  });

  it('never caches a logged-in read', async () => {
    await get('/api/categories');
    const editor = await get('/api/categories', { authorization: 'Bearer token' });
    assert.equal(editor.cache, null);
    assert.equal(editor.body.read, 2);
  });

  it('never stores a logged-in answer for visitors', async () => {
    // A staff read can include drafts; the next anonymous read must not get it.
    const editor = await get('/api/categories?status=all', { authorization: 'Bearer token' });
    const visitor = await get('/api/categories?status=all');
    assert.equal(editor.cache, null);
    assert.equal(visitor.cache, 'MISS');
    assert.equal(visitor.body.read, 2);
  });

  it('tells downstream caches that the answer depends on the token', async () => {
    const res = await fetch(`${base}/api/categories`);
    assert.match(res.headers.get('vary') ?? '', /authorization/i);
    await res.json();
  });

  it('leaves live routes such as departures alone', async () => {
    await get('/api/departures');
    const again = await get('/api/departures');
    assert.equal(again.cache, null);
    assert.equal(reads, 2);
  });

  it('never replays an error', async () => {
    await get('/api/categories/missing');
    const again = await get('/api/categories/missing');
    assert.equal(again.status, 404);
    assert.equal(reads, 2);
  });

  it('empties on a successful save, but not on a rejected one', async () => {
    await get('/api/categories');
    await send('PUT', '/api/categories/rejected');
    assert.equal((await get('/api/categories')).cache, 'HIT');

    await send('PUT', '/api/categories/saved');
    const fresh = await get('/api/categories');
    assert.equal(fresh.cache, 'MISS');
    assert.equal(fresh.body.read, 2);
  });

  it('is not emptied by visitor writes such as analytics', async () => {
    await get('/api/categories');
    await send('POST', '/api/analytics/pageview');
    assert.equal((await get('/api/categories')).cache, 'HIT');
  });

  it('does not keep a read that was still running when a save landed', async () => {
    const pending = get('/api/tours');
    while (!releaseSlowRead) await new Promise((resolve) => setTimeout(resolve, 5));
    await send('PUT', '/api/categories/saved');
    releaseSlowRead();
    releaseSlowRead = null;
    await pending;

    const next = get('/api/tours');
    while (!releaseSlowRead) await new Promise((resolve) => setTimeout(resolve, 5));
    (releaseSlowRead as () => void)();
    releaseSlowRead = null;
    const result = await next;
    assert.equal(result.cache, 'MISS');
    assert.equal(result.body.read, 2);
  });
});
