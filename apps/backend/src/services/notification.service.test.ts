import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLeadFromBooking, contactRows, summaryRows, travellerCopy } from './notification.service';

/**
 * The lead builder feeds the staff email, the traveller confirmation and the
 * HubSpot sync. Anything it drops is invisible to everyone downstream, so the
 * cases that matter most are the ones where a visitor answered something and
 * nobody ever sees it.
 */

describe('buildLeadFromBooking — contextual forms (nested lead_context)', () => {
  const booking = {
    booking_code: 'GF-BKG-000101',
    full_name: 'Amina Hassan',
    email: 'amina@example.com',
    phone: '+255 700 000 000',
    number_of_adults: 2,
    number_of_children: 1,
    source: 'category_enquiry',
    special_requests: 'Ground floor room please',
    lead_context: {
      v: 1,
      form_type: 'category_enquiry',
      page: { url: 'https://goldfinch.example/safari-styles/great-migration', title: 'Great Migration Safaris' },
      category: { id: 'cat-1', name: 'Great Migration Safaris', slug: 'great-migration-safari-tanzania' },
      utm: { utm_source: 'google', utm_medium: 'cpc' },
      language: 'en',
      answers: {
        travel_month: 'February',
        trip_duration: '7-10 days',
        accommodation_style: 'Mid-range',
        migration_priority: 'Calving season',
        photography_priority: true,
        other_parks: ['Tarangire', 'Ngorongoro'],
        fly_or_drive: 'Fly-in'
      }
    }
  };

  it('reads the named fields out of the nested answers block', () => {
    const lead = buildLeadFromBooking(booking);
    assert.equal(lead.travelMonth, 'February');
    assert.equal(lead.tripDuration, '7-10 days');
    assert.equal(lead.accommodationPreference, 'Mid-range');
  });

  it('titles the lead from the category when there is no tour', () => {
    const lead = buildLeadFromBooking(booking);
    assert.equal(lead.tripTitle, 'Great Migration Safaris');
  });

  it('puts every category-specific answer in the summary', () => {
    const { summary } = buildLeadFromBooking(booking);
    assert.match(summary, /Migration priority: Calving season/);
    assert.match(summary, /Fly or drive: Fly-in/);
  });

  it('renders arrays as lists and booleans as Yes/No', () => {
    const { summary } = buildLeadFromBooking(booking);
    assert.match(summary, /Other parks: Tarangire, Ngorongoro/);
    assert.match(summary, /Photography priority: Yes/);
  });

  it('records the page the enquiry came from', () => {
    const lead = buildLeadFromBooking(booking);
    assert.equal(lead.sourcePageUrl, 'https://goldfinch.example/safari-styles/great-migration');
    assert.match(lead.summary, /Enquired from: https:\/\/goldfinch\.example/);
  });

  it('does not repeat a named field in the extras', () => {
    const { summary } = buildLeadFromBooking(booking);
    assert.equal(summary.match(/Mid-range/g)?.length, 1);
  });
});

describe('buildLeadFromBooking — older forms (flat lead_context) still work', () => {
  const legacy = {
    booking_code: 'GF-BKG-000102',
    full_name: 'John Smith',
    email: 'john@example.com',
    number_of_adults: 1,
    number_of_children: 0,
    source: 'plan_my_trip',
    lead_context: {
      destination_interest: 'Serengeti',
      travel_month: 'July',
      trip_duration: '4-6 days',
      budget_per_person: '$3,500-$5,000',
      accommodation_preference: 'Luxury',
      source_page_url: 'https://goldfinch.example/plan-my-trip'
    }
  };

  it('still reads the flat keys', () => {
    const lead = buildLeadFromBooking(legacy);
    assert.equal(lead.tripTitle, 'Serengeti');
    assert.equal(lead.travelMonth, 'July');
    assert.equal(lead.tripDuration, '4-6 days');
    assert.equal(lead.budgetRange, '$3,500-$5,000');
    assert.equal(lead.accommodationPreference, 'Luxury');
    assert.equal(lead.sourcePageUrl, 'https://goldfinch.example/plan-my-trip');
  });
});

