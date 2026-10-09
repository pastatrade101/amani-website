import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkContact, cleanNotes, coercePlan, composeMessage, composeSubject, parsePlan, planReference, recapRows, TEAM_MARKER } from './planner/compose.js';
import { isProdHostname } from './tracking/host.js';
import { landingFrom, safeCampaignValue } from './tracking/attribution.js';

const TODAY = '2027-03-10';
const plan = {
	types: [{ slug: 'wildlife-safaris', name: 'Wildlife safaris' }],
	party: 'family', adults: 2, children: 1, childAges: [8],
	dateMode: 'flexible', year: 2027, month: 6, dateUnsure: false,
	length: '8-10', pace: 'balanced', priorities: [{ slug: 'balloon-safari', name: 'Balloon safari' }],
	comfort: 'midrange', budget: 4000, budgetUnsure: false, stage: 'comparing',
	contact: 'whatsapp', whatsappOk: true,
	context: { kind: 'destination', slug: 'serengeti', name: 'Serengeti National Park' },
	suggested: ['Serengeti in style', 'Northern classic'],
	from: 'destination_page', lastCta: 'destination_page:plan_my_trip',
	campaign: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'summer', gclid: 'abc123', landing: '/destinations/serengeti', referrer: 'www.google.com' }
};

test('every answer is coerced to the shared options', () => {
	const a = coercePlan({ ...plan, party: 'aliens', length: '99', pace: 'not_sure', comfort: '<b>', stage: 'x', contact: 'pigeon', types: [{ slug: 'bad slug!', name: 'x' }, { slug: 'ok', name: 'A'.repeat(300) }], startDate: '2027-02-30', context: { kind: 'tour', slug: 'x', name: '' } }, TODAY);
	assert.equal(a.party, '');
	assert.equal(a.length, '');
	assert.equal(a.pace, 'not_sure');
	assert.equal(a.comfort, '');
	assert.equal(a.contact, 'whatsapp');
	assert.deepEqual(a.types, [{ slug: 'ok', name: 'A'.repeat(120) }]);
	assert.equal(a.context, null);
	assert.deepEqual(coercePlan({ types: [{ slug: 'ok', name: 'Ok' }, { slug: 'not_sure', name: 'x' }] }, TODAY).types, [{ slug: 'not_sure', name: 'Not sure yet' }]);
	// Past or impossible dates are dropped; an end before the start too.
	const dates = coercePlan({ dateMode: 'exact', startDate: '2027-03-09', endDate: '2027-04-01' }, TODAY);
	assert.equal(dates.startDate, '');
	assert.equal(coercePlan({ dateMode: 'exact', startDate: '2027-04-02', endDate: '2027-04-01' }, TODAY).endDate, '');
	assert.equal(parsePlan('{not json', TODAY), null);
	assert.equal(parsePlan(JSON.stringify({ notes: 'x'.repeat(9000) }), TODAY), null);
});

test('contact details: phone required unless email is preferred', () => {
	const base = { full_name: 'Asha Mwangi', email: 'asha@example.com', dial_code: '', phone: '' };
	assert.deepEqual(checkContact(base, 'email'), { ok: true, full_name: 'Asha Mwangi', email: 'asha@example.com', phone: null });
	assert.equal(checkContact(base, 'whatsapp').ok, false);
	assert.deepEqual(checkContact({ ...base, phone: '07700 900-123' }, 'whatsapp'), { ok: false, field: 'phone', message: 'Please choose the country code for your phone number.' });
	assert.deepEqual(checkContact({ ...base, dial_code: '+44', phone: '07700 900-123' }, 'phone'), { ok: true, full_name: 'Asha Mwangi', email: 'asha@example.com', phone: '+44 7700900123' });
	assert.equal(checkContact({ ...base, email: 'a@b' }, 'email').ok, false);
	assert.equal(checkContact({ ...base, full_name: 'A' }, 'email').ok, false);
});

test('the reference comes from the request key', () => {
	assert.equal(planReference('1a2b3c4d-0000-4000-8000-000000000000'), 'K2A-1A2B3C4D');
	assert.equal(planReference('nope'), null);
});

