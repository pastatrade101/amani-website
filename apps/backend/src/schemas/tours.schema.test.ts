import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tourContentSchema, tourUpdateSchema } from './tours.schema';

const DAY_ID = '5b0c4f7e-9a51-4f1c-8a53-7f7d0b0f1a2b';
const LODGE_ID = 'c1f0f4a2-3d7e-4b8a-9c1d-2e3f4a5b6c7d';

const issues = (body: unknown) => {
  const result = tourContentSchema.safeParse(body);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('tour content payload', () => {
  it('reads blank fields as null and a blank id as a new day', () => {
    const result = tourContentSchema.parse({
      days: [
        {
          id: '',
          day_number: '1',
          title: ' Arrival ',
          summary: '  ',
          destination_id: '',
          travel_mode: '',
          stays: [{ safari_style: 'midrange', lodge_id: '', accommodation: 'Camp' }]
        }
      ]
    });
    const [day] = result.days!;
    assert.equal(day.id, undefined);
    assert.equal(day.day_number, 1);
    assert.equal(day.title, 'Arrival');
    assert.equal(day.summary, null);
    assert.equal(day.destination_id, null);
    assert.equal(day.travel_mode, null);
    assert.equal(day.stays![0].lodge_id, null);
  });

  it('leaves keys that were not sent out, so the save leaves them alone', () => {
    const result = tourContentSchema.parse({ days: [{ id: DAY_ID, day_number: 1, title: 'Arrival' }] });
    assert.deepEqual(Object.keys(result), ['days']);
    assert.deepEqual(Object.keys(result.days![0]).sort(), ['day_number', 'id', 'title']);
  });

  it('refuses repeated day numbers, days and stay styles', () => {
    assert.ok(issues({ days: [{ day_number: 1, title: 'One' }, { day_number: 1, title: 'Uno' }] }).some((m) => /day number/.test(m)));
    assert.ok(
      issues({ days: [{ id: DAY_ID, day_number: 1, title: 'One' }, { id: DAY_ID, day_number: 2, title: 'Two' }] }).some((m) => /listed once/.test(m))
    );
    assert.ok(
      issues({
        days: [{ day_number: 1, title: 'One', stays: [{ safari_style: 'budget', lodge_id: LODGE_ID }, { safari_style: 'budget', accommodation: 'Camp' }] }]
      }).some((m) => /one stay per day/.test(m))
    );
  });

  it('keeps to the limits: 60 days, three photos a day, one featured gallery photo', () => {
    assert.ok(issues({ days: [{ day_number: 61, title: 'Too far' }] }).length);
    assert.ok(issues({ days: [{ day_number: 1, title: 'One', image_urls: Array(3).fill('https://x.test/a.jpg') }] }).length === 0);
    assert.ok(issues({ days: [{ day_number: 1, title: 'One', image_urls: Array(4).fill('https://x.test/a.jpg') }] }).some((m) => /3 photos/.test(m)));
    assert.ok(issues({ days: [{ day_number: 1, title: 'One', stays: [{ safari_style: 'deluxe', accommodation: 'X' }] }] }).length);
    assert.ok(
      issues({
        images: [
          { image_url: 'https://x.test/a.jpg', is_featured: true },
          { image_url: 'https://x.test/b.jpg', is_featured: true }
        ]
      }).some((m) => /featured/.test(m))
    );
    assert.ok(issues({ inclusions: [' '] }).length);
    assert.ok(issues({ activity_ids: ['not-a-uuid'] }).length);
  });

  it('accepts an empty collection, which clears it', () => {
    assert.deepEqual(tourContentSchema.parse({ inclusions: [], images: [], activity_ids: [], days: [] }), {
      inclusions: [],
      images: [],
      activity_ids: [],
      days: []
    });
  });
});

describe('text limits sized to the public pages', () => {
  const day = (fields: Record<string, unknown>) => ({ days: [{ day_number: 1, title: 'Arrival', ...fields }] });
  const x = (length: number) => 'x'.repeat(length);

  it('still saves the longest text already published', () => {
    const core = tourUpdateSchema.safeParse({
      title: '6-Day Tanzania Classic: Tarangire, Serengeti & Ngorongoro',
      short_description: x(207),
      highlights: [x(80), '<p><strong>Big five</strong> on the crater floor</p>'],
      start_location: 'Arusha',
      experience_type: 'safari',
      meta_title: x(56),
      seo_title: x(56),
      // Past the 160 search target, which is only a warning in the editor.
      meta_description: x(165)
    });
    assert.equal(core.success, true);
    assert.deepEqual(
      issues({
        days: [
          {
            day_number: 1,
            title: x(38),
            summary: x(92),
            description: `<p>${x(466)}</p>`,
            meals: 'Breakfast, Lunch & Dinner',
            activities: `${x(61)}\n${x(20)}`,
            image_urls: Array(3).fill('https://x.test/a.jpg'),
            stays: [{ safari_style: 'midrange', accommodation: x(35) }]
          }
        ],
        inclusions: [x(72)],
        exclusions: [x(56)],
        images: [{ image_url: 'https://x.test/a.jpg', alt_text: x(51) }]
      }),
      []
    );
  });

  it('refuses tour text past its cap, with a message that says what to do', () => {
    const message = (body: unknown) => {
      const result = tourUpdateSchema.safeParse(body);
      return result.success ? '' : result.error.issues[0].message;
    };
    assert.match(message({ title: x(61) }), /safari title to 60 characters/);
    assert.match(message({ short_description: x(221) }), /At a glance/);
    assert.match(message({ highlights: [x(101)] }), /each highlight to 100/);
    assert.match(message({ highlights: Array(11).fill('Crater') }), /at most 10 highlights/);
    assert.match(message({ end_location: x(61) }), /locations to 60/);
    assert.match(message({ experience_type: x(41) }), /experience type to 40/);
    assert.match(message({ meta_title: x(71) }), /search title to 70/);
    assert.match(message({ meta_description: x(201) }), /meta description to 200/);
    assert.match(message({ customization_options: [x(101)] }), /customisation option to 100/);
  });

  it('measures a formatted highlight by its text, not its markup', () => {
    const formatted = `<p><strong>${x(95)}</strong></p>`;
    assert.equal(tourUpdateSchema.safeParse({ highlights: [formatted] }).success, true);
  });

  it('refuses day text past its cap', () => {
    assert.ok(issues(day({ title: x(71) })).some((m) => /day title to 70/.test(m)));
    assert.ok(issues(day({ summary: x(141) })).some((m) => /fits under the day title/.test(m)));
    assert.ok(issues(day({ meals: x(41) })).some((m) => /meals to 40/.test(m)));
    assert.ok(issues(day({ stays: [{ safari_style: 'luxury', accommodation: x(61) }] })).some((m) => /property name to 60/.test(m)));
    assert.ok(issues({ inclusions: [x(101)] }).some((m) => /included or excluded item to 100/.test(m)));
    assert.ok(issues({ exclusions: Array(21).fill('Visa') }).some((m) => /at most 20/.test(m)));
    assert.ok(issues({ images: [{ image_url: 'https://x.test/a.jpg', alt_text: x(126) }] }).some((m) => /alt text to 125/.test(m)));
    assert.ok(issues({ images: [{ image_url: 'https://x.test/a.jpg', caption: x(151) }] }).some((m) => /captions to 150/.test(m)));
  });

  it('counts the day description as text, so markup does not use up the allowance', () => {
    const paragraphs = Array(30).fill(`<p><strong>${x(90)}</strong></p>`).join('');
    assert.deepEqual(issues(day({ description: paragraphs })), []);
    assert.ok(issues(day({ description: `<p>${x(3001)}</p>` })).some((m) => /3000 characters of text/.test(m)));
  });

  it('limits activities to eight chips of 80 characters', () => {
    assert.deepEqual(issues(day({ activities: Array(8).fill(x(80)).join('\n') })), []);
    assert.ok(issues(day({ activities: Array(9).fill('Game drive').join('\n') })).some((m) => /at most 8 activities/.test(m)));
    assert.ok(issues(day({ activities: `Game drive\n${x(81)}` })).some((m) => /one chip/.test(m)));
  });
});

describe('tour budget tier', () => {
  it('takes safari style keys and still takes older free-text tiers', () => {
    assert.equal(tourUpdateSchema.parse({ budget_tier: 'midrange' }).budget_tier, 'midrange');
    assert.equal(tourUpdateSchema.parse({ budget_tier: 'Mid-range' }).budget_tier, 'Mid-range');
    assert.equal(tourUpdateSchema.safeParse({ budget_tier: 'x'.repeat(81) }).success, false);
  });
});
