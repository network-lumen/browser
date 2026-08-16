import { beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

/**
 * Which chain id a transaction is signed for.
 *
 * A Cosmos signature covers the chain id, so the wrong one produces bytes the
 * chain refuses with "signature verification failed; please verify account
 * number (9) and chain-id (lumen-devnet-1)" - a message that points at the
 * account and the key, neither of which is at fault. Four gateway handlers used
 * the literal 'lumen' while the wallet asked the peer pool, which is why
 * sending tokens worked and creating a gateway never did.
 *
 * The peer pool is planted in the CommonJS cache the way electronStub plants
 * electron: `vi.mock` reaches ESM imports, and this module is required.
 */

const require_ = createRequire(import.meta.url);

const pool = {
  chainId: null as string | null,
  networkChainId: null as string | null,
  throwOnPeer: false,
  getBestPeer(): { chainId: string | null } | null {
    if (pool.throwOnPeer) throw new Error('no pool yet');
    return pool.chainId === null ? null : { chainId: pool.chainId };
  },
};

const poolId = require_.resolve('../../electron/daemons/peers/pool_singleton.cjs');
require_.cache[poolId] = {
  id: poolId,
  filename: poolId,
  loaded: true,
  exports: { getNetworkPool: () => pool },
} as NodeJS.Module;

const { resolveChainId } = require_('../../electron/chain/chain_id.cjs');

beforeEach(() => {
  pool.chainId = null;
  pool.networkChainId = null;
  pool.throwOnPeer = false;
});

describe('what the network says', () => {
  it('takes the id from the peer it would broadcast through', () => {
    pool.chainId = 'lumen-devnet-1';
    expect(resolveChainId()).toBe('lumen-devnet-1');
  });

  it('falls back to the pool when the peer has not reported one yet', () => {
    pool.chainId = '';
    pool.networkChainId = 'lumen-1';
    expect(resolveChainId()).toBe('lumen-1');
  });
});

describe('what a caller says', () => {
  it('wins, because a cross-chain send names its own', () => {
    pool.chainId = 'lumen-devnet-1';
    expect(resolveChainId('beezee-1')).toBe('beezee-1');
  });

  it('is ignored when blank, rather than blanking the answer', () => {
    pool.chainId = 'lumen-devnet-1';
    expect(resolveChainId('   ')).toBe('lumen-devnet-1');
    expect(resolveChainId(undefined)).toBe('lumen-devnet-1');
  });
});

describe('when nothing knows', () => {
  it('returns undefined rather than a guess', () => {
    // A literal here is what invalidated every gateway signature: undefined
    // lets the SDK ask the node, a wrong name fails verification silently.
    expect(resolveChainId()).toBeUndefined();
  });

  it('returns undefined when the pool itself throws', () => {
    pool.throwOnPeer = true;
    expect(resolveChainId()).toBeUndefined();
  });
});
