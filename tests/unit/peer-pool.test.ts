import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { PeerPool, parseBootstrapPeers } = require_('../../electron/daemons/peers/peer_pool.cjs');

/**
 * Which node the wallet talks to.
 *
 * Every signed transaction and every balance is read through a peer this
 * picks. The selection rules matter more than they look: a peer on the wrong
 * chain must never be offered, and one that has just failed must not be handed
 * back on the retry that follows.
 */
const peer = (n: number) => ({
  rpc: `https://rpc${n}.test`,
  rest: `https://rest${n}.test`,
});

function poolWith(count: number) {
  const pool = new PeerPool();
  pool.addBootstrapPeers(Array.from({ length: count }, (_, i) => peer(i + 1)));
  return pool;
}

describe('holding the peer list', () => {
  it('takes bootstrap peers and lists them', () => {
    const pool = poolWith(3);
    expect(pool.listPeers()).toHaveLength(3);
  });

  it('does not add the same rpc twice', () => {
    const pool = new PeerPool();
    pool.addBootstrapPeers([peer(1), peer(1)]);
    expect(pool.listPeers()).toHaveLength(1);
  });

  it('finds a peer by its rpc url', () => {
    const pool = poolWith(2);
    expect(pool.getPeerByRpc('https://rpc2.test')?.rest).toBe('https://rest2.test');
    expect(pool.getPeerByRpc('https://nope.test')).toBeFalsy();
  });

  it('ignores junk instead of storing it', () => {
    const pool = new PeerPool();
    pool.addBootstrapPeers([null, undefined, {}, { rest: 'no rpc' }] as never);
    expect(pool.listPeers()).toHaveLength(0);
  });
});

describe('choosing peers', () => {
  it('offers only peers that have a rest endpoint when rest is asked for', () => {
    const pool = new PeerPool();
    pool.addBootstrapPeers([
      { rpc: 'https://a.test', rest: 'https://a-rest.test' },
      { rpc: 'https://b.test' },
    ]);
    const rest = pool.pickPeers('rest', 5, { requireAlive: false });
    expect(rest.map((p: any) => p.rpc)).toEqual(['https://a.test']);
  });

  it('honours an exclusion set, which is how a retry avoids the peer that just failed', () => {
    const pool = poolWith(3);
    const picked = pool.pickPeers('rpc', 5, {
      requireAlive: false,
      exclude: new Set(['https://rpc2.test']),
    });
    expect(picked.map((p: any) => p.rpc)).not.toContain('https://rpc2.test');
  });

  it('never returns more than asked for', () => {
    const pool = poolWith(5);
    expect(pool.pickPeers('rpc', 2, { requireAlive: false })).toHaveLength(2);
  });

  it('returns nothing rather than throwing when the pool is empty', () => {
    expect(new PeerPool().pickPeers('rpc', 3, { requireAlive: false })).toEqual([]);
  });
});

describe('marking a peer', () => {
  it('accepts either the peer object or its rpc url', () => {
    const pool = poolWith(2);
    expect(pool.markFailure('https://rpc1.test')).toBe(true);
    expect(pool.markFailure(pool.getPeerByRpc('https://rpc2.test'))).toBe(true);
  });

  it('reports false for a peer it does not know, rather than inventing one', () => {
    const pool = poolWith(1);
    expect(pool.markFailure('https://stranger.test')).toBe(false);
    expect(pool.markSuspect('https://stranger.test')).toBe(false);
    expect(pool.listPeers()).toHaveLength(1);
  });

  it('stops offering a suspect peer while a clean one is available', () => {
    // readState marks the peer that disagreed on height and then comes back
    // here for its next read - if this ignored the mark, it would hand the
    // same peer straight back.
    const pool = poolWith(2);
    pool.markSuspect('https://rpc1.test', 60_000);
    const picked = pool.pickPeers('rpc', 1, { requireAlive: false });
    expect(picked.map((p: any) => p.rpc)).toEqual(['https://rpc2.test']);
  });

  it('offers a suspect peer anyway rather than nothing at all', () => {
    // A chain upgrade can have every peer diverging for a minute. Unusable is
    // worse than suspect.
    const pool = poolWith(1);
    pool.markSuspect('https://rpc1.test', 60_000);
    expect(pool.pickPeers('rpc', 1, { requireAlive: false })).toHaveLength(1);
  });

  it('holds a suspect mark forward, never shortening one already set', () => {
    // Two failures in a row must not let the second, shorter penalty undo the
    // first: the peer stays out for the longer of the two.
    const pool = poolWith(1);
    pool.markSuspect('https://rpc1.test', 60_000);
    const long = pool.getPeerByRpc('https://rpc1.test').suspectUntil;
    pool.markSuspect('https://rpc1.test', 1_000);
    expect(pool.getPeerByRpc('https://rpc1.test').suspectUntil).toBe(long);
  });
});

