import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const networks = require_('../../electron/chain/networks.cjs');

import {
  clearLumenNetworkCache,
  explorerAccountUrl,
  listLumenNetworks,
  loadLumenNetwork,
  setLumenNetwork
} from '../../src/internal/services/lumenNetwork';

/**
 * Which Lumen the app is on.
 *
 * The whole point of this module is that there is one answer to that question.
 * Before it there were three - peers.txt, the Cosmos registry, and an explorer
 * URL written into an href - and `lumen://network` could sit on the testnet
 * while `lumen://wallet` read mainnet balances for the same account.
 */

function bridge(net: Record<string, unknown> | null) {
  (window as any).lumen = net ? { net } : {};
}

beforeEach(() => {
  clearLumenNetworkCache();
});

afterEach(() => {
  delete (window as any).lumen;
  clearLumenNetworkCache();
});

describe('the network table', () => {
  it('knows mainnet and testnet apart by chain id', () => {
    expect(networks.getNetwork('mainnet').chainId).toBe('lumen');
    expect(networks.getNetwork('testnet').chainId).toBe('lumen-testnet');
  });

  it('falls back to mainnet for anything it does not recognise', () => {
    expect(networks.normalizeNetworkId('devnet')).toBe('mainnet');
    expect(networks.normalizeNetworkId('')).toBe('mainnet');
    expect(networks.normalizeNetworkId(null)).toBe('mainnet');
  });

  it('says no to an unknown id rather than coercing it', () => {
    // setSettings refuses on this: silently writing mainnet is how someone
    // broadcasts for real a transaction they believed was a test.
    expect(networks.isNetworkId('testnet')).toBe(true);
    expect(networks.isNetworkId('mainnnet')).toBe(false);
  });

  it('builds an account page only where one exists', () => {
    expect(networks.explorerAccountUrl('mainnet', 'lmn1abc')).toContain('lmn1abc');
    // No public testnet explorer: an empty string means "offer no link", and
    // pointing at the mainnet explorer would show every address as unfunded.
    expect(networks.explorerAccountUrl('testnet', 'lmn1abc')).toBe('');
    expect(networks.explorerAccountUrl('mainnet', '')).toBe('');
  });
});

describe('reading the active network from the renderer', () => {
  it('asks the main process and keeps the answer', async () => {
    const getNetwork = vi.fn().mockResolvedValue({
      ok: true,
      network: { id: 'testnet', chainId: 'lumen-testnet', rest: ['https://r.test'], rpc: [] }
    });
    bridge({ getNetwork });

    expect((await loadLumenNetwork()).chainId).toBe('lumen-testnet');
    await loadLumenNetwork();
    expect(getNetwork).toHaveBeenCalledTimes(1);
  });

  it('answers mainnet with no endpoints when the bridge is missing', async () => {
    // Reads then fail loudly rather than quietly going somewhere else.
    bridge(null);
    const network = await loadLumenNetwork();
    expect(network.chainId).toBe('lumen');
    expect(network.rest).toEqual([]);
  });

  it('retries after a failure instead of replaying it all session', async () => {
    const getNetwork = vi
      .fn()
      .mockRejectedValueOnce(new Error('ipc down'))
      .mockResolvedValue({ ok: true, network: { id: 'testnet', chainId: 'lumen-testnet' } });
    bridge({ getNetwork });

    expect((await loadLumenNetwork()).chainId).toBe('lumen');
    expect((await loadLumenNetwork()).chainId).toBe('lumen-testnet');
  });

  it('forgets the cached network when the main process says it changed', async () => {
    let notify: (() => void) | null = null;
    const getNetwork = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, network: { id: 'mainnet', chainId: 'lumen' } })
      .mockResolvedValueOnce({ ok: true, network: { id: 'testnet', chainId: 'lumen-testnet' } });
    bridge({
      getNetwork,
      onNetworkChanged: (cb: () => void) => {
        notify = cb;
        return () => {};
      }
    });

    expect((await loadLumenNetwork()).chainId).toBe('lumen');
    notify!();
    expect((await loadLumenNetwork()).chainId).toBe('lumen-testnet');
  });

  it('lists what can be switched to', async () => {
    bridge({
      getNetwork: vi.fn().mockResolvedValue({
        ok: true,
        network: { id: 'mainnet', chainId: 'lumen' },
        available: [{ id: 'mainnet' }, { id: 'testnet' }]
      })
    });
    expect((await listLumenNetworks()).map((n) => n.id)).toEqual(['mainnet', 'testnet']);
  });
});

describe('switching', () => {
  it('drops the cache so the next read sees the new network', async () => {
    const getNetwork = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, network: { id: 'mainnet', chainId: 'lumen' } })
      .mockResolvedValueOnce({ ok: true, network: { id: 'testnet', chainId: 'lumen-testnet' } });
    bridge({ getNetwork, setNetwork: vi.fn().mockResolvedValue({ ok: true }) });

    await loadLumenNetwork();
    expect(await setLumenNetwork('testnet')).toEqual({ ok: true });
    expect((await loadLumenNetwork()).chainId).toBe('lumen-testnet');
  });

  it('keeps the cache when the switch is refused', async () => {
    const getNetwork = vi
      .fn()
      .mockResolvedValue({ ok: true, network: { id: 'mainnet', chainId: 'lumen' } });
    bridge({
      getNetwork,
      setNetwork: vi.fn().mockResolvedValue({ ok: false, error: 'invalid_lumenNetwork' })
    });

    await loadLumenNetwork();
    expect(await setLumenNetwork('nope')).toEqual({ ok: false, error: 'invalid_lumenNetwork' });
    await loadLumenNetwork();
    expect(getNetwork).toHaveBeenCalledTimes(1);
  });
});

describe('the explorer link', () => {
  it('is empty on a network that publishes no explorer', async () => {
    bridge({
      getNetwork: vi.fn().mockResolvedValue({
        ok: true,
        network: { id: 'testnet', chainId: 'lumen-testnet', explorerAccountUrl: '' }
      })
    });
    expect(await explorerAccountUrl('lmn1abc')).toBe('');
  });

  it('fills the address into the template', async () => {
    bridge({
      getNetwork: vi.fn().mockResolvedValue({
        ok: true,
        network: {
          id: 'mainnet',
          chainId: 'lumen',
          explorerAccountUrl: 'https://explorer.test/account/{address}'
        }
      })
    });
    expect(await explorerAccountUrl('lmn1abc')).toBe('https://explorer.test/account/lmn1abc');
  });
});
