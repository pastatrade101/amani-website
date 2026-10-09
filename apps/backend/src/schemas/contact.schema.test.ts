import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contactCreateSchema } from './contact.schema';

/**
 * Two forms share this schema: the enquiry form, which must keep working
 * exactly as it did, and the Plan my trip planner, which adds a few optional
 * fields that are not columns.
 */

const enquiry = {
  full_name: 'Amina Hassan',
  email: 'amina@example.com',
  phone: null,
  subject: `Safari enquiry: ${'x'.repeat(200)}`,
  message: `${'m'.repeat(5000)}\n\nTravel date: Flexible\nTravelers: 2\nInterest: ${'x'.repeat(200)}`
};

describe('contactCreateSchema', () => {
  it('accepts the largest request the enquiry form can send', () => {
    assert.equal(contactCreateSchema.safeParse(enquiry).success, true);
  });

  it('accepts a trip plan with its source, reference and captcha token', () => {
    const result = contactCreateSchema.safeParse({
      ...enquiry,
      subject: 'Plan my trip · K2A-1A2B3C4D · Safari · Jul 2027',
      source: 'plan_my_trip',
      reference: 'K2A-1A2B3C4D',
      captcha_token: 'token'
    });
    assert.equal(result.success, true);
  });

  it('refuses a reference in any other shape', () => {
    for (const reference of ['K2A-1a2b3c4d', 'GF-1A2B3C4D', 'K2A-1A2B3C4D5', "K2A-%' or 1=1"]) {
      assert.equal(contactCreateSchema.safeParse({ ...enquiry, reference }).success, false, reference);
    }
  });

  it('refuses a source it does not know', () => {
    assert.equal(contactCreateSchema.safeParse({ ...enquiry, source: 'ai_handoff' }).success, false);
  });

  it('caps the free-text fields', () => {
    const over = (patch: Record<string, unknown>) => contactCreateSchema.safeParse({ ...enquiry, ...patch }).success;
    assert.equal(over({ full_name: 'n'.repeat(151) }), false);
    assert.equal(over({ email: `${'e'.repeat(250)}@example.com` }), false);
    assert.equal(over({ phone: '1'.repeat(51) }), false);
    assert.equal(over({ subject: 's'.repeat(251) }), false);
    assert.equal(over({ message: 'm'.repeat(10001) }), false);
    assert.equal(over({ captcha_token: 't'.repeat(4097) }), false);
  });

  it('still needs a name and a real message', () => {
    assert.equal(contactCreateSchema.safeParse({ ...enquiry, full_name: 'A' }).success, false);
    assert.equal(contactCreateSchema.safeParse({ ...enquiry, message: 'too short' }).success, false);
  });
});
