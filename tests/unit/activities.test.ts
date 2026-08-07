import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearActivitiesCache, fetchActivities } from '../../src/internal/services/activities';

/**
 * Normalising what the indexer sends.
 *
 * The interesting part is not the request but the shape-flattening around it:
 * the indexer names the same field four or five ways depending on the message
 * type, and the UI reads one name. Everything below is a spelling this code
 * exists to absorb.
 */

function bridge(listSendTxs: unknown) {
  (window as any).lumen = { wallet: { listSendTxs } };
}

beforeEach(() => {
  clearActivitiesCache();
});

afterEach(() => {
  delete (window as any).lumen;
  clearActivitiesCache();
  vi.restoreAllMocks();
});

describe('reading the indexer', () => {
  it('maps a well-formed entry through unchanged', async () => {
    bridge(async () => ({
      ok: true,
      items: [{ txhash: 'ABC', timestamp: '2026-08-03T10:00:00Z', height: 42, type: 'send' }],
    }));
    const [activity] = await fetchActivities({ walletId: 'w1' });
    expect(activity).toMatchObject({ id: 'ABC', txhash: 'ABC', type: 'send', height: 42 });
  });

  it('folds the indexer aliases onto the type the UI knows', async () => {
    bridge(async () => ({
      ok: true,
      items: [
        { txhash: 'a', type: 'transfer' },
        { txhash: 'b', type: 'recv' },
        { txhash: 'c', type: 'register-name' },
        { txhash: 'd', type: 'renew' },
      ],
    }));
    const list = await fetchActivities({ walletId: 'w1' });
    expect(list.map((a) => a.type)).toEqual(['send', 'receive', 'register_domain', 'renew_domain']);
  });

  it('calls an unrecognised type unknown rather than passing it through', async () => {
    bridge(async () => ({ ok: true, items: [{ txhash: 'a', type: 'something_new' }] }));
    const [activity] = await fetchActivities({ walletId: 'w1' });
    expect(activity.type).toBe('unknown');
  });

  it('reads from/to under any of the names the indexer uses', async () => {
    bridge(async () => ({
      ok: true,
      items: [{ txhash: 'a', from: 'lmn1from', to: 'lmn1to' }],
    }));
    const [activity] = await fetchActivities({ walletId: 'w1' });
    // Exposed under both names because the UI reads either.
    expect(activity.from).toBe('lmn1from');
    expect(activity.sender).toBe('lmn1from');
    expect(activity.to).toBe('lmn1to');
    expect(activity.recipient).toBe('lmn1to');
  });

  it('leaves an absent optional field absent instead of empty', async () => {
    // `memo: ''` and no memo at all must not render differently.
    bridge(async () => ({ ok: true, items: [{ txhash: 'a', memo: '' }] }));
    const [activity] = await fetchActivities({ walletId: 'w1' });
    expect(activity.memo).toBeUndefined();
    expect(activity.dnsName).toBeUndefined();
  });

  it('reads amounts whether they arrive as a list or as a lone amount+denom', async () => {
    // The second shape reached nothing before: fetchActivities rebuilt each
    // item from eleven canonical field names, so every alternate spelling was
    // dropped one layer above the code written to absorb it.
    bridge(async () => ({
      ok: true,
      items: [
        { txhash: 'a', amounts: [{ denom: 'ulmn', amount: '10' }] },
        { txhash: 'b', amount: '20', denom: 'ulmn' },
        { txhash: 'c', amountsList: [{ denom: 'ulmn', amount: '30' }] },
      ],
    }));
    const list = await fetchActivities({ walletId: 'w1' });
    const amountsOf = (hash: string) => list.find((a) => a.txhash === hash)?.amounts;
    expect(amountsOf('a')).toEqual([{ denom: 'ulmn', amount: '10' }]);
    expect(amountsOf('b')).toEqual([{ denom: 'ulmn', amount: '20' }]);
    expect(amountsOf('c')).toEqual([{ denom: 'ulmn', amount: '30' }]);
  });

  it('reads the hash under any of its spellings', async () => {
    bridge(async () => ({ ok: true, items: [{ txHash: 'CAMEL' }, { tx_id: 'SNAKE' }] }));
    const list = await fetchActivities({ walletId: 'w1' });
    expect(list.map((a) => a.txhash).sort()).toEqual(['CAMEL', 'SNAKE']);
  });

  it('prefers the canonical name when both are present', async () => {
    bridge(async () => ({ ok: true, items: [{ txhash: 'CANON', hash: 'OTHER' }] }));
    const [activity] = await fetchActivities({ walletId: 'w1' });
    expect(activity.txhash).toBe('CANON');
  });

  it('invents an id when the entry has neither id nor hash, so keys stay unique', async () => {
    bridge(async () => ({ ok: true, items: [{ type: 'send', timestamp: 't', height: 7 }] }));
    const [activity] = await fetchActivities({ walletId: 'w1' });
    expect(activity.id).toBe('send-t-7');
    expect(activity.txhash).toBe('send-t-7');
  });

  it('sorts newest first', async () => {
    bridge(async () => ({
      ok: true,
      items: [
        { txhash: 'old', timestamp: '2026-01-01T00:00:00Z' },
        { txhash: 'new', timestamp: '2026-08-01T00:00:00Z' },
        { txhash: 'mid', timestamp: '2026-04-01T00:00:00Z' },
      ],
    }));
    const list = await fetchActivities({ walletId: 'w1' });
    expect(list.map((a) => a.txhash)).toEqual(['new', 'mid', 'old']);
  });

  it('puts an entry with an unreadable timestamp last rather than dropping it', async () => {
    bridge(async () => ({
      ok: true,
      items: [{ txhash: 'bad', timestamp: 'nonsense' }, { txhash: 'good', timestamp: '2026-08-01T00:00:00Z' }],
    }));
    const list = await fetchActivities({ walletId: 'w1' });
    expect(list.map((a) => a.txhash)).toEqual(['good', 'bad']);
  });
});

