import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanSettingValue } from './settings.controller';

/**
 * Legal page text is edited as rich text in Settings and rendered as HTML on
 * the website, so it must be sanitised like every other rich field. Every
 * other setting is stored exactly as given.
 */
describe('cleanSettingValue', () => {
  it('sanitises a legal page body', () => {
    const cleaned = String(cleanSettingValue('legal_privacy_body', '<h2>Data</h2><p onclick="x()">Hi<script>alert(1)</script></p>'));
    assert.ok(cleaned.includes('<h2>Data</h2>'));
    assert.ok(!cleaned.includes('<script'));
    assert.ok(!cleaned.includes('onclick'));
  });

  it('keeps internal links', () => {
    assert.ok(String(cleanSettingValue('legal_terms_body', '<p>See <a href="/contact">Contact</a></p>')).includes('href="/contact"'));
  });

  it('leaves other settings untouched', () => {
    assert.equal(cleanSettingValue('legal_privacy_title', '<b>Privacy</b>'), '<b>Privacy</b>');
    assert.equal(cleanSettingValue('site_name', 'Goldfinch'), 'Goldfinch');
    assert.deepEqual(cleanSettingValue('whatsapp_display_pages', ['home']), ['home']);
  });
});
