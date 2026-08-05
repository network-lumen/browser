/**
 * Addresses of the explorer's own pages.
 *
 * Eight functions across four files each rebuilt these strings by hand, so the
 * route shape was written out eight times and changing it would have broken
 * the seven copies nobody remembered. Only the URLs are shared here: what each
 * caller does with one differs on purpose - NetworkPage and BlockDetailPage
 * fall back to `window.location.href` when no tab opener was injected, the two
 * detail sub-views deliberately do nothing, and that difference is theirs to
 * keep.
 */

export function explorerTransactionUrl(hash: string): string {
  return `lumen://network/tx/${hash}`;
}

export function explorerBlockUrl(height: number | string): string {
  return `lumen://network/block/${height}`;
}

export function explorerAddressUrl(address: string): string {
  return `lumen://network/address/${address}`;
}
