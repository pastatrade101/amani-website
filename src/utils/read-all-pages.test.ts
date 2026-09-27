import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAllPages } from './read-all-pages';

test('reads beyond the API cap without losing any records', async () => {
  const source = Array.from({ length: 1207 }, (_, id) => ({ id }));
  const starts: number[] = [];
  const result = await readAllPages((from) => {
    starts.push(from);
    return Promise.resolve({ data: source.slice(from, from + 100), count: source.length, error: null });
  });
  assert.deepEqual(result, source);
  assert.equal(starts.length, 13);
});

test('returns an empty inventory and rejects errors or a truncated inventory', async () => {
  assert.deepEqual(await readAllPages(() => Promise.resolve({ data: [], count: 0, error: null })), []);
  await assert.rejects(readAllPages(() => Promise.resolve({ data: [], count: 3, error: null })));
  await assert.rejects(readAllPages(() => Promise.resolve({ data: null, count: null, error: new Error('offline') })));
  await assert.rejects(readAllPages(() => Promise.resolve({ data: [], count: null, error: null })));
});
