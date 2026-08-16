import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatDenom,
  formatMicroAmount,
  formatNumber,
  formatTimeOfDay,
  shortenAddress,
  shortenIpnsId,
  truncateMiddle,
} from '../../src/internal/services/format';

/**
 * How every page draws a date, an amount and an identifier.
 *
 * These exist because the same value used to be drawn several ways at once -
 * an address was cut 12/8, 10/8, 10/6 and 8/6 depending on the file. So the
 * tests pin the *decisions* (which lengths, which placeholder, seconds versus
 * milliseconds) rather than restating the formatting calls.
 */

const EM_DASH = '—';

describe('date formatting', () => {
  const AUG_3_2026 = Date.UTC(2026, 7, 3, 15, 45, 0);

  it('renders a date, a date-time and a clock time', () => {
    expect(formatDate(AUG_3_2026)).toBe('Aug 3, 2026');
    expect(formatDateTime(AUG_3_2026)).toMatch(/^Aug 3, 2026, \d{2}:\d{2}\s?[AP]M$/);
    expect(formatTimeOfDay(AUG_3_2026, { locale: 'en-US' })).toMatch(/^\d{1,2}:\d{2}\s?[AP]M$/);
  });

  it('reads an epoch below 1e12 as seconds, which is what the chain sends', () => {
    // The whole reason toEpochMs exists: a chain timestamp in seconds read as
    // milliseconds lands in 1970 and every block looks 56 years old.
    const seconds = Math.floor(AUG_3_2026 / 1000);
    expect(formatDate(seconds)).toBe(formatDate(AUG_3_2026));
  });

  it('accepts a Date, an ISO string and a numeric string alike', () => {
    expect(formatDate(new Date(AUG_3_2026))).toBe('Aug 3, 2026');
    expect(formatDate('2026-08-03T15:45:00.000Z')).toBe('Aug 3, 2026');
    expect(formatDate(String(AUG_3_2026))).toBe('Aug 3, 2026');
  });

  it('shows the placeholder rather than "Invalid Date"', () => {
    for (const bad of [null, undefined, '', '   ', 'not a date', 0, -1, NaN]) {
      expect(formatDate(bad as never)).toBe(EM_DASH);
      expect(formatDateTime(bad as never)).toBe(EM_DASH);
      expect(formatTimeOfDay(bad as never)).toBe(EM_DASH);
    }
    expect(formatDate(new Date('nope'))).toBe(EM_DASH);
  });

  it('lets a call site override the placeholder and the locale', () => {
    expect(formatDate(null, { empty: 'never' })).toBe('never');
    expect(formatDate(AUG_3_2026, { intl: { month: 'long' } })).toBe('August 3, 2026');
  });
});

describe('formatNumber', () => {
  it('separates thousands', () => {
    expect(formatNumber(1204915, { locale: 'en-US' })).toBe('1,204,915');
    expect(formatNumber('1204915', { locale: 'en-US' })).toBe('1,204,915');
  });

  it('keeps zero, which is a real value and not a missing one', () => {
    expect(formatNumber(0, { locale: 'en-US' })).toBe('0');
  });

  it('shows the placeholder for missing or unreadable input', () => {
    for (const bad of [null, undefined, '', '  ', 'abc', Infinity]) {
      expect(formatNumber(bad as never)).toBe(EM_DASH);
    }
  });
});

describe('formatDecimal', () => {
  it('trims trailing zeros by default', () => {
    expect(formatDecimal(1.5)).toBe('1.5');
    expect(formatDecimal(2)).toBe('2');
  });

  it('keeps them when asked, for a column that must line up', () => {
    expect(formatDecimal(1.5, { trimTrailingZeros: false })).toBe('1.500000');
    expect(formatDecimal(2, { decimals: 2, trimTrailingZeros: false })).toBe('2.00');
  });

  it('honours the requested precision', () => {
    expect(formatDecimal(1.23456789, { decimals: 3 })).toBe('1.235');
    expect(formatDecimal(1.23456789, { decimals: 0 })).toBe('1');
  });

  it('shows the placeholder for missing or unreadable input', () => {
    for (const bad of [null, undefined, '', 'abc', NaN]) {
      expect(formatDecimal(bad as never)).toBe(EM_DASH);
    }
  });
});

