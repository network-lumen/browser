import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { PeerPool } = require_('../../electron/daemons/peers/peer_pool.cjs');

/**
 * What the pool believes about each peer, and for how long.
 *
 * The selection rules had tests; the machinery that feeds them did not - some
 * six hundred lines deciding when a peer is slow, dead, or worth trying again.
 * Getting it wrong is quiet in both directions: too eager and the app talks to
 * a node that is lying or lagging, too harsh and it runs out of peers and stops
 * reaching the chain at all.
 *
 * Several transitions have no public door - success is only reachable from
 * _pingPeer, which needs a network - so they are driven directly. They are
 * state transitions, not plumbing, and they are the point of the file.
 */

const TTL = { slowTtlMs: 1_000, deathTtlMs: 5_000, staleTtlMs: 10_000, slowLatencyMs: 500 };

function poolWith(count: number, opts: Record<string, unknown> = {}) {
  const pool = new PeerPool({ ...TTL, ...opts });
  pool.addBootstrapPeers(
    Array.from({ length: count }, (_, i) => ({
      rpc: `https://rpc${i + 1}.test`,
      rest: `https://rest${i + 1}.test`
    }))
  );
  return pool;
}

const peerOf = (pool: any, n = 1) => pool.getPeerByRpc(`https://rpc${n}.test`);

afterEach(() => {
  vi.useRealTimers();
});

describe('deciding a peer is dead', () => {
  it('takes three failures in a row, not one', () => {
    const pool = poolWith(1);
    const peer = peerOf(pool);

    pool.markFailure(peer, {});
    pool.markFailure(peer, {});
    expect(peer.deathUntil).toBe(0);

    pool.markFailure(peer, {});
    expect(peer.deathUntil).toBeGreaterThan(0);
  });

  it('stops offering a dead peer even when nothing else is left', () => {
    // Unlike slow and suspect, death is not a preference: a peer that failed
    // three times is not worth the timeout it would cost.
    const pool = poolWith(1);
    const peer = peerOf(pool);
    for (let i = 0; i < 3; i++) pool.markFailure(peer, {});

    expect(pool.pickPeers('rpc', 1, { requireAlive: false })).toEqual([]);
    expect(pool.getBestPeer('rpc')).toBeNull();
  });

  it('marks a timeout slow straight away, before the third strike', () => {
    // A peer that times out is already costing the caller its whole budget.
    const pool = poolWith(1);
    const peer = peerOf(pool);
    pool.markFailure(peer, { timeout: true });
    expect(peer.slowUntil).toBeGreaterThan(0);
    expect(peer.deathUntil).toBe(0);
  });

  it('marks a slow answer slow, even when it answered', () => {
    const pool = poolWith(1);
    const peer = peerOf(pool);
    pool.markFailure(peer, { latencyMs: TTL.slowLatencyMs + 1 });
    expect(peer.slowUntil).toBeGreaterThan(0);
  });
});

describe('letting a peer back in', () => {
  it('resurrects it when its sentence expires, with a clean record', () => {
    // Without this the pool bleeds peers: every network hiccup would cost one
    // permanently, and a laptop that slept through a tunnel would wake up with
    // nothing to talk to.
    vi.useFakeTimers();
    const pool = poolWith(1);
    const peer = peerOf(pool);
    for (let i = 0; i < 3; i++) pool.markFailure(peer, {});
    expect(pool.pickPeers('rpc', 1, { requireAlive: false })).toEqual([]);

    vi.advanceTimersByTime(TTL.deathTtlMs + 1);

    expect(pool.pickPeers('rpc', 1, { requireAlive: false })).toHaveLength(1);
    expect(peer.deathUntil).toBe(0);
    // The count resets too: three more failures are needed, not one.
    expect(peer.consecutiveFailures).toBe(0);
  });

  it('lets a slow mark lapse on its own', () => {
    vi.useFakeTimers();
    const pool = poolWith(1);
    const peer = peerOf(pool);
    pool.markFailure(peer, { timeout: true });

    vi.advanceTimersByTime(TTL.slowTtlMs + 1);
    pool.pickPeers('rpc', 1, { requireAlive: false });
    expect(peer.slowUntil).toBe(0);
  });

  it('lets a suspect mark lapse on its own', () => {
    vi.useFakeTimers();
    const pool = poolWith(1);
    pool.markSuspect(`https://rpc1.test`);

    vi.advanceTimersByTime(TTL.slowTtlMs + 1);
    pool.pickPeers('rpc', 1, { requireAlive: false });
    expect(peerOf(pool).suspectUntil).toBe(0);
  });

  it('wipes the slate on a successful answer', () => {
    const pool = poolWith(1);
    const peer = peerOf(pool);
    pool.markFailure(peer, { timeout: true });
    pool.markFailure(peer, {});

    pool._markSuccess(peer, { chainId: 'lumen-1', height: 42, latencyMs: 10 });

    expect(peer.consecutiveFailures).toBe(0);
    expect(peer.deathUntil).toBe(0);
    expect(peer.slowUntil).toBe(0);
    expect(peer.chainId).toBe('lumen-1');
    expect(peer.lastSeenHeight).toBe(42);
  });

  it('keeps calling a slow answer slow, success or not', () => {
    const pool = poolWith(1);
    const peer = peerOf(pool);
    pool._markSuccess(peer, { chainId: 'lumen-1', height: 42, latencyMs: TTL.slowLatencyMs + 1 });
    expect(peer.slowUntil).toBeGreaterThan(0);
  });
});

