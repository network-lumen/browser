import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The domain listing, shaped the way the page reads it.
 *
 * `mobile.lulu` was bought from the phone, the purchase confirmed, the name
 * sits on-chain - and the domains list showed nothing. Two reasons, both about
 * shape rather than about the chain:
 *
 *  - `domains_by_owner` answers NAMES, `{"domains":["mobile.lulu"],…}`, while
 *    the page draws rows with an expiry, an update time and a lifecycle badge.
 *    Nothing fetched the detail behind each name.
 *  - the answer came back under a `domains` key, and DomainPage.vue reads
 *    `res.data`, so even the names never reached it.
 *
 * These pin the shape, because the page is shared with the desktop and reads
 * exactly one shape. The payloads below are what the live chain returned for
 * that domain.
 */
const PARAMS = {
  params: {
    grace_days: '14',
    auction_days: '7',
    bid_fee_ulmn: '50000',
    min_price_ulmn_per_month: '500000'
  }
};

const DOMAIN = {
  domain: {
    index: 'mobile.lulu',
    name: 'mobile.lulu',
    owner: 'lmn1p58y99qw9akaxwe0h5fx3vnrhu8k5clz865zv9',
    records: [],
    expire_at: '1821695496',
    creator: 'lmn1p58y99qw9akaxwe0h5fx3vnrhu8k5clz865zv9',
    updated_at: '1790159496'
  }
};

const OWNER = 'lmn1p58y99qw9akaxwe0h5fx3vnrhu8k5clz865zv9';

/** Every path asked for, so the paging can be checked as well as the result. */
let asked: string[] = [];
let serve: (path: string) => { ok: boolean; status: number; json?: unknown };

vi.mock('../../platform/mobile/impl/network', () => ({
  readState: async (path: string) => {
    asked.push(path);
    return serve(path);
  }
}));

const { listByOwnerDetailed, listAuctions } = await import(
  '../../platform/mobile/impl/dns-list'
);

/** The live chain's answers, for a wallet holding exactly that one name. */
function serveOneDomain(path: string) {
  if (path.startsWith('/lumen/dns/v1/params')) return { ok: true, status: 200, json: PARAMS };
  if (path.startsWith('/lumen/dns/v1/domains_by_owner/')) {
    return { ok: true, status: 200, json: { domains: ['mobile.lulu'], total: '1', has_more: false } };
  }
  if (path.startsWith('/lumen/dns/v1/domain/')) return { ok: true, status: 200, json: DOMAIN };
  return { ok: false, status: 404 };
}

