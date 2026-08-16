import { useInternalLumen } from '../../composables/useInternalLumen';
import { safeNumber } from './coerce';
import type { Activity, ActivityType, ListActivitiesParams, CacheEntry } from '../../types/activities';

export type { Activity, ActivityType };

const ACTIVITIES_TTL_MS = 30_000;
const activitiesCache = new Map<string, CacheEntry>();

export function clearActivitiesCache() {
  activitiesCache.clear();
}

const KNOWN_TYPES: readonly string[] = [
  'send',
  'receive',
  'register_domain',
  'update_domain',
  'renew_domain',
  'bid',
  'settle',
  'stake',
  'unstake',
  'reward',
  'unknown'
];

/** Spellings the indexer uses for a type we already have a name for. */
const TYPE_ALIASES: Record<string, ActivityType> = {
  transfer: 'send',
  recv: 'receive',
  register: 'register_domain',
  'register-name': 'register_domain',
  update: 'update_domain',
  'update-name': 'update_domain',
  renew: 'renew_domain',
  'renew-name': 'renew_domain'
};

function toActivityType(raw: unknown): ActivityType {
  const value = String(raw ?? '').toLowerCase();
  const alias = TYPE_ALIASES[value];
  if (alias) return alias;
  return KNOWN_TYPES.includes(value) ? (value as ActivityType) : 'unknown';
}

/** The indexer sends amounts under four different shapes depending on the tx. */
function readAmounts(item: any): { denom: string; amount: string }[] | undefined {
  const raw =
    item?.amounts ??
    item?.amounts_list ??
    item?.amountsList ??
    (item?.amount && item?.denom ? [{ amount: item.amount, denom: item.denom }] : undefined) ??
    (Array.isArray(item?.amount) ? item.amount : undefined);

  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((entry: any) => ({
      denom: String(entry?.denom ?? ''),
      amount: String(entry?.amount ?? '')
    }))
    .filter((entry) => entry.denom || entry.amount);
}

/** `undefined` rather than `null`, to match the optional field on `Activity`. */
function readHeight(value: unknown): number | undefined {
  return safeNumber(value) ?? undefined;
}

/** Returns the first of `keys` that holds a non-empty value. */
function pick(item: any, keys: string[]): string {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '';
}

/** Optional string field: absent stays absent instead of becoming `''`. */
function optional(value: string): string | undefined {
  return value || undefined;
}

function normalizeFromIndexer(item: any): Activity {
  const txhash = pick(item, ['txhash', 'txHash', 'hash', 'tx_id', 'txId']);
  const timestamp = pick(item, ['timestamp', 'time', 'datetime', 'date']);
  const type = toActivityType(item?.type ?? item?.action ?? item?.event);
  const action = pick(item, ['action', 'msgType', 'msg_type']);
  const dnsName = pick(item, ['dnsName', 'dns_name', 'name']);
  const from = pick(item, ['from', 'sender', 'src', 'address_from', 'from_address']);
  const to = pick(item, ['to', 'recipient', 'dst', 'address_to', 'to_address']);
  const memo = pick(item, ['memo', 'note', 'message']);

  const id = pick(item, ['id']) || txhash || `${type}-${timestamp}-${item?.height ?? 0}`;

  return {
    id,
    txhash: txhash || id,
    type,
    action: optional(action),
    dnsName: optional(dnsName),
    timestamp,
    height: readHeight(item?.height),
    code: typeof item?.code === 'number' ? item.code : undefined,
    amounts: readAmounts(item),
    from: optional(from),
    to: optional(to),
    // `sender`/`recipient` are aliases the UI reads under either name.
    sender: optional(from),
    recipient: optional(to),
    memo: optional(memo)
  };
}

function sortDescByTime(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime() || 0;
    const tb = new Date(b.timestamp).getTime() || 0;
    return tb - ta;
  });
}

export async function fetchActivities(params: ListActivitiesParams): Promise<Activity[]> {
  const { walletId, limit = 20, offset = 0 } = params;
  const cacheKey = `${walletId}|${limit}|${offset}`;
  const now = Date.now();
  const cached = activitiesCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const walletApi = useInternalLumen()?.wallet;
  if (!walletApi || typeof walletApi.listSendTxs !== 'function') {
    activitiesCache.set(cacheKey, { data: [], expiresAt: now + ACTIVITIES_TTL_MS });
    return [];
  }

  const res = await walletApi.listSendTxs(walletId, { limit, offset });
  if (!res || res.ok === false) {
    activitiesCache.set(cacheKey, { data: [], expiresAt: now + ACTIVITIES_TTL_MS });
    return [];
  }

  const rawItems: any[] = Array.isArray(res.items) ? res.items : [];
  // The item goes through whole. It used to be rebuilt field by field from a
  // fixed list of eleven canonical names first, which dropped every alternate
  // spelling *before* normalizeFromIndexer could look for it - so the alias
  // handling below it, the entire reason that function exists, could never
  // fire. `pick` reads the canonical name first either way, so nothing about
  // the current payload changes; a renamed field upstream now survives instead
  // of silently rendering blank.
  const normalized = rawItems.map((item) => normalizeFromIndexer(item));
  const sorted = sortDescByTime(normalized);
  activitiesCache.set(cacheKey, { data: sorted, expiresAt: now + ACTIVITIES_TTL_MS });
  return sorted;
}