describe('being alive', () => {
  it('is not the same as being known', () => {
    // A peer read from peers.txt has never answered. Offering it as alive would
    // send the first real request into the dark.
    const pool = poolWith(1);
    expect(pool.pickPeers('rpc', 1, { requireAlive: true })).toEqual([]);
    expect(pool.pickPeers('rpc', 1, { requireAlive: false })).toHaveLength(1);
  });

  it('wears off after the staleness window', () => {
    vi.useFakeTimers();
    const pool = poolWith(1);
    pool._markSuccess(peerOf(pool), { chainId: 'lumen-1', height: 1, latencyMs: 5 });
    expect(pool.pickPeers('rpc', 1, { requireAlive: true })).toHaveLength(1);

    vi.advanceTimersByTime(TTL.staleTtlMs + 1);
    expect(pool.pickPeers('rpc', 1, { requireAlive: true })).toEqual([]);
  });
});

describe('picking the best peer', () => {
  const alive = (pool: any, n: number, latencyMs = 10) =>
    pool._markSuccess(peerOf(pool, n), { chainId: 'lumen-1', height: 100, latencyMs });

  it('passes over the slow and the suspect while a clean one exists', () => {
    const pool = poolWith(3);
    alive(pool, 1, TTL.slowLatencyMs + 1); // slow
    alive(pool, 2);
    alive(pool, 3);
    pool.markSuspect(`https://rpc2.test`);

    expect(pool.getBestPeer('rpc')?.rpc).toBe('https://rpc3.test');
  });

  it('falls back to a slow peer rather than answering nothing', () => {
    const pool = poolWith(1);
    alive(pool, 1, TTL.slowLatencyMs + 1);
    expect(pool.getBestPeer('rpc')?.rpc).toBe('https://rpc1.test');
  });

  it('only offers peers that have the endpoint being asked for', () => {
    const pool = new PeerPool(TTL);
    pool.addBootstrapPeers([{ rpc: 'https://a.test' }, { rpc: 'https://b.test', rest: 'https://b-rest.test' }]);
    expect(pool.getBestPeer('rest')?.rpc).toBe('https://b.test');
  });
});

describe('the health tick', () => {
  it('always checks the peers nobody has heard from', () => {
    // The tick is the only thing that turns an unknown peer into a usable one,
    // so a stale peer must never be crowded out by the random sample.
    vi.useFakeTimers();
    const pool = poolWith(8);
    for (let i = 1; i <= 8; i++) {
      pool._markSuccess(peerOf(pool, i), { chainId: 'lumen-1', height: 1, latencyMs: 5 });
    }
    // Two of them go quiet for longer than the staleness window.
    vi.advanceTimersByTime(TTL.staleTtlMs + 1);
    for (let i = 3; i <= 8; i++) {
      pool._markSuccess(peerOf(pool, i), { chainId: 'lumen-1', height: 2, latencyMs: 5 });
    }

    const pinged: string[] = [];
    pool._pingPeer = async (p: any) => {
      pinged.push(p.rpc);
      return { ok: true };
    };

    return pool.healthTick().then(() => {
      expect(pinged).toContain('https://rpc1.test');
      expect(pinged).toContain('https://rpc2.test');
      // Stale plus a sample of three, never the whole pool.
      expect(pinged.length).toBeLessThan(8);
      expect(new Set(pinged).size).toBe(pinged.length);
    });
  });

  it('does nothing, rather than throwing, with no peers at all', async () => {
    await expect(new PeerPool(TTL).healthTick()).resolves.toBeUndefined();
  });
});

describe('finding peers in validator descriptions', () => {
  // How the pool grows beyond peers.txt: validators advertise endpoints in free
  // text, and this is the only thing standing between that text and a URL the
  // app will send a transaction to.
  const extract = (text: string) => new PeerPool(TTL)._extractEndpoints(text);

  it('reads the cosmos ports', () => {
    const out = extract('https://node.example.com:26657 https://node.example.com:1317 grpc.example.com:9090');
    expect(out.rpc).toBe('https://node.example.com:26657');
    expect(out.rest).toBe('https://node.example.com:1317');
    expect(out.grpc).toBe('grpc.example.com:9090');
  });

  it('reads the conventional hostnames and paths', () => {
    expect(extract('https://rpc.example.com').rpc).toBe('https://rpc.example.com');
    expect(extract('https://api.example.com').rest).toBe('https://api.example.com');
    expect(extract('https://lcd.example.com').rest).toBe('https://lcd.example.com');
    expect(extract('https://example.com/rpc').rpc).toBe('https://example.com/rpc');
  });

  it('picks up a bare host:port, which is how most of them are written', () => {
    expect(extract('our node: rpc.example.com:26657, come say hi').rpc).toBe('https://rpc.example.com:26657');
  });

  it('gives back nothing for text that advertises no endpoint', () => {
    expect(extract('Staking with us since 2021. https://twitter.com/someone')).toBeNull();
    expect(extract('')).toBeNull();
    expect(extract(null as never)).toBeNull();
  });

  it('adds only validators that offered an rpc, and counts what it added', () => {
    // rest alone is not enough: the pool is keyed by rpc.
    const pool = new PeerPool(TTL);
    const added = pool._extractAndAddPeersFromValidators([
      { description: { website: 'https://rpc.one.test:26657', details: '' } },
      { description: { website: 'https://api.two.test:1317', details: '' } },
      { description: { website: 'nothing here', details: '' } },
      { description: { website: 'https://rpc.one.test:26657', details: 'the same one again' } }
    ]);

    expect(added).toBe(1);
    expect(pool.listPeers().map((p: any) => p.rpc)).toEqual(['https://rpc.one.test:26657']);
    expect(pool.listPeers()[0].source).toBe('onchain');
  });

  it('survives a validator with no description at all', () => {
    const pool = new PeerPool(TTL);
    expect(pool._extractAndAddPeersFromValidators([null, {}, { description: null }] as never)).toBe(0);
  });
});
