/**
 * The two domain listings, which the chain answers in pieces.
 *
 * `domains_by_owner` returns NAMES and nothing else - `{"domains":["mobile.lulu"],
 * "total":"1","has_more":false}` - while the page draws rows carrying an expiry,
 * an update time and a lifecycle badge. An earlier version of the mobile module
 * handed those bare names straight through under a `domains` key, so the page,
 * which reads `data`, found nothing: a domain bought and confirmed on-chain
 * showed up as an empty list.
 *
 * So both listings are assembled the way `electron/ipc/chain.cjs` assembles
 * them: page through the index, fetch each row, and compute the lifecycle from
 * the module params. The response shapes match the desktop's exactly, because
 * the page is shared and reads one shape.
 */

import { readState } from './network';
import {
  isAuctionOpen,
  isAuctionSettleable,
  lifecycleStatus,
  lifecycleWindows,
  toSeconds
} from './domain-lifecycle';

const LIST_TIMEOUT_MS = 20_000;
const ITEM_TIMEOUT_MS = 15_000;

/**
 * DomainsByOwner is paged from chain v2.0.0 on: 50 names by default, 200 at
 * most, with `has_more` when the scan stopped early. Asked the old way an owner
 * holding more than fifty names silently lost the rest, and the page had no way
 * to tell that from owning fifty.
 */
const BY_OWNER_PAGE = 200;
const BY_OWNER_MAX_PAGES = 10;

/** The dns module params, or null when the node would not answer. */
async function loadParams(): Promise<Record<string, any> | null> {
  const res = await readState('/lumen/dns/v1/params', { kind: 'rest', timeout: LIST_TIMEOUT_MS });
  if (!res.ok) return null;
  const body = res.json as any;
  return body?.params ?? body ?? null;
}

/**
 * Pages through a cosmos-sdk list query until it runs out or hits the cap.
 *
 * The cap is not a performance tweak. `/lumen/dns/v1/domain` is an unbounded
 * list and this runs on every visit to the auctions tab, so without a stop the
 * page's load time is a function of how well the chain has sold. Truncation is
 * reported rather than hidden.
 */
async function listAll(
  path: string,
  key: string,
  { pageLimit = 200, maxPages = 10 } = {}
): Promise<{ ok: true; data: any[]; truncated: boolean } | { ok: false; status: number; error: string }> {
  const out: any[] = [];
  let pageKey = '';
  let truncated = false;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({ 'pagination.limit': String(pageLimit) });
    if (pageKey) params.set('pagination.key', pageKey);

    const res = await readState(`${path}?${params.toString()}`, {
      kind: 'rest',
      timeout: LIST_TIMEOUT_MS
    });
    if (!res.ok) return { ok: false, status: res.status, error: `http_${res.status}` };

    const body = res.json as any;
    const rows = Array.isArray(body?.[key]) ? body[key] : [];
    out.push(...rows);

    pageKey = String(body?.pagination?.next_key ?? '');
    if (!pageKey) break;
    // The loop is about to end with a key still outstanding.
    if (page === maxPages - 1) truncated = true;
  }

  return { ok: true, data: out, truncated };
}

/**
 * Every domain an address owns, with the detail the page draws.
 *
 * Shaped exactly as `dns:listByOwnerDetailed` shapes it on the desktop:
 * `{ ok, data, truncated, params }`, where each row is the domain object the
 * chain returned plus a `lifecycle`.
 */
export async function listByOwnerDetailed(ownerInput: unknown): Promise<Record<string, unknown>> {
  const owner = String(ownerInput ?? '').trim();
  if (!owner) return { ok: false, error: 'missing_owner' };

  const names: unknown[] = [];
  let byOwnerTruncated = false;

  for (let page = 0; page < BY_OWNER_MAX_PAGES; page += 1) {
    const res = await readState(
      `/lumen/dns/v1/domains_by_owner/${encodeURIComponent(owner)}` +
        `?offset=${page * BY_OWNER_PAGE}&limit=${BY_OWNER_PAGE}`,
      { kind: 'rest', timeout: LIST_TIMEOUT_MS }
    );
    if (!res.ok) {
      // A later page failing still leaves the earlier ones worth showing.
      if (page > 0) break;
      return { ok: false, status: res.status, error: `http_${res.status}` };
    }

    const body = res.json as any;
    const pageNames = Array.isArray(body?.domains)
      ? body.domains
      : Array.isArray(body)
        ? body
        : [];
    names.push(...pageNames);

    const hasMore = body?.has_more ?? body?.hasMore ?? false;
    if (!hasMore) break;
    if (page === BY_OWNER_MAX_PAGES - 1) byOwnerTruncated = true;
  }

  if (!names.length) return { ok: true, data: [], truncated: byOwnerTruncated };

  // Params failing is not fatal: the rows are still worth listing, they just
  // carry no status.
  const params = await loadParams();
  const graceDays = toSeconds(params?.grace_days ?? params?.graceDays);
  const auctionDays = toSeconds(params?.auction_days ?? params?.auctionDays);
  const haveParams = !!params;

  const nowSec = Math.floor(Date.now() / 1000);
  const out: Record<string, unknown>[] = [];

  for (const rawName of names) {
    const name = String(rawName ?? '').trim();
    if (!name) continue;
    try {
      const res = await readState(`/lumen/dns/v1/domain/${encodeURIComponent(name)}`, {
        kind: 'rest',
        timeout: ITEM_TIMEOUT_MS
      });
      if (!res.ok) continue;

      const body = res.json as any;
      const dom = (body?.domain ?? body ?? {}) as Record<string, unknown>;
      if (!haveParams) {
        out.push(dom);
        continue;
      }

      // Copied rather than assigned into: the row belongs to whatever handed
      // back the response, and a listing has no business writing into it.
      const expireAt = toSeconds(dom.expire_at ?? (dom as any).expireAt);
      out.push({
        ...dom,
        lifecycle: {
          ...lifecycleWindows(expireAt, graceDays, auctionDays),
          status: lifecycleStatus(nowSec, expireAt, graceDays, auctionDays)
        }
      });
    } catch {
      // One unreachable row must not empty the list.
    }
  }

  return {
    ok: true,
    data: out,
    truncated: byOwnerTruncated,
    params: haveParams ? { graceDays, auctionDays } : null
  };
}

