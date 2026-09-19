import type { GovernanceActionField, GovernanceActionTemplate } from '../../types/networkGovernance';

/**
 * The current on-chain values, as the proposal form should show them.
 *
 * MsgUpdateParams replaces the whole Params object rather than merging, so a
 * blank form is a lie by omission: it looks like one field is being changed
 * while the message rewrites everything. Prefilled, the form shows what is
 * there and what is about to replace it, and a value left alone round-trips to
 * itself.
 *
 * Units are the trap this exists to avoid. Several fields are labelled LMN but
 * their param is in ulmn, and the builders multiply on the way out - prefilling
 * the raw figure would show a million times too much, then multiply it again.
 * Each field says what its param is and what has to happen to it, and a field
 * with no `source` is left alone.
 */

function ulmnToLmnString(raw: unknown): string {
  const n = Number.parseFloat(String(raw ?? ''));
  if (!Number.isFinite(n)) return '';
  // Trailing zeros dropped: the field is typed by hand and "0.05" reads better
  // than "0.050000", while both round-trip to the same ulmn.
  return String(Number((n / 1_000_000).toFixed(6)));
}

/**
 * A Coin's amount as LMN. The denomination is not checked: every fee on this
 * chain is in the base denom, and a form that silently dropped a coin it did
 * not recognise would prefill blank and look like "keep what is there".
 */
function coinToLmnString(raw: unknown): string {
  const coin = (raw ?? {}) as Record<string, unknown>;
  return ulmnToLmnString(coin.amount);
}

/**
 * The first entry of a repeated Coin.
 *
 * x/gov's deposits are coin lists that this chain only ever fills with one
 * entry, and the message the builder sends carries one too - so showing the
 * first is showing all of it. A list that arrived with several would lose the
 * rest, which is why the builder rebuilds the coin rather than editing it.
 */
function coinsToLmnString(raw: unknown): string {
  return Array.isArray(raw) && raw.length ? coinToLmnString(raw[0]) : '';
}

/**
 * A cosmos Dec, without its padding.
 *
 * They arrive with eighteen decimals - "0.050000000000000000" - and a form
 * field is typed by hand, so the padding is noise that also round-trips to the
 * same value. Trailing zeros go, and the dot with them when nothing is left.
 */
function decToString(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

function linesToText(raw: unknown): string {
  return Array.isArray(raw) ? raw.map((entry) => String(entry ?? '').trim()).filter(Boolean).join('\n') : '';
}

function tiersToText(raw: unknown): string {
  if (!Array.isArray(raw)) return '';
  return raw
    .map((tier) => {
      const source = (tier ?? {}) as Record<string, unknown>;
      // A max_len of 0 is the catch-all and proto3 omits it from the JSON, so
      // an absent field is a real zero here rather than missing data.
      const maxLen = Number(source.max_len ?? source.maxLen ?? 0) || 0;
      const bps = Number(source.multiplier_bps ?? source.multiplierBps ?? 0) || 0;
      return `${maxLen}:${bps}`;
    })
    .join(', ');
}

function readField(field: GovernanceActionField, params: Record<string, unknown>): string {
  const source = field.source;
  if (!source) return '';
  const raw = params[source.key];
  if (raw === undefined || raw === null) {
    // proto3 omits zero values, so an absent field is either the number 0 or
    // the empty string and nothing here can tell which. Blank is the safe
    // answer: the builder spreads the fetched params as its base, so a field
    // left blank keeps whatever the chain already holds - which is the value
    // we could not name.
    return '';
  }

  switch (source.unit) {
    case 'lmn':
      return ulmnToLmnString(raw);
    case 'coin':
      return coinToLmnString(raw);
    case 'coins':
      return coinsToLmnString(raw);
    case 'dec':
      return decToString(raw);
    case 'lines':
      return linesToText(raw);
    case 'tiers':
      return tiersToText(raw);
    default:
      return String(raw);
  }
}

export function prefillFromParams(
  template: GovernanceActionTemplate,
  params: Record<string, unknown> | null | undefined
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of template.fields) {
    values[field.key] = params ? readField(field, params) : '';
  }
  return values;
}
