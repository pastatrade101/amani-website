import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TOUR_LIMITS, activityLines, activityProblems, richTextLength } from './tour-limits';

describe('tour text limits', () => {
  it('counts rich text as the reader sees it', () => {
    assert.equal(richTextLength('<p><strong>Big</strong> five</p><p>Crater</p>'), 'Big five Crater'.length);
    assert.equal(richTextLength('Lions &amp; leopards'), 'Lions & leopards'.length);
    assert.equal(richTextLength('Children under < 5 years'), 'Children under < 5 years'.length);
    assert.equal(richTextLength(null), 0);
  });

  it('reads activities one per line', () => {
    assert.deepEqual(activityLines(' Game drive \n\nSundowner\r\n'), ['Game drive', 'Sundowner']);
    assert.deepEqual(activityProblems('Game drive\nSundowner'), []);
    assert.equal(activityProblems(Array(TOUR_LIMITS.activities + 1).fill('Walk').join('\n')).length, 1);
  });

  it('keeps each search target below its hard cap', () => {
    assert.ok(TOUR_LIMITS.seoTitle.target < TOUR_LIMITS.seoTitle.max);
    assert.ok(TOUR_LIMITS.metaDescription.target < TOUR_LIMITS.metaDescription.max);
  });
});