describe('listing the domains an address owns', () => {
  beforeEach(() => {
    asked = [];
    serve = serveOneDomain;
  });

  it('returns rows under `data`, which is the key the page reads', async () => {
    const res: any = await listByOwnerDetailed(OWNER);

    expect(res.ok).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data).toHaveLength(1);
    // Not `domains`: the page would never look there.
    expect(res.domains).toBeUndefined();
  });

  it('fetches the detail behind each name, not just the name', async () => {
    const res: any = await listByOwnerDetailed(OWNER);
    const row = res.data[0];

    // The page builds every column from these.
    expect(row.name).toBe('mobile.lulu');
    expect(row.expire_at).toBe('1821695496');
    expect(row.updated_at).toBe('1790159496');
    expect(row.owner).toBe(OWNER);

    expect(asked).toContain('/lumen/dns/v1/domain/mobile.lulu');
  });

  it('carries the lifecycle, so the badge agrees with the auction list', async () => {
    const res: any = await listByOwnerDetailed(OWNER);
    const lifecycle = res.data[0].lifecycle;

    // Expiry is in 2027, so the name is active and its auction window is stated
    // in advance: 14 days of grace, then 7 of auction.
    expect(lifecycle.status).toBe('active');
    expect(lifecycle.expireAt).toBe(1821695496);
    expect(lifecycle.auctionStart).toBe(1821695496 + 14 * 24 * 3600);
    expect(lifecycle.auctionEnd).toBe(1821695496 + 21 * 24 * 3600);
    expect(res.params).toEqual({ graceDays: 14, auctionDays: 7 });
  });

  it('asks for the pages the chain expects, and stops when it says so', async () => {
    await listByOwnerDetailed(OWNER);

    // Paged from chain v2.0.0 on: 50 names by default, 200 at most. Asked
    // without a limit, an owner holding more than fifty silently loses the rest.
    const listCalls = asked.filter((p) => p.includes('domains_by_owner'));
    expect(listCalls).toEqual([
      `/lumen/dns/v1/domains_by_owner/${OWNER}?offset=0&limit=200`
    ]);
  });

  it('walks a second page when the chain sets has_more', async () => {
    serve = (path) => {
      if (path.startsWith('/lumen/dns/v1/params')) return { ok: true, status: 200, json: PARAMS };
      if (path.includes('offset=0')) {
        return { ok: true, status: 200, json: { domains: ['a.lmn'], has_more: true } };
      }
      if (path.includes('offset=200')) {
        return { ok: true, status: 200, json: { domains: ['b.lmn'], has_more: false } };
      }
      return { ok: true, status: 200, json: DOMAIN };
    };

    const res: any = await listByOwnerDetailed(OWNER);
    expect(res.data).toHaveLength(2);
    expect(asked.filter((p) => p.includes('domains_by_owner'))).toHaveLength(2);
  });

  it('lists the rows it could read when one of them is unreachable', async () => {
    serve = (path) => {
      if (path.startsWith('/lumen/dns/v1/params')) return { ok: true, status: 200, json: PARAMS };
      if (path.includes('domains_by_owner')) {
        return { ok: true, status: 200, json: { domains: ['gone.lmn', 'mobile.lulu'] } };
      }
      if (path === '/lumen/dns/v1/domain/gone.lmn') return { ok: false, status: 500 };
      return { ok: true, status: 200, json: DOMAIN };
    };

    const res: any = await listByOwnerDetailed(OWNER);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].name).toBe('mobile.lulu');
  });

  it('still lists the rows when the params are unavailable, just without a badge', async () => {
    serve = (path) => {
      if (path.startsWith('/lumen/dns/v1/params')) return { ok: false, status: 503 };
      if (path.includes('domains_by_owner')) {
        return { ok: true, status: 200, json: { domains: ['mobile.lulu'] } };
      }
      return { ok: true, status: 200, json: DOMAIN };
    };

    const res: any = await listByOwnerDetailed(OWNER);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].lifecycle).toBeUndefined();
    expect(res.params).toBeNull();
  });

  it('reports an owner with nothing as an empty list, not as a failure', async () => {
    serve = (path) =>
      path.includes('domains_by_owner')
        ? { ok: true, status: 200, json: { domains: [], total: '0', has_more: false } }
        : { ok: true, status: 200, json: PARAMS };

    const res: any = await listByOwnerDetailed(OWNER);
    expect(res).toMatchObject({ ok: true, data: [] });
  });

  it('refuses an empty address rather than listing the whole chain', async () => {
    expect(await listByOwnerDetailed('')).toEqual({ ok: false, error: 'missing_owner' });
    expect(asked).toEqual([]);
  });
});

describe('listing auctions', () => {
  beforeEach(() => {
    asked = [];
  });

  /**
   * Only the rows a bidder can act on: the open ones, and the closed ones that
   * still owe a winner their name. Everything else is noise on that tab.
   */
  it('keeps an open auction and drops an active domain', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // Lapsed 20 days ago: past 14 days of grace, inside the 7-day auction.
    const lapsed = String(nowSec - 20 * 24 * 3600);

    serve = (path) => {
      if (path.startsWith('/lumen/dns/v1/params')) return { ok: true, status: 200, json: PARAMS };
      if (path.startsWith('/lumen/dns/v1/domain?')) {
        return {
          ok: true,
          status: 200,
          json: {
            domain: [
              { index: 'lapsed.lmn', owner: 'lmn1old', expire_at: lapsed },
              { index: 'mobile.lulu', owner: OWNER, expire_at: '1821695496' }
            ],
            pagination: { next_key: null }
          }
        };
      }
      if (path.startsWith('/lumen/dns/v1/auction?')) {
        return {
          ok: true,
          status: 200,
          json: {
            auction: [{ index: 'lapsed.lmn', bidder: 'lmn1bidder', highest_bid: '2000000' }],
            pagination: { next_key: null }
          }
        };
      }
      return { ok: false, status: 404 };
    };

    const res: any = await listAuctions();

    expect(res.ok).toBe(true);
    expect(res.data.map((r: any) => r.name)).toEqual(['lapsed.lmn']);
    expect(res.data[0]).toMatchObject({
      status: 'auction',
      open: true,
      bidder: 'lmn1bidder',
      highestBidUlmn: '2000000'
    });
    expect(res.params).toEqual({ graceDays: 14, auctionDays: 7, bidFeeUlmn: 50000 });
    expect(res.scannedDomains).toBe(2);
  });

  it('says so rather than showing an empty tab when the params are unavailable', async () => {
    serve = () => ({ ok: false, status: 503 });
    expect(await listAuctions()).toEqual({ ok: false, error: 'dns_params_unavailable' });
  });
});
