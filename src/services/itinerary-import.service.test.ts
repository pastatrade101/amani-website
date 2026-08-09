import assert from 'node:assert/strict';
import test from 'node:test';
import { splitTourItemList } from './itinerary-import.service';

test('keeps pipe-delimited tour list items as the explicit format', () => {
  const warnings: string[] = [];

  assert.deepEqual(splitTourItemList('Park fees|Guide; driver|Picnic lunch', 'inclusions', warnings), [
    'Park fees',
    'Guide; driver',
    'Picnic lunch'
  ]);
  assert.deepEqual(warnings, []);
});

test('falls back to semicolon splitting for packed tour inclusions and exclusions', () => {
  const warnings: string[] = [];

  assert.deepEqual(splitTourItemList('Park fees; professional safari guide; airport transfers', 'inclusions', warnings), [
    'Park fees',
    'professional safari guide',
    'airport transfers'
  ]);
  assert.match(warnings[0], /inclusions used semicolons; split into 3 items/);
});

test('does not split empty or single tour list values', () => {
  const warnings: string[] = [];

  assert.deepEqual(splitTourItemList('', 'exclusions', warnings), []);
  assert.deepEqual(splitTourItemList('International flights', 'exclusions', warnings), ['International flights']);
  assert.deepEqual(warnings, []);
});
