import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { itineraryCreateSchema, itineraryUpdateSchema } from './itineraries.schema';

const TOUR_ID = '5b0c4f7e-9a51-4f1c-8a53-7f7d0b0f1a2b';

const messages = (body: unknown) => {
  const result = itineraryUpdateSchema.safeParse(body);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('itinerary day text limits', () => {
  it('takes a day that fits the timeline', () => {
    const result = itineraryCreateSchema.safeParse({
      tour_id: TOUR_ID,
      day_number: 1,
      title: 'Arusha to Tarangire National Park',
      summary: "Leave Arusha after breakfast for a first afternoon among Tarangire's elephants and baobabs.",
      description: '<p>Game drive.</p>',
      accommodation: 'Four Seasons Safari Lodge Serengeti',
      meals: 'Breakfast, Lunch & Dinner',
      activities: 'Game drive\nSundowner',
      image_urls: Array(3).fill('https://x.test/a.jpg')
    });
    assert.equal(result.success, true);
  });

  it('keeps to the same limits as the tour editor', () => {
    assert.ok(messages({ title: 'x'.repeat(71) }).some((m) => /day title to 70/.test(m)));
    assert.ok(messages({ summary: 'x'.repeat(141) }).some((m) => /under the day title/.test(m)));
    assert.ok(messages({ description: 'x'.repeat(3001) }).some((m) => /3000 characters of text/.test(m)));
    assert.ok(messages({ accommodation: 'x'.repeat(61) }).some((m) => /property name to 60/.test(m)));
    assert.ok(messages({ meals: 'x'.repeat(41) }).some((m) => /meals to 40/.test(m)));
    assert.ok(messages({ activities: Array(9).fill('Walk').join('\n') }).some((m) => /at most 8/.test(m)));
    assert.ok(messages({ image_urls: Array(4).fill('https://x.test/a.jpg') }).some((m) => /3 photos/.test(m)));
  });

  it('still clears optional text with null', () => {
    assert.deepEqual(messages({ description: null, activities: null, meals: null, accommodation: null }), []);
  });
});
