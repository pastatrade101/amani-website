import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publicSection } from './homepage.controller';

/**
 * One rule here decides whether the CMS switch works at all.
 *
 * The homepage cannot tell "switched off" from "never created", and it has to
 * treat never-created as visible — otherwise a site whose sections have not
 * been set up yet would render nothing. So a switched-off section must still
 * come back, saying it is off. Filtering those rows out is the obvious tidy-up
 * and it silently breaks every toggle on the page, which is why it is pinned.
 */

describe('public homepage sections', () => {
  it('answers for a section that is switched off', () => {
    const section = publicSection({ section_key: 'blog_preview', is_active: false, title: 'Latest Stories' });
    assert.equal(section.section_key, 'blog_preview');
    assert.equal(section.is_active, false);
  });

  it('sends none of a switched-off section’s copy', () => {
    // Wording the client has taken down must not stay readable in the payload.
    const section = publicSection({
      section_key: 'gallery_preview',
      is_active: false,
      title: 'See the journeys before you choose',
      subtitle: 'Real published gallery moments.',
      extra_data: { eyebrow: 'Field notes in frames' }
    });
    assert.deepEqual(Object.keys(section).sort(), ['is_active', 'section_key']);
  });

  it('leaves a live section exactly as it was', () => {
    const row = { section_key: 'hero', is_active: true, title: 'Plan East Africa With Confidence' };
    assert.equal(publicSection(row), row);
  });

  it('treats a row with no flag as live', () => {
    // Older rows predate the column. Absent is not off.
    const row = { section_key: 'why_us', title: 'A Local Team' };
    assert.equal(publicSection(row), row);
  });
});
