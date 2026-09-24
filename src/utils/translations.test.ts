import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanTranslationFields, ensurePackageIds, fieldsFor, readPath, sourceFieldsFor, writePath } from './translations';

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

/**
 * Safari packages keep their copy in a list of blocks, so a translation is
 * keyed by a block's identity rather than its position. These pin the three
 * promises that makes: a moved block keeps its translation, a deleted block
 * takes its translation with it, and nothing that is not language is offered
 * for translating.
 */
describe('identity paths (#id)', () => {
  const page = () => ({
    sections: [
      { _id: 'faq1', type: 'faq', title: 'Questions', items: [{ _id: 'q1', question: 'Is it private?' }] },
      { _id: 'ov1', type: 'prose', title: 'Overview', body: '<p>Two days.</p>' }
    ]
  });

  it('reads a block and a row by id', () => {
    assert.equal(readPath(page(), 'sections.#ov1.title'), 'Overview');
    assert.equal(readPath(page(), 'sections.#faq1.items.#q1.question'), 'Is it private?');
  });

  it('keeps a translation on its block when the blocks are reordered', () => {
    const record = page();
    record.sections.reverse();
    writePath(record, 'sections.#ov1.title', 'Panoramica');
    assert.equal((record.sections[0] as { title: string }).title, 'Panoramica');
    assert.equal((record.sections[1] as { title: string }).title, 'Questions');
  });

  it('drops a translation whose block no longer exists instead of writing it elsewhere', () => {
    const record = page();
    writePath(record, 'sections.#deleted.title', 'Orphan');
    assert.deepEqual(
      record.sections.map((block) => (block as { title: string }).title),
      ['Questions', 'Overview']
    );
  });

  it('never replaces a whole block', () => {
    const record = page();
    writePath(record, 'sections.#ov1', 'not a block');
    assert.equal(readPath(record, 'sections.#ov1.title'), 'Overview');
  });
});

describe('safari package fields', () => {
  const legacy = () => ({
    id: 'p1',
    name: '2 Day Safari',
    hero_title: 'Two days, one wilderness',
    sections: [
      { type: 'facts', items: [{ label: 'From', value: 'Zanzibar', icon: 'pin' }] },
      { type: 'prose', title: 'Overview', body: '<p>Short and easy.</p>' },
      { type: 'gallery', images: [{ image_url: 'https://x/y.jpg', caption: 'Elephants' }] }
    ]
  });

  it('gives blocks and rows saved before ids existed the ids the editor gives them', () => {
    const record = legacy();
    ensurePackageIds(record);
    const [facts, prose] = record.sections as Array<Record<string, unknown>>;
    assert.equal(facts._id, 'b0');
    assert.equal(prose._id, 'b1');
    assert.equal((facts.items as Array<Record<string, unknown>>)[0]._id, 'r0');
  });

  it('keeps ids that are already stored', () => {
    const record = legacy();
    (record.sections[1] as Record<string, unknown>)._id = 'kept';
    ensurePackageIds(record);
    assert.equal((record.sections[1] as Record<string, unknown>)._id, 'kept');
  });

  it('offers the words in each block and nothing else', () => {
    const source = sourceFieldsFor('safari_packages', legacy());
    assert.equal(source.name, '2 Day Safari');
    assert.equal(source['sections.#b0.items.#r0.label'], 'From');
    assert.equal(source['sections.#b0.items.#r0.value'], 'Zanzibar');
    assert.equal(source['sections.#b1.body'], '<p>Short and easy.</p>');
    assert.equal(source['sections.#b2.images.#r0.caption'], 'Elephants');
    // Photos and icons are the same in every language.
    assert.ok(!Object.keys(source).some((key) => key.endsWith('.image_url') || key.endsWith('.icon')));
  });

  it('groups block fields under the block they belong to', () => {
    const fields = fieldsFor('safari_packages', legacy());
    assert.equal(fields.find((field) => field.key === 'sections.#b1.body')?.group, 'Overview — Overview');
    assert.ok(fields.filter((field) => field.key.startsWith('sections.')).every((field) => !field.required));
  });

  it('accepts block keys only when it knows the record', () => {
    const input = { name: 'Safari di 2 giorni', 'sections.#b1.title': 'Panoramica', 'sections.#nope.title': 'x' };
    assert.deepEqual(Object.keys(cleanTranslationFields('safari_packages', input, legacy())).sort(), [
      'name',
      'sections.#b1.title'
    ]);
    assert.deepEqual(Object.keys(cleanTranslationFields('safari_packages', input)), ['name']);
  });
});
