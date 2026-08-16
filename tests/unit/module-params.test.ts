import { describe, expect, it } from 'vitest';
import { paramNumber, unwrapModuleParams } from '../../src/internal/services/moduleParams';

/**
 * Getting at a module's params through the bridge.
 *
 * The fixture is the real dns answer from this chain's devnet, wrapped the way
 * ipc/chain.cjs wraps it: `{ ok, data: <the REST body> }`, where the REST body
 * is itself `{ params }`. A `??` chain written at the call site picked
 * `res.data` - an object, so it looked satisfied - and every field read off it
 * came back undefined. Nothing threw. The dialog showed "…" for a fee, forever.
 */

const DNS_PARAMS = {
  base_fee_dns: '1.0',
  transfer_fee_ulmn: '1000000',
  update_rate_limit_seconds: '30',
  update_pow_difficulty: 0,
  update_fee_ulmn: '10000',
};

const BRIDGE_ANSWER = { ok: true, data: { params: DNS_PARAMS } };

describe('the shapes the bridge returns', () => {
  it('reaches through ok/data/params, which is what dns sends', () => {
    expect(unwrapModuleParams(BRIDGE_ANSWER)).toEqual(DNS_PARAMS);
  });

  it('reaches through a bare REST body', () => {
    expect(unwrapModuleParams({ params: DNS_PARAMS })).toEqual(DNS_PARAMS);
  });

  it('accepts params handed over already unwrapped', () => {
    expect(unwrapModuleParams(DNS_PARAMS)).toEqual(DNS_PARAMS);
  });

  it('reaches through data without a params wrapper', () => {
    expect(unwrapModuleParams({ ok: true, data: DNS_PARAMS })).toEqual(DNS_PARAMS);
  });
});

describe('answers that carry nothing', () => {
  it('returns null for a failed call rather than its envelope', () => {
    expect(unwrapModuleParams({ ok: false, error: 'rest_base_missing' })).toBeNull();
  });

  it('returns null for nothing at all', () => {
    expect(unwrapModuleParams(null)).toBeNull();
    expect(unwrapModuleParams(undefined)).toBeNull();
    expect(unwrapModuleParams('params')).toBeNull();
  });

  it('does not loop on a self-referencing object', () => {
    const loop: Record<string, unknown> = { ok: true };
    loop.data = loop;
    expect(unwrapModuleParams(loop)).toBeNull();
  });
});

describe('reading a field', () => {
  const params = unwrapModuleParams(BRIDGE_ANSWER);

  it('parses the string the chain sends for a fee', () => {
    expect(paramNumber(params, 'updateFeeUlmn', 'update_fee_ulmn')).toBe(10000);
    expect(paramNumber(params, 'transferFeeUlmn', 'transfer_fee_ulmn')).toBe(1000000);
  });

  it('takes camelCase when that is what arrived', () => {
    expect(paramNumber({ updateFeeUlmn: 42 }, 'updateFeeUlmn', 'update_fee_ulmn')).toBe(42);
  });

  it('keeps a real zero, which is a setting and not an absence', () => {
    expect(paramNumber(params, 'updatePowDifficulty', 'update_pow_difficulty')).toBe(0);
  });

  it('returns null for an absent field, never 0', () => {
    // 0 would read as "no fee" or "no rate limit" - the answer that costs a
    // refused transaction.
    expect(paramNumber(params, 'nopeUlmn', 'nope_ulmn')).toBeNull();
    expect(paramNumber(null, 'updateFeeUlmn', 'update_fee_ulmn')).toBeNull();
  });

  it('returns null for something unparseable', () => {
    expect(paramNumber({ a: 'soon' }, 'a', 'a')).toBeNull();
    expect(paramNumber({ a: '' }, 'a', 'a')).toBeNull();
  });

  it('never returns a negative', () => {
    expect(paramNumber({ a: '-5' }, 'a', 'a')).toBe(0);
  });
});
