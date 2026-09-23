/**
 * What a domain costs, computed rather than asked.
 *
 * There is no price endpoint. `dnsEstimateRegisterPrice` in
 * `electron/ipc/chain.cjs` reads `dns.getParams` and does the arithmetic
 * itself, and this is that arithmetic ported - an earlier version of the
 * mobile module invented `/lumen/dns/v1/estimate_price/…`, which no node
 * serves, so every quote came back empty and the page showed 0.000000 LMN.
 *
 * The formula, which is the whole of x/dns's PriceQuote from chain v2.0.0 on:
 *
 *   min_price_ulmn_per_month × months × domainTier × extTier
 *
 * Tiers are chosen by the length of each half of the name and applied as basis
 * points. Rounding is UP at every tier, matching the chain: quoting a
 * microtoken less than it will charge is a transaction that fails at the ante.
 */

import type { LengthTier } from '../../../src/types/platformBridge';

const TIER_BPS_DENOM = 10_000n;

/** Whole months, rounded up - a 45-day registration is charged two. */
function monthsFromDays(durationDays: number): number {
  if (!Number.isFinite(durationDays) || durationDays <= 0) return 1;
  const days = Math.floor(durationDays);
  const months = Math.floor((days + 29) / 30);
  return months > 0 ? months : 1;
}

function applyBps(amount: bigint, multiplierBps: number): bigint {
  if (amount === 0n) return amount;
  const bps = BigInt(Math.max(0, multiplierBps));
  if (bps === 0n) return 0n;
  const num = amount * bps;
  const div = num / TIER_BPS_DENOM;
  // Rounded up, as the chain does: a remainder is a microtoken owed.
  return num % TIER_BPS_DENOM === 0n ? div : div + 1n;
}

function parsePositiveBigInt(value: unknown, label: string): bigint {
  try {
    const asBig = BigInt(String(value ?? '0'));
    if (asBig <= 0n) throw new Error(`${label} must be > 0`);
    return asBig;
  } catch {
    throw new Error(`invalid ${label}`);
  }
}

/** Both naming conventions are accepted: the LCD answers in snake_case. */
function parseLengthTiers(raw: unknown): LengthTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry: any) => {
      if (!entry) return null;
      const maxLen = Number(entry.max_len ?? entry.maxLen ?? 0);
      const multiplier = Number(
        entry.multiplier_bps ?? entry.multiplierBps ?? entry.multiplier ?? 0
      );
      if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
      if (!Number.isFinite(maxLen) || maxLen < 0) {
        return { maxLen: 0, multiplierBps: multiplier };
      }
      return { maxLen, multiplierBps: multiplier };
    })
    .filter((x): x is LengthTier => !!x);
}

/** A `maxLen` of 0 means "no upper bound", so it matches any length. */
function pickTier(length: number, tiers: LengthTier[]): { multiplier: number; tier: LengthTier | null } {
  if (!tiers.length) return { multiplier: Number(TIER_BPS_DENOM), tier: null };

  for (const tier of tiers) {
    if (tier.maxLen === 0 || length <= tier.maxLen) {
      return { multiplier: tier.multiplierBps, tier };
    }
  }

  const last = tiers[tiers.length - 1];
  return {
    multiplier: Number.isFinite(last?.multiplierBps) ? last.multiplierBps : Number(TIER_BPS_DENOM),
    tier: last ?? null
  };
}

/**
 * Splits whatever the caller passed into a domain and an extension.
 *
 * The register dialog sends the whole `name.ext` as `name`, so both shapes
 * have to work.
 */
function splitName(input: { name?: string; ext?: string } | string): { domain: string; ext: string } {
  const raw = typeof input === 'string' ? input : (input?.name ?? '');
  const explicitExt = typeof input === 'object' ? String(input?.ext ?? '').trim() : '';
  const fqdn = String(raw ?? '').trim().toLowerCase();

  if (explicitExt && !fqdn.includes('.')) return { domain: fqdn, ext: explicitExt.toLowerCase() };

  const match = fqdn.match(/^([^.]+)\.([^.]+)$/);
  if (match) return { domain: match[1], ext: match[2] };
  return { domain: fqdn, ext: explicitExt.toLowerCase() };
}

/**
 * @param params the `params` object from `dns.getParams`.
 * @param input  the name, and optionally a duration in days (365 by default).
 */
export function estimateRegisterPrice(
  params: Record<string, any>,
  input: { name?: string; ext?: string; duration_days?: number; durationDays?: number; days?: number } | string
): Record<string, unknown> {
  const { domain, ext } = splitName(input);
  if (!domain || !ext) return { ok: false, error: 'missing domain/ext' };

  try {
    const durationRaw =
      typeof input === 'object'
        ? Number(input?.duration_days ?? input?.durationDays ?? input?.days) || 0
        : 0;
    const durationDays = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 365;
    const months = monthsFromDays(durationDays);

    const minPrice = parsePositiveBigInt(
      params.min_price_ulmn_per_month ?? params.minPriceUlmnPerMonth,
      'min_price_ulmn_per_month'
    );

    const domainTier = pickTier(domain.length, parseLengthTiers(params.domain_tiers ?? params.domainTiers));
    const extTier = pickTier(ext.length, parseLengthTiers(params.ext_tiers ?? params.extTiers));

    const quoted = applyBps(minPrice * BigInt(months), domainTier.multiplier);
    const amountBig = applyBps(quoted, extTier.multiplier);

    const amountNumber =
      amountBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amountBig) : null;

    return {
      ok: true,
      denom: 'ulmn',
      amount: amountBig.toString(),
      amountNumber,
      amountLMN: amountNumber == null ? null : amountNumber / 1_000_000,
      detail: {
        months,
        durationDays,
        minPriceUlmnPerMonth: minPrice.toString(),
        domainTier: domainTier.tier,
        extTier: extTier.tier,
        domainMultiplierBps: domainTier.multiplier,
        extMultiplierBps: extTier.multiplier
      }
    };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) };
  }
}
