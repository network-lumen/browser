import { describe, expect, it } from 'vitest';
import {
  FREQUENCY_LABELS,
  FREQUENCY_ORDER,
  FREQUENCY_PER_MONTH,
  FREQUENCY_RATES,
  frequencyLabelKey,
  frequencyPerMonth,
  frequencyRateKey
} from '../../src/internal/services/paymentFrequency';
import type { PaymentFrequency } from '../../src/types/recurringPayments';

/**
 * The six frequencies had three vocabularies across three files, and they
 * disagreed - `Bi-weekly` / `Every 2 weeks` / `/ 2 weeks` were one value, and
 * the monthly estimate carried its own multipliers besides. What is worth
 * testing is that the tables stay in step with the type and with each other.
 */

const ALL: PaymentFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

describe('the frequency tables', () => {
  it('cover every value of the type, and nothing else', () => {
    for (const table of [FREQUENCY_LABELS, FREQUENCY_RATES, FREQUENCY_PER_MONTH]) {
      expect(Object.keys(table).sort()).toEqual([...ALL].sort());
    }
    expect([...FREQUENCY_ORDER].sort()).toEqual([...ALL].sort());
  });

  it('offers them shortest interval first', () => {
    const perMonth = FREQUENCY_ORDER.map((f) => FREQUENCY_PER_MONTH[f]);
    expect(perMonth).toEqual([...perMonth].sort((a, b) => b - a));
  });

  it('gives every value a distinct label and a distinct rate', () => {
    expect(new Set(Object.values(FREQUENCY_LABELS)).size).toBe(ALL.length);
    expect(new Set(Object.values(FREQUENCY_RATES)).size).toBe(ALL.length);
  });

  it('never says "bi-weekly", which means two different things in English', () => {
    const all = [...Object.values(FREQUENCY_LABELS), ...Object.values(FREQUENCY_RATES)];
    expect(all.filter((s) => /bi-?weekly/i.test(s))).toEqual([]);
  });
});

describe('reading a frequency', () => {
  it('answers with the label and the rate for a known value', () => {
    expect(frequencyLabelKey('biweekly')).toBe('Every 2 weeks');
    expect(frequencyRateKey('biweekly')).toBe('/ 2 weeks');
    expect(frequencyPerMonth('biweekly')).toBe(2);
  });

  it('falls back to monthly rather than dropping a reminder it cannot name', () => {
    for (const bad of ['', 'fortnightly', 'DAILY', 'every-monday']) {
      expect(frequencyLabelKey(bad)).toBe(FREQUENCY_LABELS.monthly);
      expect(frequencyRateKey(bad)).toBe(FREQUENCY_RATES.monthly);
      expect(frequencyPerMonth(bad)).toBe(1);
    }
  });

  // The old inline table used 0.33 and 0.08, which drift from a third and a
  // twelfth by enough to be visible on a large yearly subscription.
  it('spreads a quarterly and a yearly payment exactly over the months', () => {
    expect(frequencyPerMonth('quarterly') * 3).toBeCloseTo(1, 10);
    expect(frequencyPerMonth('yearly') * 12).toBeCloseTo(1, 10);
  });
});