describe('chain identity', () => {
  it('never offers a peer known to be on another chain', () => {
    // The one that would be worst to get wrong: a signed transaction sent to
    // the wrong chain.
    const pool = poolWith(2);
    pool.networkChainId = 'lumen-1';
    pool.getPeerByRpc('https://rpc1.test').chainId = 'lumen-1';
    pool.getPeerByRpc('https://rpc2.test').chainId = 'other-1';

    const picked = pool.pickPeers('rpc', 5, { requireAlive: false });
    expect(picked.map((p: any) => p.rpc)).toEqual(['https://rpc1.test']);
  });

  it('still offers a peer whose chain is not yet known', () => {
    // Unknown is not wrong: refusing these would empty the pool at startup,
    // before anything has answered.
    const pool = poolWith(1);
    pool.networkChainId = 'lumen-1';
    expect(pool.pickPeers('rpc', 5, { requireAlive: false })).toHaveLength(1);
  });

  it('pins the chain id from the network rather than from whoever answers first', () => {
    // Latching onto the first peer to reply is fine until a peer discovered
    // from a validator's description replies first.
    const pool = new PeerPool({ networkId: 'testnet', expectedChainId: 'lumen-testnet' });
    expect(pool.networkChainId).toBe('lumen-testnet');
  });
});

describe('getBestPeer, which is what the wallet reads through', () => {
  // `pickPeers` filters on chain id and this did not, so `lumen://network` and
  // `lumen://wallet` could disagree about which chain they were on: the network
  // page reads through pickPeers, and every balance, delegation and signing
  // endpoint in ipc/chain.cjs reads through this. One foreign peer was enough,
  // because the fallbacks below reach for any peer rather than return nothing.
  const alive = (pool: any, rpc: string, patch: Record<string, unknown> = {}) => {
    Object.assign(pool.getPeerByRpc(rpc), { lastSeenAt: Date.now(), latencyMs: 10 }, patch);
  };

  it('never returns a peer on another chain, however fast it is', () => {
    const pool = poolWith(2);
    pool.networkChainId = 'lumen-testnet';
    alive(pool, 'https://rpc1.test', { chainId: 'lumen', latencyMs: 1 });
    alive(pool, 'https://rpc2.test', { chainId: 'lumen-testnet', latencyMs: 900 });

    expect(pool.getBestPeer('rpc').rpc).toBe('https://rpc2.test');
    expect(pool.getBestPeer('rest').rpc).toBe('https://rpc2.test');
  });

  it('returns nothing rather than a peer on another chain', () => {
    // The fallbacks are there so a degraded network stays usable. They must not
    // be a way back in for a chain we did not ask about.
    const pool = poolWith(1);
    pool.networkChainId = 'lumen-testnet';
    alive(pool, 'https://rpc1.test', { chainId: 'lumen' });

    expect(pool.getBestPeer('rpc')).toBeFalsy();
  });

  it('prefers the fastest peer that is neither slow nor suspect', () => {
    const pool = poolWith(3);
    alive(pool, 'https://rpc1.test', { latencyMs: 50 });
    alive(pool, 'https://rpc2.test', { latencyMs: 10, suspectUntil: Date.now() + 60_000 });
    alive(pool, 'https://rpc3.test', { latencyMs: 20 });

    expect(pool.getBestPeer('rpc').rpc).toBe('https://rpc3.test');
  });
});

describe('the bootstrap file', () => {
  const FILE = [
    '# a comment',
    '[mainnet]',
    'https://rpc-main.test https://rest-main.test grpc-main.test:443',
    '',
    '[testnet]',
    '# https://commented-out.test',
    'https://rpc-test.test https://rest-test.test',
  ].join('\n');

  it('loads only the section for the network asked for', () => {
    expect(parseBootstrapPeers(FILE, 'mainnet')).toEqual([
      { rpc: 'https://rpc-main.test', rest: 'https://rest-main.test', grpc: 'grpc-main.test:443' },
    ]);
    expect(parseBootstrapPeers(FILE, 'testnet')).toEqual([
      { rpc: 'https://rpc-test.test', rest: 'https://rest-test.test', grpc: null },
    ]);
  });

  it('returns nothing for a section the file does not have', () => {
    // Better an empty pool, which is loud, than mainnet peers under a testnet
    // name, which is not.
    expect(parseBootstrapPeers(FILE, 'devnet')).toEqual([]);
  });

  it('treats a file written before sections existed as mainnet', () => {
    const old = 'https://rpc1.test https://rest1.test';
    expect(parseBootstrapPeers(old, 'mainnet')).toHaveLength(1);
    expect(parseBootstrapPeers(old, 'testnet')).toHaveLength(0);
  });
});
