import { markForTranslation } from './i18n';
import type { PaymentFrequency } from '../../types/recurringPayments';

export type { PaymentFrequency };

/**
 * How often a payment reminder repeats, in words.
 *
 * There were three vocabularies for these six values, in three files, and they
 * disagreed: the picker said `Bi-weekly`, the summary said `Every 2 weeks` and
 * the badge said `/ 2 weeks`; `Quarterly`, `Every 3 months` and `/ quarter`
 * were the same value again. Eighteen strings, three of which a translator
 * would have had to guess the relationship between.
 *
 * Two forms survive, because they are genuinely two things:
 *
 * - **`FREQUENCY_LABELS`** names the interval. It is what a picker offers and
 *   what a summary states.
 * - **`FREQUENCY_RATES`** reads as a rate beside an amount - "12.00 LMN /
 *   month" - where the noun would not fit.
 *
 * `Bi-weekly` is gone on purpose: in English it means both twice a week and
 * every two weeks, and this one is the latter.
 */
export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  daily: markForTranslation('Daily'),
  weekly: markForTranslation('Weekly'),
  biweekly: markForTranslation('Every 2 weeks'),
  monthly: markForTranslation('Monthly'),
  quarterly: markForTranslation('Quarterly'),
  yearly: markForTranslation('Yearly')
};

export const FREQUENCY_RATES: Record<PaymentFrequency, string> = {
  daily: markForTranslation('/ day'),
  weekly: markForTranslation('/ week'),
  biweekly: markForTranslation('/ 2 weeks'),
  monthly: markForTranslation('/ month'),
  quarterly: markForTranslation('/ quarter'),
  yearly: markForTranslation('/ year')
};

/** The order a picker offers them in: shortest interval first. */
export const FREQUENCY_ORDER: readonly PaymentFrequency[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly'
];

/**
 * How many times a frequency comes round in a month, for the "monthly total"
 * estimate. Quarterly and yearly are fractions on purpose: the estimate is
 * what one month of the schedule costs, not what is due this month.
 */
export const FREQUENCY_PER_MONTH: Record<PaymentFrequency, number> = {
  daily: 30,
  weekly: 4,
  biweekly: 2,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12
};

/** Unknown input is treated as monthly rather than dropped: a reminder is worth showing. */
export function frequencyLabelKey(frequency: string): string {
  return FREQUENCY_LABELS[frequency as PaymentFrequency] ?? FREQUENCY_LABELS.monthly;
}

export function frequencyRateKey(frequency: string): string {
  return FREQUENCY_RATES[frequency as PaymentFrequency] ?? FREQUENCY_RATES.monthly;
}

export function frequencyPerMonth(frequency: string): number {
  return FREQUENCY_PER_MONTH[frequency as PaymentFrequency] ?? 1;
}
