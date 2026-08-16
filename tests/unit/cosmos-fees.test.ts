import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FEE_GAS,
  computeFeeAmount,
  feeAmountsByTier,
  hasTierChoice,
  loadChainFeeSchedule,
} from '../../src/internal/services/cosmosFees';
import { clearChainRegistryCache } from '../../src/internal/services/chainRegistry';
import type { ChainFeeSchedule } from '../../src/types/walletPage';

/**
 * What a transfer costs on a Cosmos chain.
 *
 * Every rule here exists because the alternative is a rejected broadcast or a
 * misread balance. Rounding goes up, because a fee short by a fraction is
 * refused outright. A chain publishing no fee token returns null rather than a
 * default, because a fabricated gas price fails at broadcast instead of failing
 * in the dialog where it can be explained.
 */

/** Answers the two registry files chainRegistry.ts asks for. */
function stubRegistry(chainJson: unknown) {
  const get = vi.fn(async (url: string) => {
    if (String(url).endsWith('chain.json')) return { ok: true, json: chainJson };
    return { ok: true, json: { assets: [] } };
  });
  (window as any).lumen = { http: { get } };
  return get;
}

function schedule(over: Partial<ChainFeeSchedule> = {}): ChainFeeSchedule {
  return { denom: 'uosmo', low: 0.03, average: 0.1, high: 0.16, ...over };
}

beforeEach(() => {
  localStorage.clear();
  clearChainRegistryCache();
});

afterEach(() => {
  delete (window as any).lumen;
  vi.restoreAllMocks();
});

describe('loadChainFeeSchedule', () => {
  it('reads the three gas prices a chain publishes', async () => {
    stubRegistry({
      fees: {
        fee_tokens: [
          { denom: 'uosmo', low_gas_price: 0.03, average_gas_price: 0.1, high_gas_price: 0.16 },
        ],
      },
    });

    await expect(loadChainFeeSchedule('osmosis')).resolves.toEqual({
      denom: 'uosmo',
      low: 0.03,
      average: 0.1,
      high: 0.16,
    });
  });

  it('is null for a chain that publishes no fee token', async () => {
    stubRegistry({ chain_name: 'somewhere' });
    await expect(loadChainFeeSchedule('somewhere')).resolves.toBeNull();
  });

  it('is null when the fee token has no denom to pay in', async () => {
    stubRegistry({ fees: { fee_tokens: [{ average_gas_price: 0.1 }] } });
    await expect(loadChainFeeSchedule('somewhere')).resolves.toBeNull();
  });

  it('is null when a denom is quoted with no price at all', async () => {
    stubRegistry({ fees: { fee_tokens: [{ denom: 'uxyz' }] } });
    await expect(loadChainFeeSchedule('somewhere')).resolves.toBeNull();
  });

  it('spreads a single published price across all three tiers', async () => {
    stubRegistry({ fees: { fee_tokens: [{ denom: 'uakt', average_gas_price: 0.025 }] } });

    await expect(loadChainFeeSchedule('akash')).resolves.toEqual({
      denom: 'uakt',
      low: 0.025,
      average: 0.025,
      high: 0.025,
    });
  });

  it('accepts a chain that only sets a fixed minimum', async () => {
    stubRegistry({ fees: { fee_tokens: [{ denom: 'untrn', fixed_min_gas_price: 0.0053 }] } });

    const result = await loadChainFeeSchedule('neutron');
    expect(result?.average).toBe(0.0053);
  });

  it('keeps a genuine zero rather than reading it as missing', async () => {
    stubRegistry({ fees: { fee_tokens: [{ denom: 'ulmn', average_gas_price: 0 }] } });

    const result = await loadChainFeeSchedule('lumen');
    expect(result).toEqual({ denom: 'ulmn', low: 0, average: 0, high: 0 });
  });

  it('refuses an empty chain name instead of asking for nothing', async () => {
    const get = stubRegistry({});
    await expect(loadChainFeeSchedule('  ')).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('computeFeeAmount', () => {
  it('multiplies gas by the tier’s price', () => {
    expect(computeFeeAmount(schedule(), 'average', '250000')).toBe('25000');
    expect(computeFeeAmount(schedule(), 'low', '250000')).toBe('7500');
    expect(computeFeeAmount(schedule(), 'high', '250000')).toBe('40000');
  });

  it('rounds up, because a fee short by a fraction is refused', () => {
    // 250000 * 0.0000053 = 1.325, and paying 1 would be under the minimum.
    expect(computeFeeAmount(schedule({ average: 0.0000053 }), 'average', '250000')).toBe('2');
    // A fraction below one base unit still has to cost one.
    expect(computeFeeAmount(schedule({ average: 0.000000001 }), 'average', '250000')).toBe('1');
  });

  it('handles a chain quoting gas in 18-decimal units without losing precision', () => {
    expect(computeFeeAmount(schedule({ denom: 'inj', average: 160000000 }), 'average', '250000'))
      .toBe('40000000000000');
  });

  it('defaults to the gas the wallet already sends', () => {
    expect(computeFeeAmount(schedule(), 'average')).toBe(
      computeFeeAmount(schedule(), 'average', DEFAULT_FEE_GAS)
    );
  });

  it('is zero for a chain that charges nothing', () => {
    expect(computeFeeAmount(schedule({ average: 0 }), 'average')).toBe('0');
  });

  it('is zero rather than NaN for unusable gas', () => {
    expect(computeFeeAmount(schedule(), 'average', 'abc')).toBe('0');
    expect(computeFeeAmount(schedule(), 'average', '-1')).toBe('0');
  });
});

describe('feeAmountsByTier', () => {
  it('prices every tier at once', () => {
    expect(feeAmountsByTier(schedule(), '250000')).toEqual({
      low: '7500',
      average: '25000',
      high: '40000',
    });
  });
});

describe('hasTierChoice', () => {
  it('is false when the chain quotes one rate for everything', () => {
    expect(hasTierChoice(schedule({ low: 0.025, average: 0.025, high: 0.025 }))).toBe(false);
  });

  it('is true when the tiers actually differ', () => {
    expect(hasTierChoice(schedule())).toBe(true);
  });
});
