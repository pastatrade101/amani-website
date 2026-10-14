import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { faqCreateSchema, faqUpdateSchema } from './faqs.schema';

const tour = '5b0c4f7e-9a51-4f1c-8a53-7f7d0b0f1a2b';
const style = '0e6a1c52-3b7d-4e2f-9c1a-2d4b6f8e0a13';
const base = { question: 'Can I combine a safari with Zanzibar?', answer: 'Yes, most guests do.' };

describe('FAQ library placements', () => {
  it('places one question on the home page and on several styles and tours at once', () => {
    const faq = faqCreateSchema.parse({ ...base, placements: { home: true, category_ids: [style], tour_ids: [tour, style] } });
    assert.deepEqual(faq.placements, { home: true, category_ids: [style], tour_ids: [tour, style], destination_ids: [] });
  });

  it('fills in a partial placement set as "not shown there"', () => {
    assert.deepEqual(faqCreateSchema.parse({ ...base, placements: {} }).placements, { home: false, category_ids: [], tour_ids: [], destination_ids: [] });
  });

  it('rejects a placement that is not an id', () => {
    assert.throws(() => faqCreateSchema.parse({ ...base, placements: { tour_ids: ['serengeti'] } }));
  });

  it('leaves placements and status alone on an update that does not mention them', () => {
    const update = faqUpdateSchema.parse({ question: 'When is the best time to visit?' });
    assert.equal('placements' in update && update.placements !== undefined, false);
    assert.equal(update.status, undefined);
  });

  it('drops the old single attachment if an old client still sends it', () => {
    const faq = faqCreateSchema.parse({ ...base, entity_type: 'tours', entity_id: tour, destination_id: tour });
    assert.equal('entity_type' in faq || 'entity_id' in faq || 'destination_id' in faq, false);
  });
});
