import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canTransition, revisedTotal } from './booking-amendments.controller';

/**
 * Two rules carry the money here, and neither is obvious from reading the
 * happy path: what an amendment is allowed to become, and which ones count
 * towards the revised price. Both decide what a traveller is eventually asked
 * to pay, so both are worth pinning down.
 */

describe('amendment transitions', () => {
  it('lets a proposal be agreed or declined', () => {
    assert.equal(canTransition('proposed', 'agreed'), true);
    assert.equal(canTransition('proposed', 'declined'), true);
  });

  it('refuses to apply something nobody agreed to', () => {
    // The transition worth blocking: it is how a change the traveller never
    // accepted reaches their invoice.
    assert.equal(canTransition('proposed', 'applied'), false);
  });

  it('applies only what was agreed first', () => {
    assert.equal(canTransition('agreed', 'applied'), true);
  });

  it('lets something agreed still fall through', () => {
    // Agreed is not a commitment to deliver — a lodge can turn out to be full
    // after everyone said yes to it.
    assert.equal(canTransition('agreed', 'declined'), true);
  });

  it('treats declined and applied as terminal', () => {
    for (const to of ['proposed', 'agreed', 'applied']) {
      assert.equal(canTransition('declined', to), false, `declined -> ${to}`);
    }
    for (const to of ['proposed', 'agreed', 'declined']) {
      assert.equal(canTransition('applied', to), false, `applied -> ${to}`);
    }
  });

  it('allows a no-op so re-saving the same status is not an error', () => {
    assert.equal(canTransition('applied', 'applied'), true);
    assert.equal(canTransition('declined', 'declined'), true);
  });

  it('refuses a status it has never heard of', () => {
    assert.equal(canTransition('proposed', 'cancelled'), false);
    assert.equal(canTransition('invented', 'agreed'), false);
  });
});

describe('revised total', () => {
  it('counts only applied amendments', () => {
    const { appliedDelta, revised } = revisedTotal(4000, [
      { status: 'applied', amount_delta: 250 },
      { status: 'agreed', amount_delta: 900 },
      { status: 'proposed', amount_delta: 100 },
      { status: 'declined', amount_delta: 5000 }
    ]);
    // A proposal is a conversation. Counting it would put a figure in front of
    // staff that nobody has agreed to.
    assert.equal(appliedDelta, 250);
    assert.equal(revised, 4250);
  });

  it('subtracts a negative delta', () => {
    const { revised } = revisedTotal(4000, [{ status: 'applied', amount_delta: -600 }]);
    assert.equal(revised, 3400);
  });

  it('ignores an applied amendment whose price is not settled', () => {
    const { appliedDelta, revised } = revisedTotal(4000, [
      { status: 'applied', amount_delta: null },
      { status: 'applied', amount_delta: 150 }
    ]);
    assert.equal(appliedDelta, 150);
    assert.equal(revised, 4150);
  });

  it('returns no total when the booking never carried a figure', () => {
    const { appliedDelta, revised } = revisedTotal(null, [{ status: 'applied', amount_delta: 250 }]);
    // 250 is the change, not the price of the trip — reporting it as a total
    // would understate what is owed by the whole original amount.
    assert.equal(appliedDelta, 250);
    assert.equal(revised, null);
  });

  it('handles numeric strings, which is how postgres returns numeric', () => {
    const { appliedDelta } = revisedTotal(4000, [
      { status: 'applied', amount_delta: '250.50' },
      { status: 'applied', amount_delta: '-50.25' }
    ]);
    assert.equal(appliedDelta, 200.25);
  });

  it('leaves the original alone when nothing is applied', () => {
    const { appliedDelta, revised } = revisedTotal(4000, [{ status: 'proposed', amount_delta: 999 }]);
    assert.equal(appliedDelta, 0);
    assert.equal(revised, 4000);
  });
});
