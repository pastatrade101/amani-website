import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TOUR_LIMITS, limitTone, richTextLength } from './tour-limits.js';

const own = fileURLToPath(new URL('./tour-limits.ts', import.meta.url));
const api = fileURLToPath(new URL('../../../backend/src/schemas/tour-limits.ts', import.meta.url));

/** Every `name: number` inside the TOUR_LIMITS literal, in order, as written. */
const limitsIn = (file: string) => {
	const source = readFileSync(file, 'utf8');
	const start = source.indexOf('TOUR_LIMITS = {');
	const body = source.slice(start, source.indexOf('} as const;', start));
	const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	return [...withoutComments.matchAll(/(\w+):\s*(\d+)/g)].map(([, name, value]) => `${name}=${value}`);
};

test('the API enforces the same numbers as the editor', { skip: !existsSync(api) && 'backend workspace not present' }, () => {
	assert.ok(limitsIn(own).length > 20);
	assert.deepEqual(limitsIn(api), limitsIn(own));
});

test('the longest text already published fits every limit', () => {
	// Longest values in the live tours when the limits were set.
	const published = {
		title: 57,
		shortDescription: 207,
		highlight: 80,
		location: 8,
		experienceType: 15,
		dayTitle: 38,
		daySummary: 92,
		dayDescription: 466,
		activity: 61,
		meals: 25,
		stayName: 35,
		dayPhotos: 3,
		listItem: 72,
		altText: 51
	} as const;
	for (const [field, length] of Object.entries(published)) {
		assert.ok(TOUR_LIMITS[field as keyof typeof published] >= length, `${field} ${length}`);
	}
	assert.ok(TOUR_LIMITS.seoTitle.max >= 56);
	// 165 is past the 160 search target: a warning, never a block.
	assert.ok(TOUR_LIMITS.metaDescription.max >= 165);
	assert.ok(TOUR_LIMITS.metaDescription.target < 165);
});

test('rich text is counted as the reader sees it', () => {
	assert.equal(richTextLength('<p><strong>Big</strong> five</p><p>Crater</p>'), 'Big five Crater'.length);
	assert.equal(richTextLength('<ul><li>Walk</li><li>Drive</li></ul>'), 'Walk Drive'.length);
	assert.equal(richTextLength('Lions &amp; leopards&nbsp;at dusk'), 'Lions & leopards at dusk'.length);
	assert.equal(richTextLength('Line one<br>line two'), 'Line one line two'.length);
	// A bare "<" is text, not the start of a tag.
	assert.equal(richTextLength('Children under < 5 years'), 'Children under < 5 years'.length);
	assert.equal(richTextLength('  plain\n\n text  '), 'plain text'.length);
	assert.equal(richTextLength(null), 0);
	assert.equal(richTextLength('<p></p>'), 0);
});

test('counters turn amber past a soft target and red past the cap', () => {
	const { target, max } = TOUR_LIMITS.metaDescription;
	assert.equal(limitTone(target, max, target), 'ok');
	assert.equal(limitTone(target + 1, max, target), 'soft');
	assert.equal(limitTone(max, max, target), 'soft');
	assert.equal(limitTone(max + 1, max, target), 'over');
	assert.equal(limitTone(10, 10), 'ok');
	assert.equal(limitTone(11, 10), 'over');
});
