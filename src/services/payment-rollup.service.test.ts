import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paymentStatusFor } from './payment-rollup.service';

/**
 * This decides what a traveller is told about their own money on the trip page,
 * so every edge here is one a real person would read as either reassuring or
 * alarming — and being wrong in the reassuring direction is the worse failure.
 */

describe('payment status', () => {
  it('is unpaid when nothing has arrived', () => {
    assert.equal(paymentStatusFor(4000, 0, 0), 'unpaid');
  });

  it('is partially paid on a deposit', () => {
    assert.equal(paymentStatusFor(4000, 1200, 0), 'partially_paid');
  });

  it('is paid when the balance is settled', () => {
    assert.equal(paymentStatusFor(4000, 4000, 0), 'paid');
  });

  it('is paid on an overpayment rather than stuck', () => {
    assert.equal(paymentStatusFor(4000, 4200, 0), 'paid');
  });

  it('tolerates a rounding artefact', () => {
    // Currency conversion between providers rounds. A booking must not sit at
    // partially_paid over a third of a cent nobody can pay off.
    assert.equal(paymentStatusFor(4000, 3999.997, 0), 'paid');
  });

  it('does not round away a real outstanding amount', () => {
    assert.equal(paymentStatusFor(4000, 3999, 0), 'partially_paid');
  });

  it('reports refunded once the money has gone back', () => {
    assert.equal(paymentStatusFor(4000, 4000, 4000), 'refunded');
  });

  it('falls back to partially paid on a partial refund', () => {
    // Still holding some of their money, so 'refunded' would be a lie and
    // 'paid' would be a worse one.
    assert.equal(paymentStatusFor(4000, 4000, 1500), 'partially_paid');
  });

  it('never claims paid when there is no figure to settle against', () => {
    // Money has arrived but nothing here knows what the trip costs. Claiming
    // 'paid' would tell a traveller they owe nothing on no evidence at all.
    assert.equal(paymentStatusFor(null, 1200, 0), 'partially_paid');
    assert.equal(paymentStatusFor(0, 1200, 0), 'partially_paid');
  });

  it('is unpaid with no figure and no money', () => {
    assert.equal(paymentStatusFor(null, 0, 0), 'unpaid');
  });

  it('settles against the revised total, not the original', () => {
    // An amendment added a night: 4000 paid no longer clears a 4420 trip.
    assert.equal(paymentStatusFor(4420, 4000, 0), 'partially_paid');
    // An amendment removed a traveller: 3400 now clears it, and the booking
    // must not wait forever on money nobody owes.
    assert.equal(paymentStatusFor(3400, 3400, 0), 'paid');
  });
});
