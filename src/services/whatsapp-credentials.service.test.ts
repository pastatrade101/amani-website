import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseCredentials, toPublicAccount } from './whatsapp-credentials.service';
import type { EnvAccountCredentials, WhatsAppAccountRow } from './whatsapp-credentials.service';

/**
 * Precedence is the whole feature.
 *
 * If these get it wrong a business connects their number, sees "connected",
 * and every traveller keeps hearing from whoever built the site — which looks
 * like success from the admin and is indistinguishable from a bug from the
 * outside. That is why the decision is a pure function with a real test rather
 * than a branch buried in a query.
 */

const ENV: EnvAccountCredentials = {
  phoneNumberId: 'env-phone',
  accessToken: 'env-token',
  businessAccountId: 'env-waba'
};

const EMPTY_ENV: EnvAccountCredentials = { phoneNumberId: '', accessToken: '', businessAccountId: '' };

const account = (overrides: Partial<WhatsAppAccountRow> = {}): WhatsAppAccountRow => ({
  id: 'account-1',
  waba_id: 'account-waba',
  phone_number_id: 'account-phone',
  display_phone_number: '+255 700 000 000',
  verified_name: 'Goldfinch Adventures',
  access_token_encrypted: 'sealed',
  token_source: 'embedded_signup',
  status: 'connected',
  status_detail: null,
  connected_at: '2026-08-31T00:00:00.000Z',
  connected_by: null,
  last_verified_at: null,
  ...overrides
});

const unseal = () => 'account-token';
const cannotUnseal = () => {
  throw new Error('Stored credential is not in a format this build can read.');
};

describe('chooseCredentials', () => {
  it('prefers a connected account over the environment', () => {
    const resolved = chooseCredentials(account(), ENV, unseal);

    assert.equal(resolved.source, 'connected_account');
    assert.equal(resolved.phoneNumberId, 'account-phone');
    assert.equal(resolved.businessAccountId, 'account-waba');
    assert.equal(resolved.accessToken, 'account-token');
    assert.equal(resolved.accountId, 'account-1');
    assert.equal(resolved.unavailableReason, null);
  });

  it('falls back to the environment when nothing is connected', () => {
    const resolved = chooseCredentials(null, ENV, unseal);

    assert.equal(resolved.source, 'environment');
    assert.equal(resolved.phoneNumberId, 'env-phone');
    assert.equal(resolved.accessToken, 'env-token');
    assert.equal(resolved.accountId, null);
    assert.equal(resolved.unavailableReason, null);
  });

  it('keeps using a connected account that Meta has stopped accepting', () => {
    // An 'error' row is still the account the business connected. Dropping back
    // to the environment here would put the previous number silently back on
    // the wire, which is the one failure this must never have.
    const resolved = chooseCredentials(account({ status: 'error' }), ENV, unseal);

    assert.equal(resolved.source, 'connected_account');
    assert.equal(resolved.phoneNumberId, 'account-phone');
  });

  it('refuses rather than falling back when the stored token cannot be read', () => {
    const resolved = chooseCredentials(account(), ENV, cannotUnseal);

    assert.equal(resolved.source, 'connected_account');
    assert.equal(resolved.accessToken, '');
    assert.match(resolved.unavailableReason ?? '', /CREDENTIALS_ENCRYPTION_KEY/);
    // The environment token must not leak in through the back door.
    assert.notEqual(resolved.accessToken, ENV.accessToken);
  });

  it('reports a usable reason when neither an account nor the environment is set', () => {
    const resolved = chooseCredentials(null, EMPTY_ENV, unseal);

    assert.equal(resolved.source, 'none');
    assert.equal(resolved.phoneNumberId, '');
    assert.equal(resolved.accessToken, '');
    assert.match(resolved.unavailableReason ?? '', /No WhatsApp account is connected/);
  });

  it('does not treat a half-set environment as configured', () => {
    // A phone number id with no token cannot send. Reporting it as configured
    // would turn a clear "not set up" into an opaque Meta rejection per send.
    const resolved = chooseCredentials(null, { ...EMPTY_ENV, phoneNumberId: 'env-phone' }, unseal);

    assert.equal(resolved.source, 'none');
  });
});

describe('toPublicAccount', () => {
  it('drops the ciphertext, so no response shape can carry it by accident', () => {
    const publicAccount = toPublicAccount(account()) as Record<string, unknown>;

    assert.equal('access_token_encrypted' in publicAccount, false);
    assert.equal(JSON.stringify(publicAccount).includes('sealed'), false);
    // Everything an admin needs to recognise the connection survives.
    assert.equal(publicAccount.display_phone_number, '+255 700 000 000');
    assert.equal(publicAccount.verified_name, 'Goldfinch Adventures');
    assert.equal(publicAccount.phone_number_id, 'account-phone');
  });
});
