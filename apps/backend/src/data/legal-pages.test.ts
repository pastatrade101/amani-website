import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LEGAL_DEFAULTS, LEGAL_DOCUMENTS, LEGAL_PAGE_IDS, legalDocForId, mergeLegalPage } from './legal-pages';
import { fieldsFor, missingRequiredFields, sourceFieldsFor } from '../utils/translations';

/**
 * A legal page's English is its built-in wording plus whatever Settings has
 * replaced, and that same English is what gets translated. An emptied setting
 * must fall back, never blank the page.
 */
describe('legal pages', () => {
  it('uses the built-in wording when nothing is edited', () => {
    assert.deepEqual(mergeLegalPage('terms', []), LEGAL_DEFAULTS.terms);
  });

  it('takes each edited part, keeps the rest', () => {
    const page = mergeLegalPage('privacy', [
      { setting_key: 'legal_privacy_title', setting_value: '  Privacy Notice ' },
      { setting_key: 'legal_privacy_body', setting_value: '<h2>New</h2><p>Text<script>x()</script></p>' }
    ]);
    assert.equal(page.title, 'Privacy Notice');
    assert.ok(page.body.startsWith('<h2>New</h2>'));
    assert.ok(!page.body.includes('<script'));
    assert.equal(page.intro, LEGAL_DEFAULTS.privacy.intro);
  });

  it('falls back when an edit was emptied', () => {
    const page = mergeLegalPage('cancellation', [
      { setting_key: 'legal_cancellation_title', setting_value: '   ' },
      { setting_key: 'legal_cancellation_body', setting_value: '<p></p>' }
    ]);
    assert.equal(page.title, LEGAL_DEFAULTS.cancellation.title);
    assert.equal(page.body, LEGAL_DEFAULTS.cancellation.body);
  });

  it('ignores settings of another page or an unknown part', () => {
    const page = mergeLegalPage('terms', [
      { setting_key: 'legal_privacy_title', setting_value: 'Wrong page' },
      { setting_key: 'legal_terms_colour', setting_value: 'red' }
    ]);
    assert.deepEqual(page, LEGAL_DEFAULTS.terms);
  });

  it('gives every page a distinct fixed id', () => {
    const ids = LEGAL_DOCUMENTS.map((doc) => LEGAL_PAGE_IDS[doc]);
    assert.equal(new Set(ids).size, ids.length);
    for (const doc of LEGAL_DOCUMENTS) assert.equal(legalDocForId(LEGAL_PAGE_IDS[doc]), doc);
    assert.equal(legalDocForId('00000000-0000-0000-0000-000000000000'), null);
  });

  it('offers every part for translation, with the body as rich text', () => {
    const record = { id: LEGAL_PAGE_IDS.privacy, ...LEGAL_DEFAULTS.privacy };
    const source = sourceFieldsFor('legal_pages', record);
    assert.deepEqual(Object.keys(source).sort(), ['body', 'intro', 'meta_description', 'title', 'updated']);
    assert.equal(fieldsFor('legal_pages', record).find((f) => f.key === 'body')?.kind, 'rich');
    assert.deepEqual(missingRequiredFields('legal_pages', { title: 'Sera ya Faragha' }, source), ['Page text']);
  });
});
