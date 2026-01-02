export type ActivityType =
  | 'send'
  | 'receive'
  | 'register_domain'
  | 'update_domain'
  | 'renew_domain'
  | 'bid'
  | 'settle'
  | 'stake'
  | 'unstake'
  | 'reward'
  | 'unknown';

export interface Activity {
  id: string;
  txhash: string;
  type: ActivityType;
  timestamp: string;
  height?: number;
  code?: number;
  amounts?: { denom: string; amount: string }[];
  from?: string;
  to?: string;
  memo?: string;
  sender?: string;
  recipient?: string;
}

type ListActivitiesParams = { walletId: string; limit?: number; offset?: number };

type CacheEntry = { data: Activity[]; expiresAt: number };

const ACTIVITIES_TTL_MS = 30_000;
const activitiesCache = new Map<string, CacheEntry>();

function toActivityType(t: any): ActivityType {
  const s = String(t ?? '').toLowerCase();
  const known: ActivityType[] = [
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
  const mapped =
    s === 'transfer'
      ? 'send'
      : s === 'recv'
        ? 'receive'
        : s === 'register' || s === 'register-name'
          ? 'register_domain'
          : s === 'update' || s === 'update-name'
            ? 'update_domain'
            : s === 'renew' || s === 'renew-name'
              ? 'renew_domain'
              : (known as string[]).includes(s)
                ? (s as ActivityType)
                : 'unknown';
  return mapped as ActivityType;
}

function normalizeFromIndexer(item: any): Activity {
  const txhash =
    item?.txhash ?? item?.txHash ?? item?.hash ?? item?.tx_id ?? item?.txId ?? '';
  const timestamp: string =
    item?.timestamp ?? item?.time ?? item?.datetime ?? item?.date ?? '';
  const type = toActivityType(item?.type ?? item?.action ?? item?.event);
  const id =
    item?.id ??
    txhash ??
    `${type}-${timestamp}-${item?.height ?? 0}`;
  const rawAmounts =
    item?.amounts ??
    item?.amounts_list ??
    item?.amountsList ??
    (item?.amount && item?.denom
      ? [{ amount: String(item.amount), denom: String(item.denom) }]
      : undefined) ??
    (Array.isArray(item?.amount) ? item.amount : undefined);
  const from = item?.from ?? item?.sender ?? item?.src ?? item?.address_from ?? item?.from_address;
  const to = item?.to ?? item?.recipient ?? item?.dst ?? item?.address_to ?? item?.to_address;
  const memo = item?.memo ?? item?.note ?? item?.message;

  const height =
    typeof item?.height === 'number'
      ? item.height
      : typeof item?.height === 'string'
        ? Number.parseInt(item.height, 10)
        : undefined;

  const amounts = Array.isArray(rawAmounts)
    ? rawAmounts
        .map((a) => ({
          denom: String(a?.denom ?? ''),
          amount: String(a?.amount ?? '')
        }))
        .filter((a) => a.denom || a.amount)
    : undefined;

  const code = typeof item?.code === 'number' ? item.code : undefined;
  const sender = from;
  const recipient = to;

  return {
    id: String(id),
    txhash: String(txhash || id),
    type,
    timestamp: String(timestamp || ''),
    height: Number.isFinite(height as number) ? (height as number) : undefined,
    code,
    amounts,
    from: from ? String(from) : undefined,
    to: to ? String(to) : undefined,
    sender: sender ? String(sender) : undefined,
    recipient: recipient ? String(recipient) : undefined,
    memo: memo ? String(memo) : undefined
  };
}

function sortDescByTime(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime() || 0;
    const tb = new Date(b.timestamp).getTime() || 0;
    return tb - ta;
  });
}

async function httpGetJson(url: string): Promise<any | null> {
  // Not used anymore: activities now come directly from the chain
  // via the Electron wallet:listSendTxs IPC. Kept for compatibility.
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchActivities(params: ListActivitiesParams): Promise<Activity[]> {
  const { walletId, limit = 20, offset = 0 } = params;
  const cacheKey = `${walletId}|${limit}|${offset}`;
  const now = Date.now();
  const cached = activitiesCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const anyWindow = window as any;
  const walletApi = anyWindow?.lumen?.wallet;
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
  const normalized = rawItems.map((item) =>
    normalizeFromIndexer({
      txhash: item.txhash,
      timestamp: item.timestamp,
      height: item.height,
      type: item.type,
      code: item.code,
      amounts: item.amounts,
      from: item.from,
      to: item.to,
      memo: item.memo
    })
  );
  const sorted = sortDescByTime(normalized);
  activitiesCache.set(cacheKey, { data: sorted, expiresAt: now + ACTIVITIES_TTL_MS });
  return sorted;
}
