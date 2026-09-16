import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readPath, sourceFieldsFor, writePath } from './translations';

/**
 * Translatable fields may be a column or a dotted path into a jsonb column.
 * The path case carries one rule that is easy to lose in a refactor and
 * expensive to lose in production: a translation may fill a field in, but it
 * may never bring the structure holding that field into existence.
 */

describe('readPath', () => {
  it('reads a plain column', () => {
    assert.equal(readPath({ name: 'Family Safaris' }, 'name'), 'Family Safaris');
  });

  it('reads through a jsonb blob', () => {
    const record = { landing_page_content: { hero: { headline: 'A Safari Your Family Can Enjoy' } } };
    assert.equal(readPath(record, 'landing_page_content.hero.headline'), 'A Safari Your Family Can Enjoy');
  });

  it('is undefined when a step is missing, rather than throwing', () => {
    assert.equal(readPath({}, 'landing_page_content.hero.headline'), undefined);
    assert.equal(readPath({ landing_page_content: null }, 'landing_page_content.hero.headline'), undefined);
  });
});

describe('writePath', () => {
  it('writes into an existing blob', () => {
    const record = { landing_page_content: { hero: { headline: 'English' } } };
    writePath(record, 'landing_page_content.hero.headline', 'Italiano');
    assert.equal(record.landing_page_content.hero.headline, 'Italiano');
  });

  it('leaves the rest of the blob alone', () => {
    const record = { landing_page_content: { hero: { headline: 'English', eyebrow: 'Keep me' } } };
    writePath(record, 'landing_page_content.hero.headline', 'Italiano');
    assert.equal(record.landing_page_content.hero.eyebrow, 'Keep me');
  });

  it('refuses to create a structure that was not there', () => {
    // A category with no landing page has no landing page in any language. A
    // lone translated headline in a fabricated object is a half-formed page
    // the default language never had.
    const record: Record<string, unknown> = {};
    writePath(record, 'landing_page_content.hero.headline', 'Italiano');
    assert.deepEqual(record, {});
  });

  it('refuses when a middle step is null', () => {
    const record: Record<string, unknown> = { landing_page_content: { hero: null } };
    writePath(record, 'landing_page_content.hero.headline', 'Italiano');
    assert.deepEqual(record, { landing_page_content: { hero: null } });
  });
});

describe('sourceFieldsFor', () => {
  it('collects nested copy for translation', () => {
    const fields = sourceFieldsFor('tour_categories', {
      name: 'Family Safaris',
      short_description: 'Short',
      description: 'Long',
      landing_page_content: { hero: { headline: 'A Safari Your Family Can Enjoy', subheadline: '' } }
    });
    assert.equal(fields['landing_page_content.hero.headline'], 'A Safari Your Family Can Enjoy');
    // Empty source copy is nothing to translate, so it is not offered.
    assert.equal(fields['landing_page_content.hero.subheadline'], undefined);
  });

  it('offers nothing nested when the category has no landing page', () => {
    const fields = sourceFieldsFor('tour_categories', { name: 'Family Safaris' });
    assert.equal(Object.keys(fields).some((key) => key.includes('.')), false);
  });
});
