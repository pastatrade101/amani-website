import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyService, convertUsdAmountForDisplay, formatCurrencyAmount, validateOpenExchangeRatesPayload } from './currency.service';

test('validates an Open Exchange Rates payload', () => {
  const result = validateOpenExchangeRatesPayload({
    base: 'USD',
    timestamp: 1_725_000_000,
    rates: {
      USD: 1,
      EUR: 0.92,
      GBP: 0.78,
      TZS: 2600.5,
      KES: 129.5,
      ZAR: 18.4,
      AUD: 1.51,
      CAD: 1.36
    }
  });

  assert.equal(result.rates.USD, '1');
  assert.equal(result.rates.TZS, '2600.5');
  assert.equal(result.providerTimestamp, '2024-08-30T06:40:00.000Z');
});

test('rejects invalid provider payloads', () => {
  assert.throws(
    () => validateOpenExchangeRatesPayload({ base: 'EUR', timestamp: 1_725_000_000, rates: { USD: 1 } }),
    /not based on USD/
  );
  assert.throws(
    () =>
      validateOpenExchangeRatesPayload({
        base: 'USD',
        timestamp: 1_725_000_000,
        rates: { USD: 1, EUR: 0.92, GBP: 0.78, TZS: 2600, KES: 129, ZAR: 18, AUD: 1.5 }
      }),
    /Missing CAD/
  );
  assert.throws(
    () =>
      validateOpenExchangeRatesPayload({
        base: 'USD',
        timestamp: 1_725_000_000,
        rates: { USD: 0, EUR: 0.92, GBP: 0.78, TZS: 2600, KES: 129, ZAR: 18, AUD: 1.5, CAD: 1.36 }
      }),
    /Invalid USD/
  );
});

test('converts USD with markup and rounds by target precision', () => {
  assert.equal(convertUsdAmountForDisplay(100, '0.845', 2, 2), '86.19');
  assert.equal(convertUsdAmountForDisplay(100, '2600.55', 0, 0), '260055');
  assert.equal(convertUsdAmountForDisplay('1999.995', '1', 2, 0), '2000');
});

test('formats currency amounts with configured Intl rules', () => {
  assert.equal(formatCurrencyAmount('1234.5', 'USD'), '$1,234.50');
  assert.equal(formatCurrencyAmount('1234.5', 'TZS'), 'TSh 1,235');
});

test('recognizes supported currencies centrally', () => {
  assert.equal(currencyService.isSupported('eur'), true);
  assert.equal(currencyService.isSupported('JPY'), false);
});