describe('formatMicroAmount', () => {
  it('divides by a million, because the chain stores ulmn', () => {
    expect(formatMicroAmount(1_000_000)).toBe('1');
    expect(formatMicroAmount(1_500_000)).toBe('1.5');
    expect(formatMicroAmount('2500000')).toBe('2.5');
  });

  it('keeps a zero balance readable instead of blanking it', () => {
    expect(formatMicroAmount(0)).toBe('0');
  });

  it('does not lose a dust amount to rounding at the default precision', () => {
    expect(formatMicroAmount(1)).toBe('0.000001');
  });

  it('shows the placeholder for missing or unreadable input', () => {
    for (const bad of [null, undefined, '', 'abc']) {
      expect(formatMicroAmount(bad as never)).toBe(EM_DASH);
    }
    expect(formatMicroAmount(null, { empty: 'n/a' })).toBe('n/a');
  });
});

describe('formatDenom', () => {
  it('knows the two chain denoms by name', () => {
    expect(formatDenom('ulmn')).toBe('LMN');
    expect(formatDenom('ULMN')).toBe('LMN');
    expect(formatDenom('ulumen')).toBe('LUMEN');
  });

  it('strips the micro prefix off anything else', () => {
    expect(formatDenom('utoken')).toBe('TOKEN');
    expect(formatDenom('uatom')).toBe('ATOM');
  });

  it('leaves a denom that is not micro-prefixed alone, unless asked', () => {
    expect(formatDenom('ibc/ABC')).toBe('ibc/ABC');
    expect(formatDenom('ibc/ABC', { uppercaseFallback: true })).toBe('IBC/ABC');
  });

  it('gives an empty string for no denom', () => {
    expect(formatDenom('')).toBe('');
  });
});

describe('formatBytes', () => {
  it('steps up the unit and keeps bytes whole', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });

  it('stops at GB rather than inventing a unit', () => {
    expect(formatBytes(1024 ** 4)).toBe('1024.0 GB');
  });

  it('treats zero and negatives as nothing to show', () => {
    expect(formatBytes(0)).toBe(EM_DASH);
    expect(formatBytes(-5)).toBe(EM_DASH);
    expect(formatBytes(null)).toBe(EM_DASH);
    expect(formatBytes(undefined)).toBe(EM_DASH);
  });
});

describe('truncateMiddle', () => {
  it('elides the middle of a long identifier', () => {
    expect(truncateMiddle('0123456789abcdefghijklmnop')).toBe('0123456789...ijklmnop');
  });

  it('leaves a value that would gain nothing untouched', () => {
    // Cutting here would produce a string no shorter than the original.
    expect(truncateMiddle('short')).toBe('short');
    expect(truncateMiddle('012345678901234567890')).toBe('012345678901234567890');
  });

  it('returns the empty placeholder for nothing', () => {
    expect(truncateMiddle('')).toBe('');
    expect(truncateMiddle('   ')).toBe('');
    expect(truncateMiddle(null as never, { empty: '-' })).toBe('-');
  });
});

describe('the two canonical shortenings', () => {
  it('cuts an address 12/8 - one length, everywhere', () => {
    const address = 'lmn1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu';
    const short = shortenAddress(address);
    expect(short.startsWith('lmn1qypqxpq9')).toBe(true);
    expect(short.endsWith(address.slice(-8))).toBe(true);
    expect(short).toContain('...');
  });

  it('cuts an IPNS key 8/6 with an ellipsis, since it sits inside a sentence', () => {
    const id = 'k51qzi5uqu5dkkciu33khkzbcmxtyhn376i1e83tya8kuy7z9euedzyr5nhoew';
    const short = shortenIpnsId(id);
    expect(short).toBe(`${id.slice(0, 8)}…${id.slice(-6)}`);
  });

  it('shows a dash for a missing IPNS key so the line does not collapse', () => {
    expect(shortenIpnsId('')).toBe('-');
  });

  it('leaves a short address alone rather than padding it', () => {
    expect(shortenAddress('lmn1short')).toBe('lmn1short');
  });
});