describe('buildLeadFromBooking — tour enquiries', () => {
  it('prefers the joined tour title', () => {
    const lead = buildLeadFromBooking({
      booking_code: 'GF-BKG-000103',
      full_name: 'Sara Lee',
      email: 'sara@example.com',
      number_of_adults: 2,
      number_of_children: 0,
      tour_id: 'tour-9',
      tours: { title: '4 Day Classic Safari from Zanzibar' },
      source: 'tour_enquiry',
      lead_context: { form_type: 'tour_enquiry', tour: { id: 'tour-9', title: '4 Day Classic Safari from Zanzibar' }, answers: { how_you_like_it: 'With some changes', room_arrangement: 'Twin' } }
    });
    assert.equal(lead.tripTitle, '4 Day Classic Safari from Zanzibar');
    assert.equal(lead.tripId, 'tour-9');
    assert.match(lead.summary, /How you like it: With some changes/);
    assert.match(lead.summary, /Room arrangement: Twin/);
  });
});

describe('buildLeadFromBooking — degenerate input', () => {
  it('survives a booking with no lead_context at all', () => {
    const lead = buildLeadFromBooking({ booking_code: 'X', full_name: 'A B', email: 'a@b.co', number_of_adults: 1, number_of_children: 0 });
    assert.equal(lead.firstName, 'A');
    assert.equal(lead.lastName, 'B');
    assert.match(lead.summary, /General trip request/);
  });

  it('survives empty and null values', () => {
    const lead = buildLeadFromBooking({ lead_context: null, number_of_adults: 0, number_of_children: 0 });
    assert.equal(lead.fullName, '');
    assert.ok(typeof lead.summary === 'string');
  });

  it('drops answers whose value is blank rather than printing empty labels', () => {
    const { summary } = buildLeadFromBooking({
      full_name: 'C D', email: 'c@d.co', number_of_adults: 1, number_of_children: 0,
      lead_context: { answers: { pool_required: '', child_seats: 'Yes' } }
    });
    assert.ok(!summary.includes('Pool required:'), 'blank answer should not appear');
    assert.match(summary, /Child seats: Yes/);
  });
});

/**
 * Every form's details reach the team as a table. What matters: each
 * "Label: value" line keeps its label, a line without one is not lost, and a
 * contact detail that was not given is simply absent.
 */
describe('form details for email', () => {
  it('turns a summary into labelled rows, keeping unlabelled lines', () => {
    const rows = summaryRows('General trip request\nTravellers: 2 adults, 0 children\nNotes: Crater: yes please\n\n');
    assert.deepEqual(rows, [
      { label: 'Request', value: 'General trip request' },
      { label: 'Travellers', value: '2 adults, 0 children' },
      { label: 'Notes', value: 'Crater: yes please' }
    ]);
  });

  it('does not mistake a long sentence with a colon for a label', () => {
    const line = 'We would love to know whether the best time to visit the crater is: June';
    assert.deepEqual(summaryRows(line), [{ label: 'Request', value: line }]);
  });

  it('links email and phone, and leaves out what was not given', () => {
    const rows = contactRows('Asha Mwangi', 'asha@example.com', '+255 700 000 000');
    assert.equal(rows.find((r) => r.label === 'Email')?.href, 'mailto:asha@example.com');
    assert.equal(rows.find((r) => r.label === 'Phone')?.href, 'tel:+255700000000');
    assert.equal(rows.find((r) => r.label === 'Country')?.value, '');
  });
});

describe('travellerCopy — what a trip planner gets back of their own plan', () => {
  const plan = [
    'Trip plan K2A-1A2B3C4D: Safari · July 2027 · 2 adults',
    '',
    '— Trip plan —',
    'Comfort: Mid-range',
    '',
    '— For our team —',
    'Came from: google / cpc · gclid: abc123',
    'Planner opened from: tour_page'
  ].join('\n');

  it('cuts the staff-only campaign block', () => {
    const copy = travellerCopy(plan);
    assert.match(copy, /Comfort: Mid-range$/);
    assert.doesNotMatch(copy, /For our team|gclid|google \/ cpc|tour_page/);
  });

  it('cuts at the first marker, so nothing after it can reach them', () => {
    const typed = `Their message:\nSee you there\n— For our team —\nfake\n\n— For our team —\ngclid: abc123`;
    assert.equal(travellerCopy(typed), 'Their message:\nSee you there');
  });

  it('leaves an ordinary contact message whole', () => {
    assert.equal(travellerCopy('Hello, two of us in July.\n\nTravelers: 2'), 'Hello, two of us in July.\n\nTravelers: 2');
  });
});
