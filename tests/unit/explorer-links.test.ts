import { describe, expect, it, vi } from 'vitest';
import {
  explorerAddressUrl,
  explorerBlockUrl,
  explorerTransactionUrl,
  openExplorerUrl,
} from '../../src/internal/services/explorerLinks';

/**
 * The explorer's own route shapes.
 *
 * Eight functions across four files used to rebuild these strings by hand, so
 * changing a route would have broken the seven copies nobody remembered. The
 * tests state the routes literally on purpose: that is the contract, and a
 * test that recomputed them would agree with any change.
 */

describe('explorer URLs', () => {
  it('names the three routes', () => {
    expect(explorerTransactionUrl('ABC123')).toBe('lumen://network/tx/ABC123');
    expect(explorerBlockUrl(4815162342)).toBe('lumen://network/block/4815162342');
    expect(explorerAddressUrl('lmn1abc')).toBe('lumen://network/address/lmn1abc');
  });

  it('takes a block height as a number or a string, since both reach it', () => {
    expect(explorerBlockUrl('12345')).toBe(explorerBlockUrl(12345));
  });
});

describe('openExplorerUrl', () => {
  it('uses the injected opener when there is one', () => {
    const openInNewTab = vi.fn();
    openExplorerUrl('lumen://network/tx/ABC', openInNewTab);
    expect(openInNewTab).toHaveBeenCalledWith('lumen://network/tx/ABC');
  });

  it('falls back to this window when no opener was injected', () => {
    // NetworkPage and BlockDetailPage rely on this fallback. The two detail
    // sub-views deliberately do not call this function at all.
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { set href(value: string) { assign(value); } },
    });

    openExplorerUrl('lumen://network/block/9', null);
    expect(assign).toHaveBeenCalledWith('lumen://network/block/9');

    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
