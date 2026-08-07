import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECURITY_SESSION_TIMEOUT_MS,
  SECURITY_SESSION_TIMEOUT_OPTIONS,
  getSecuritySessionTimeoutCacheText,
  getSecuritySessionTimeoutHelpText,
  getSecuritySessionTimeoutIdleText,
  normalizeSecuritySessionTimeoutMs,
  parseSecuritySessionTimeoutMs,
  stringifySecuritySessionTimeoutMs,
} from '../../src/internal/services/securitySessionTimeout';

/**
 * How long the wallet password stays in memory.
 *
 * The five-minute option was removed rather than deprecated, and the way it
 * was removed is the thing to protect: a setting already stored at 300000 no
 * longer normalizes, so it falls back to the default. That lengthens nobody's
 * lock and shortens nobody's session. A future edit that made 300000 valid
 * again, or that made an unknown value normalize to `null`, would quietly
 * change how long a stolen laptop stays unlocked.
 */

const FIFTEEN_MIN = 15 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;
const TWO_HOURS = 2 * 60 * 60 * 1000;

describe('the option list', () => {
  it('starts at 15 minutes and offers until-restart', () => {
    expect(DEFAULT_SECURITY_SESSION_TIMEOUT_MS).toBe(FIFTEEN_MIN);
    expect(SECURITY_SESSION_TIMEOUT_OPTIONS.map((o) => o.value)).toEqual([
      FIFTEEN_MIN, THIRTY_MIN, TWO_HOURS, null,
    ]);
  });

  it('serialises each option to what settings.cjs validates on the way in', () => {
    expect(SECURITY_SESSION_TIMEOUT_OPTIONS.map((o) => o.serialized)).toEqual([
      '900000', '1800000', '7200000', 'restart',
    ]);
  });
});

describe('normalize', () => {
  it('accepts the three real durations', () => {
    expect(normalizeSecuritySessionTimeoutMs(FIFTEEN_MIN)).toBe(FIFTEEN_MIN);
    expect(normalizeSecuritySessionTimeoutMs(THIRTY_MIN)).toBe(THIRTY_MIN);
    expect(normalizeSecuritySessionTimeoutMs(TWO_HOURS)).toBe(TWO_HOURS);
  });

  it('keeps null, which means until restart and is not a missing value', () => {
    expect(normalizeSecuritySessionTimeoutMs(null)).toBeNull();
  });

  it('sends the retired five-minute setting to the default, not to null', () => {
    // The whole point of removing it this way. Falling through to `null` would
    // have turned every 5-minute user into an until-restart user.
    expect(normalizeSecuritySessionTimeoutMs(300_000)).toBe(FIFTEEN_MIN);
  });

  it('sends anything else to the default rather than trusting it', () => {
    for (const bad of [0, -1, 1, 999_999_999, NaN, Infinity, '900000', {}, undefined]) {
      expect(normalizeSecuritySessionTimeoutMs(bad as never)).toBe(FIFTEEN_MIN);
    }
  });

  it('honours an explicit fallback', () => {
    expect(normalizeSecuritySessionTimeoutMs('nope' as never, TWO_HOURS)).toBe(TWO_HOURS);
  });
});

describe('stringify and parse', () => {
  it('round-trip each other for every option', () => {
    for (const option of SECURITY_SESSION_TIMEOUT_OPTIONS) {
      expect(stringifySecuritySessionTimeoutMs(option.value)).toBe(option.serialized);
      expect(parseSecuritySessionTimeoutMs(option.serialized)).toBe(option.value);
    }
  });

  it('reads an unknown stored string as the default', () => {
    expect(parseSecuritySessionTimeoutMs('300000')).toBe(FIFTEEN_MIN);
    expect(parseSecuritySessionTimeoutMs('')).toBe(FIFTEEN_MIN);
    expect(parseSecuritySessionTimeoutMs('nonsense')).toBe(FIFTEEN_MIN);
  });

  it('normalizes on the way out, so an invalid value is never written back', () => {
    expect(stringifySecuritySessionTimeoutMs(300_000 as never)).toBe('900000');
  });
});

describe('the three wordings', () => {
  it('read naturally for a duration', () => {
    expect(getSecuritySessionTimeoutCacheText(THIRTY_MIN)).toBe('for 30 minutes');
    expect(getSecuritySessionTimeoutHelpText(THIRTY_MIN)).toBe('for 30 minutes');
    expect(getSecuritySessionTimeoutIdleText(THIRTY_MIN)).toBe('30 minutes of inactivity');
  });

  it('read differently for until-restart, which has no duration to state', () => {
    expect(getSecuritySessionTimeoutCacheText(null)).toBe('until restart');
    expect(getSecuritySessionTimeoutHelpText(null)).toBe('until the app restarts');
    // null, so the caller can drop the line rather than print a contradiction.
    expect(getSecuritySessionTimeoutIdleText(null)).toBeNull();
  });

  it('describe the default when given something invalid, never the retired option', () => {
    expect(getSecuritySessionTimeoutCacheText(300_000 as never)).toBe('for 15 minutes');
    expect(getSecuritySessionTimeoutIdleText(300_000 as never)).toBe('15 minutes of inactivity');
  });
});
