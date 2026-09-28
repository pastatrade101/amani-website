import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderEmail, type EmailBrand } from './email-layout';

/**
 * Every transactional email goes out in this shell. What matters: contact
 * details come from Settings and are escaped, a detail that is not set is left
 * out rather than shown empty, and staff alerts do not tell the team they
 * "contacted us about a trip".
 */

const brand: EmailBrand = {
  siteName: 'Goldfinch Adventures',
  companyName: 'Goldfinch Adventures Limited',
  tagline: "Africa's Most Trusted Travel Planning Brand",
  siteUrl: 'https://goldfinch-adventures.com',
  logoUrl: 'https://goldfinch-adventures.com/favicon1.png',
  email: 'info@goldfinch-adventures.com',
  phone: '+255673337026',
  whatsapp: '+255673337026',
  address: 'AICC Kilimajaro Wing, room 521, Arusha, Tanzania',
  mapsUrl: 'https://maps.app.goo.gl/example',
  hours: 'Mon–Sat, 8am–6pm EAT',
  socials: [{ label: 'YouTube', url: 'https://www.youtube.com/channel/x' }]
};

describe('branded email', () => {
  it('carries the logo, the contact details and a working button', () => {
    const html = renderEmail(brand, 'Thank you, Asha', '<p>We have your enquiry.</p>', { label: 'Open my trip', url: 'https://goldfinch-adventures.com/trip?t=1' });
    assert.ok(html.includes('src="https://goldfinch-adventures.com/favicon1.png"'));
    assert.ok(html.includes('mailto:info@goldfinch-adventures.com'));
    assert.ok(html.includes('https://wa.me/255673337026'));
    assert.ok(html.includes('tel:+255673337026'));
    assert.ok(html.includes('href="https://maps.app.goo.gl/example"'));
    assert.ok(html.includes('Open my trip'));
    assert.ok(html.includes('YouTube'));
  });

  it('greets travellers and tells them why they got it', () => {
    const html = renderEmail(brand, 'Thank you', '<p>Body</p>');
    assert.ok(html.includes('Warm regards'));
    assert.ok(html.includes('Questions about your trip?'));
    assert.ok(html.includes('because you contacted Goldfinch Adventures'));
  });

  it('keeps staff alerts internal', () => {
    const html = renderEmail(brand, 'New enquiry', '<p>Body</p>', undefined, { audience: 'staff' });
    assert.ok(html.includes('Internal notification'));
    assert.ok(!html.includes('Warm regards'));
    assert.ok(!html.includes('because you contacted'));
  });

  it('leaves out details Settings does not have', () => {
    const html = renderEmail({ ...brand, phone: '', whatsapp: '', address: '', hours: '', socials: [] }, 'Hi', '<p>Body</p>');
    assert.ok(!html.includes('wa.me'));
    assert.ok(!html.includes('tel:'));
    assert.ok(!html.includes('>Office<'));
    assert.ok(!html.includes('YouTube'));
    assert.ok(html.includes('mailto:info@goldfinch-adventures.com'));
  });

  it('escapes values that come from Settings', () => {
    const html = renderEmail({ ...brand, siteName: 'Gold<script>x</script>', address: '"><img src=x onerror=alert(1)>' }, 'Hi', '<p>Body</p>');
    assert.ok(!html.includes('<script>x</script>'));
    assert.ok(!html.includes('<img src=x'));
  });

  it('previews the start of the message in the inbox unless told otherwise', () => {
    assert.ok(renderEmail(brand, 'Hi', '<p>We have <strong>your</strong> enquiry.</p>').includes('We have your enquiry.'));
    assert.ok(renderEmail(brand, 'Hi', '<p>Body</p>', undefined, { preheader: 'Custom line' }).includes('Custom line'));
  });
});
