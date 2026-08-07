import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { PeerPool } = require_('../../electron/network/peer_pool.cjs');

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
});
