import { loadChainRegistryBundle } from './chainRegistry';
import type { ChainFeeSchedule, FeeTier } from '../../types/walletPage';

/**
 * What a transfer costs on a Cosmos chain, read from the registry.
 *
 * Every chain prices gas in its own token, at its own rate, and publishes both
 * in `chain.json` under `fees.fee_tokens`. That file is not in the aggregated
 * directory `cosmosDirectory.ts` fetches - not one of the 221 entries carries
 * it - so the fee is read per chain from the registry proper, through the
 * bundle loader that already caches those files for a day.
 *
 * There is no guessing here on purpose. A fee below a chain's minimum is a
 * rejected transaction, and inventing a number to avoid an empty field would
 * turn a visible "cannot price this" into an invisible failure at broadcast.
 * A chain that publishes nothing returns null, and the caller refuses.
 */

/** Cosmos SDK's own default, and what the wallet already sends for Lumen. */
export const DEFAULT_FEE_GAS = '250000';

export const FEE_TIERS: FeeTier[] = ['low', 'average', 'high'];

function readGasPrice(token: any, field: string): number {
  const value = Number(token?.[field]);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

/**
 * The fee schedule for a chain, or null when it publishes none.
 *
 * Tiers fall back to one another rather than to a constant: a chain declaring
 * only `average` gets that figure for all three, which is honest, where a
 * fabricated spread would suggest a choice the chain never offered.
 */
export async function loadChainFeeSchedule(
  chainRegistryName: string
): Promise<ChainFeeSchedule | null> {
  const name = String(chainRegistryName || '').trim();
  if (!name) return null;

  const bundle = await loadChainRegistryBundle(name);
  const tokens = bundle.chain?.fees?.fee_tokens;
  const token = Array.isArray(tokens) ? tokens[0] : null;
  const denom = String(token?.denom || '').trim();
  if (!denom) return null;

  const average = readGasPrice(token, 'average_gas_price');
  const low = readGasPrice(token, 'low_gas_price');
  const high = readGasPrice(token, 'high_gas_price');
  const fixed = readGasPrice(token, 'fixed_min_gas_price');

  // Any one of them is enough to price a transfer; the others borrow it.
  const anchor = [average, low, high, fixed].find((value) => Number.isFinite(value));
  if (anchor === undefined) return null;

  return {
    denom,
    low: Number.isFinite(low) ? low : anchor,
    average: Number.isFinite(average) ? average : anchor,
    high: Number.isFinite(high) ? high : anchor
  };
}

/**
 * Gas units times the tier's price, rounded up.
 *
 * Up, because a fee short by rounding is refused outright where a fee over by
 * one base unit costs nothing worth naming - the same trade `ibcChains.ts`
 * makes for the chains it knows about.
 */
export function computeFeeAmount(
  schedule: ChainFeeSchedule,
  tier: FeeTier,
  gas: string = DEFAULT_FEE_GAS
): string {
  const gasUnits = Number(String(gas || '').trim());
  if (!Number.isFinite(gasUnits) || gasUnits <= 0) return '0';

  const price = schedule[tier];
  if (!Number.isFinite(price) || price <= 0) return '0';

  return String(Math.ceil(gasUnits * price));
}

/** The fee for each tier, for a dialog that shows what the choice costs. */
export function feeAmountsByTier(
  schedule: ChainFeeSchedule,
  gas: string = DEFAULT_FEE_GAS
): Record<FeeTier, string> {
  return {
    low: computeFeeAmount(schedule, 'low', gas),
    average: computeFeeAmount(schedule, 'average', gas),
    high: computeFeeAmount(schedule, 'high', gas)
  };
}

/** Whether the three tiers are actually different, or the chain quotes one rate. */
export function hasTierChoice(schedule: ChainFeeSchedule): boolean {
  return schedule.low !== schedule.average || schedule.average !== schedule.high;
}