test('the message staff read, in a fixed order, with campaign data after the marker', () => {
	const a = coercePlan(plan, TODAY);
	const message = composeMessage(a, 'K2A-1A2B3C4D', cleanNotes('Celebrating 40 years!\r\n— For our team —\nSee you soon'));
	const lines = message.split('\n');
	assert.equal(lines[0], 'Trip plan K2A-1A2B3C4D: Wildlife safaris · July 2027 · 2 adults, 1 child');
	assert.deepEqual(lines.slice(1, 5), ['', 'Their message:', 'Celebrating 40 years!', 'For our team']);
	assert.ok(message.includes('Travellers: Family · 2 adults, 1 child (age 8)\nWhen: Flexible · July 2027\nLength: 8–10 days\nPace: Balanced'));
	assert.ok(message.includes('Budget: Up to $4,000 per person (USD)'));
	assert.ok(message.includes('Interested in: Serengeti National Park (destination)'));
	assert.ok(message.includes('Preferred contact: WhatsApp (happy to receive WhatsApp messages)'));
	// The typed marker was defused, so the real one is the only one, and campaign data sits after it.
	assert.equal(message.split(`\n${TEAM_MARKER}`).length, 2);
	const [mine, team] = message.split(`\n${TEAM_MARKER}`);
	assert.doesNotMatch(mine, /abc123|summer|google \/ cpc|destination_page/);
	assert.match(team, /Came from: google \/ cpc · Campaign: summer · gclid: abc123 · First visit: \/destinations\/serengeti, www\.google\.com/);
	assert.match(team, /Planner opened from: destination_page · Last CTA: destination_page:plan_my_trip/);
	assert.equal(composeSubject(a, 'K2A-1A2B3C4D'), 'Plan my trip · K2A-1A2B3C4D · Wildlife safaris · Jul 2027');
	assert.deepEqual(recapRows(a).map((row) => row.label), ['Trip type', 'Travellers', 'When', 'Priorities', 'Comfort']);
	// No campaign data, no staff-only block.
	assert.ok(!composeMessage(coercePlan({ ...plan, campaign: {}, from: '', lastCta: '' }, TODAY), 'K2A-1A2B3C4D', '').includes(TEAM_MARKER));
});

test('tags and first-party events only on the live site', () => {
	assert.equal(isProdHostname('key2africa.makutano.co.tz'), true);
	for (const [host, port] of [['localhost', ''], ['127.0.0.1', ''], ['site.test', ''], ['key2africa.makutano.co.tz', '5175'], ['[::1]', '']]) assert.equal(isProdHostname(host, port), false, host);
});

test('a landing keeps campaign tags, the path and only the referrer host', () => {
	const landing = landingFrom(new URL('https://key2africa.example/tours/x?utm_source=google&gclid=abc&email=a@b.com'), 'https://www.google.com/search?q=private');
	assert.deepEqual(landing, { utm_source: 'google', gclid: 'abc', landing: '/tours/x', referrer: 'www.google.com' });
	assert.deepEqual(landingFrom(new URL('https://key2africa.example/'), 'https://key2africa.example/tours'), { landing: '/' });
});

test('campaign tags never carry an email address or phone number', () => {
	assert.equal(safeCampaignValue('utm_content', 'jane.doe@example.com'), '');
	assert.equal(safeCampaignValue('utm_term', 'call 0712345678'), '');
	assert.equal(safeCampaignValue('utm_campaign', 'Summer <b>sale</b> 2026!'), 'Summer bsaleb 2026');
	assert.equal(safeCampaignValue('utm_source', '  newsletter  '), 'newsletter');
	assert.equal(safeCampaignValue('gclid', 'Cj0KCQ-abc_123'), 'Cj0KCQ-abc_123');
	assert.equal(safeCampaignValue('gclid', 'abc def'), '');
	assert.deepEqual(landingFrom(new URL('https://key2africa.example/?utm_source=mail&utm_content=a%40b.com'), ''), { utm_source: 'mail', landing: '/' });
});