describe('when there is nothing to read', () => {
  it('returns an empty list with no bridge at all', async () => {
    delete (window as any).lumen;
    await expect(fetchActivities({ walletId: 'w1' })).resolves.toEqual([]);
  });

  it('returns an empty list when the reply says it failed', async () => {
    bridge(async () => ({ ok: false, error: 'node_unreachable' }));
    await expect(fetchActivities({ walletId: 'w1' })).resolves.toEqual([]);
  });

  it('returns an empty list when items is missing or not a list', async () => {
    bridge(async () => ({ ok: true, items: 'nope' }));
    await expect(fetchActivities({ walletId: 'w1' })).resolves.toEqual([]);
  });
});

describe('the cache', () => {
  it('answers a repeated query without asking again', async () => {
    const listSendTxs = vi.fn(async () => ({ ok: true, items: [{ txhash: 'A' }] }));
    bridge(listSendTxs);
    await fetchActivities({ walletId: 'w1' });
    await fetchActivities({ walletId: 'w1' });
    expect(listSendTxs).toHaveBeenCalledTimes(1);
  });

  it('keys on the page as well as the wallet, so paging is not served stale', async () => {
    const listSendTxs = vi.fn(async () => ({ ok: true, items: [] }));
    bridge(listSendTxs);
    await fetchActivities({ walletId: 'w1', limit: 20, offset: 0 });
    await fetchActivities({ walletId: 'w1', limit: 20, offset: 20 });
    await fetchActivities({ walletId: 'w2', limit: 20, offset: 0 });
    expect(listSendTxs).toHaveBeenCalledTimes(3);
  });

  it('caches the empty answer too, so a down node is not hammered', async () => {
    const listSendTxs = vi.fn(async () => ({ ok: false }));
    bridge(listSendTxs);
    await fetchActivities({ walletId: 'w1' });
    await fetchActivities({ walletId: 'w1' });
    expect(listSendTxs).toHaveBeenCalledTimes(1);
  });

  it('asks again once the entry has expired', async () => {
    vi.useFakeTimers();
    const listSendTxs = vi.fn(async () => ({ ok: true, items: [] }));
    bridge(listSendTxs);
    await fetchActivities({ walletId: 'w1' });
    vi.setSystemTime(Date.now() + 31_000);
    await fetchActivities({ walletId: 'w1' });
    expect(listSendTxs).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('can be cleared, which is what a wallet switch needs', async () => {
    const listSendTxs = vi.fn(async () => ({ ok: true, items: [] }));
    bridge(listSendTxs);
    await fetchActivities({ walletId: 'w1' });
    clearActivitiesCache();
    await fetchActivities({ walletId: 'w1' });
    expect(listSendTxs).toHaveBeenCalledTimes(2);
  });
});
