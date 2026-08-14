import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Turning a REST params answer into something the protobuf types can read.
 *
 * The chain answers in snake_case and the generated types read camelCase and
 * nothing else - `message.baseFeeDns = object.baseFeeDns ?? ""` - so a
 * snake_case key is not rejected, it is never seen, and the field takes its
 * zero value. Governance MsgUpdateParams replaces the whole Params object, so
 * "change one fee" became "blank everything else", and proposal #1 on this
 * chain passed its vote then failed to execute with "base_fee_dns must be set".
 *
 * The fixture below is the real dns params, copied from `lumend query dns
 * params`. What makes it worth keeping is which fields survived without the
 * conversion: alpha, floor, ceiling and t - exactly the ones spelled the same
 * in both conventions.
 */

const { camelizeKeysDeep } = stubElectron().load<any>('utils/strings.cjs');

const DNS_PARAMS = {
  base_fee_dns: '1.0',
  alpha: '0.125',
  floor: '0.1',
  ceiling: '100',
  t: '50',
  grace_days: '1',
  auction_days: '1',
  transfer_fee_ulmn: '1000000',
  bid_fee_ulmn: '1000',
  domain_tiers: [
    { max_len: 4, multiplier_bps: 40000 },
    { multiplier_bps: 5000 },
  ],
  ext_tiers: [{ max_len: 3, multiplier_bps: 15000 }],
  min_price_ulmn_per_month: '2000000',
};

describe('the params the chain sends back', () => {
  it('renames every multi-word field', () => {
    const out = camelizeKeysDeep(DNS_PARAMS);
    expect(out.baseFeeDns).toBe('1.0');
    expect(out.graceDays).toBe('1');
    expect(out.transferFeeUlmn).toBe('1000000');
    expect(out.minPriceUlmnPerMonth).toBe('2000000');
  });

  it('leaves the single-word ones alone - the four that used to survive', () => {
    const out = camelizeKeysDeep(DNS_PARAMS);
    expect(out).toMatchObject({ alpha: '0.125', floor: '0.1', ceiling: '100', t: '50' });
  });

  it('keeps no snake_case key behind', () => {
    const keys = Object.keys(camelizeKeysDeep(DNS_PARAMS));
    expect(keys.filter((k) => k.includes('_'))).toEqual([]);
  });

  it('walks into arrays, because the tiers are objects too', () => {
    const out = camelizeKeysDeep(DNS_PARAMS);
    expect(out.domainTiers[0]).toEqual({ maxLen: 4, multiplierBps: 40000 });
    expect(out.extTiers[0]).toEqual({ maxLen: 3, multiplierBps: 15000 });
  });

  it('keeps a tier that omits its optional field', () => {
    expect(camelizeKeysDeep(DNS_PARAMS).domainTiers[1]).toEqual({ multiplierBps: 5000 });
  });

  it('preserves the field count, so nothing is dropped on the way', () => {
    expect(Object.keys(camelizeKeysDeep(DNS_PARAMS))).toHaveLength(Object.keys(DNS_PARAMS).length);
  });
});

describe('shapes that are values, not structures', () => {
  it('returns primitives untouched', () => {
    expect(camelizeKeysDeep('a_b')).toBe('a_b');
    expect(camelizeKeysDeep(7)).toBe(7);
    expect(camelizeKeysDeep(null)).toBe(null);
    expect(camelizeKeysDeep(undefined)).toBe(undefined);
  });

  it('leaves a Uint8Array alone rather than turning it into an object', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(camelizeKeysDeep(bytes)).toBe(bytes);
  });

  it('handles an empty object and an empty array', () => {
    expect(camelizeKeysDeep({})).toEqual({});
    expect(camelizeKeysDeep([])).toEqual([]);
  });
});

describe('key shapes', () => {
  it('collapses repeated underscores rather than leaving one behind', () => {
    expect(Object.keys(camelizeKeysDeep({ a__b: 1 }))).toEqual(['aB']);
  });

  it('uppercases a digit-led segment without inventing a letter', () => {
    expect(Object.keys(camelizeKeysDeep({ tier_2_bps: 1 }))).toEqual(['tier2Bps']);
  });

  it('leaves an already-camelCase key as it is, so a second pass is harmless', () => {
    const once = camelizeKeysDeep(DNS_PARAMS);
    expect(camelizeKeysDeep(once)).toEqual(once);
  });
});
