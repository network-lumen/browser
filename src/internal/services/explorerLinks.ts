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

import type { TabOpenInNewTab } from '../../types/tabNavigation';

export function explorerTransactionUrl(hash: string): string {
  return `lumen://network/tx/${hash}`;
}

export function explorerBlockUrl(height: number | string): string {
  return `lumen://network/block/${height}`;
}

export function explorerAddressUrl(address: string): string {
  return `lumen://network/address/${address}`;
}

/**
 * Opens an explorer URL in a new tab, or in this window when no opener was
 * injected. Used by the pages that want that fallback - `NetworkPage` and
 * `BlockDetailPage`. The detail sub-views deliberately do nothing instead, and
 * call `openInNewTab` themselves.
 */
export function openExplorerUrl(url: string, openInNewTab: TabOpenInNewTab | null): void {
  if (openInNewTab) {
    openInNewTab(url);
    return;
  }
  window.location.href = url;
}
