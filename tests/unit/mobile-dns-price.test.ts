import { describe, expect, it } from 'vitest';
import { estimateRegisterPrice } from '../../platform/mobile/impl/dns-price';

/**
 * The domain price, which the chain computes and this has to match.
 *
 * There is no price endpoint - `dnsEstimateRegisterPrice` in
 * `electron/ipc/chain.cjs` reads the module params and does the arithmetic,
 * and this is a port of it. A port of a calculation is exactly the kind of
 * thing that drifts silently, and the cost of drifting downward is a
 * transaction the ante rejects for underpaying.
 */
const PARAMS = {
  min_price_ulmn_per_month: '1000000',
  domain_tiers: [
    { max_len: 3, multiplier_bps: 40000 },
    { max_len: 5, multiplier_bps: 20000 },
    { max_len: 0, multiplier_bps: 10000 }
  ],
  ext_tiers: [
    { max_len: 2, multiplier_bps: 15000 },
    { max_len: 0, multiplier_bps: 10000 }
  ]
};

describe('registration price', () => {
  it('multiplies the monthly minimum by the months and both tiers', () => {
    // "mysite" is 6 chars (no domain tier match until the open one, x1) and
    // "lmn" is 3 (past the 2-char tier, so x1 as well): a plain year.
    const q: any = estimateRegisterPrice(PARAMS, { name: 'mysite.lmn', duration_days: 365 });
    expect(q.ok).toBe(true);
    expect(q.denom).toBe('ulmn');
    // 1_000_000 x 13 months x 1 x 1. 365 days is thirteen months, not twelve -
    // months are whole and rounded up, which is the chain's rule.
    expect(q.detail.months).toBe(13);
    expect(q.amount).toBe('13000000');
    expect(q.amountLMN).toBe(13);
  });

  it('charges a short name more, through its tier', () => {
    const short: any = estimateRegisterPrice(PARAMS, { name: 'ab.lmn', duration_days: 30 });
    const long: any = estimateRegisterPrice(PARAMS, { name: 'abcdefgh.lmn', duration_days: 30 });

    // x4 for a 2-char domain against x1 for an 8-char one.
    expect(short.amount).toBe('4000000');
    expect(long.amount).toBe('1000000');
  });

  it('applies the extension tier on top of the domain tier', () => {
    // 2-char extension is x1.5, on a 4-char domain at x2: 1M x 2 x 1.5.
    const q: any = estimateRegisterPrice(PARAMS, { name: 'abcd.io', duration_days: 30 });
    expect(q.amount).toBe('3000000');
  });

  it('rounds a tier up, never down', () => {
    // 3 x 15000bps = 4.5 microtokens, and the chain charges 5. Quoting 4 would
    // underpay by a microtoken and the ante would refuse the transaction.
    const q: any = estimateRegisterPrice(
      { min_price_ulmn_per_month: '3', domain_tiers: [], ext_tiers: [{ max_len: 0, multiplier_bps: 15000 }] },
      { name: 'x.io', duration_days: 30 }
    );
    expect(q.amount).toBe('5');
  });

  it('defaults to a year when no duration is given', () => {
    const q: any = estimateRegisterPrice(PARAMS, { name: 'mysite.lmn' });
    expect(q.detail.durationDays).toBe(365);
  });

  it('accepts the name split in two, as well as joined', () => {
    const joined: any = estimateRegisterPrice(PARAMS, { name: 'mysite.lmn', duration_days: 30 });
    const split: any = estimateRegisterPrice(PARAMS, { name: 'mysite', ext: 'lmn', duration_days: 30 });
    expect(split.amount).toBe(joined.amount);
  });

  it('refuses a name with no extension rather than quoting nonsense', () => {
    expect(estimateRegisterPrice(PARAMS, { name: 'mysite' })).toEqual({
      ok: false,
      error: 'missing domain/ext'
    });
  });

  it('reports unusable params instead of quoting zero', () => {
    // Zero was what the page showed for a year: a price of 0.000000 LMN that
    // nobody could act on. A refusal at least names the problem.
    const q: any = estimateRegisterPrice({ min_price_ulmn_per_month: '0' }, { name: 'a.lmn' });
    expect(q.ok).toBe(false);
    expect(String(q.error)).toContain('min_price_ulmn_per_month');
  });
});