/**
 * Every auction worth showing: the open ones, and the closed ones that still
 * have a winner to pay.
 *
 * Shaped as `dns:listAuctions` shapes it on the desktop, down to
 * `scannedDomains` - the auctions tab states how far the scan reached.
 */
export async function listAuctions(): Promise<Record<string, unknown>> {
  const params = await loadParams();
  if (!params) return { ok: false, error: 'dns_params_unavailable' };

  const graceDays = toSeconds(params.grace_days ?? params.graceDays);
  const auctionDays = toSeconds(params.auction_days ?? params.auctionDays);
  const bidFeeUlmn = toSeconds(params.bid_fee_ulmn ?? params.bidFeeUlmn);

  const [domainsRes, auctionsRes] = await Promise.all([
    listAll('/lumen/dns/v1/domain', 'domain'),
    listAll('/lumen/dns/v1/auction', 'auction')
  ]);
  if (domainsRes.ok === false) return domainsRes;
  if (auctionsRes.ok === false) return auctionsRes;

  const nowSec = Math.floor(Date.now() / 1000);

  // Keyed by fqdn: the auction row's `index` is the name the domain row carries.
  const bids = new Map<string, any>();
  for (const auc of auctionsRes.data) {
    const name = String(auc?.index ?? auc?.name ?? '').trim();
    if (name) bids.set(name, auc);
  }

  const domainsByName = new Map<string, any>();
  for (const dom of domainsRes.data) {
    const name = String(dom?.index ?? dom?.name ?? '').trim();
    if (name) domainsByName.set(name, dom);
  }

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  const addRow = (name: string, dom: any, auc: any) => {
    if (!name || seen.has(name)) return;
    const expireAt = toSeconds(dom?.expire_at ?? dom?.expireAt);
    const windows = lifecycleWindows(expireAt, graceDays, auctionDays);
    const status = lifecycleStatus(nowSec, expireAt, graceDays, auctionDays);
    const highestBid = String(auc?.highest_bid ?? auc?.highestBid ?? '');
    const bidder = String(auc?.bidder ?? '');

    // A row the chain would still accept a settlement for: the window has
    // closed and a winner is on record. Without this the tab shows the name
    // vanishing at the end of the window with nobody paid.
    const settleable =
      !!bidder && !!highestBid && isAuctionSettleable(nowSec, expireAt, graceDays, auctionDays);
    const open = isAuctionOpen(nowSec, expireAt, graceDays, auctionDays);
    if (!open && !settleable) return;

    seen.add(name);
    rows.push({
      name,
      status,
      owner: String(dom?.owner ?? ''),
      expireAtSeconds: expireAt || null,
      auctionStartSeconds: windows.auctionStart || null,
      auctionEndSeconds: windows.auctionEnd || null,
      highestBidUlmn: highestBid,
      bidder,
      open,
      settleable
    });
  };

  for (const [name, dom] of domainsByName) addRow(name, dom, bids.get(name) ?? null);
  // An auction row whose domain the scan truncated away, or which outlived its
  // window, is still actionable.
  for (const [name, auc] of bids) addRow(name, domainsByName.get(name) ?? null, auc);

  // Soonest deadline first: an auction closing in an hour is the one a bidder
  // needs to see, not the one closing in six days.
  rows.sort(
    (a, b) => Number(a.auctionEndSeconds ?? 0) - Number(b.auctionEndSeconds ?? 0)
  );

  return {
    ok: true,
    data: rows,
    truncated: !!domainsRes.truncated,
    params: { graceDays, auctionDays, bidFeeUlmn },
    scannedDomains: domainsByName.size
  };
}
