import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextExchangeRateRefresh, parseExchangeRateCron } from './exchange-rate-scheduler.service';

test('parses the configured two-run exchange-rate cron', () => {
  const parsed = parseExchangeRateCron('0 6,18 * * *');
  assert.deepEqual(parsed.minutes, [0]);
  assert.deepEqual(parsed.hours, [6, 18]);
});

test('falls back to the default schedule for invalid minute/hour fields', () => {
  const parsed = parseExchangeRateCron('bad bad * * *');
  assert.deepEqual(parsed.minutes, [0]);
  assert.deepEqual(parsed.hours, [6, 18]);
});

test('calculates a future exchange-rate refresh time', () => {
  const next = getNextExchangeRateRefresh(new Date('2026-08-06T00:00:00.000Z'));
  assert.equal(typeof next, 'string');
  assert.ok(new Date(next as string).getTime() > new Date('2026-08-06T00:00:00.000Z').getTime());
});
