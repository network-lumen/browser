import { t } from '../../stores/i18nStore';
import { getLocalGatewayBase } from './appSettings';
import { bytesToText } from './coerce';
import { useInternalLumen } from '../../composables/useInternalLumen';
import type { DomainTarget, ResolverRecord, GatewayCache } from '../../types/domain';

export type { DomainTarget, ResolverRecord };

export function localIpfsGatewayBase(): string {
  return getLocalGatewayBase();
}

let gatewayCache: GatewayCache = null;

export function normalizePath(p: string): string {
  const raw = String(p || '').trim();
  if (!raw) return '/';
  const pathOnly = raw.split(/[?#]/, 1)[0] || '';
  if (!pathOnly.startsWith('/')) return '/' + pathOnly;
  return pathOnly;
}

export function isCidLike(v: string): boolean {
  const s = String(v || '').trim();
  if (!s) return false;
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(s)) return true; // CIDv0
  if (/^bafy[a-z0-9]{20,}$/i.test(s)) return true; // CIDv1 (rough)
  return false;
}

function parseRecordTarget(value: any): DomainTarget | null {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const lower = v.toLowerCase();

  const normalizeBasePath = (p: string): string => {
    const n = normalizePath(p);
    if (n === '/') return '';
    return n.replace(/\/+$/, '');
  };

  const parseProto = (proto: DomainTarget['proto'], raw: string): DomainTarget | null => {
    const cleaned = String(raw || '').trim().replace(/^\/+/, '');
    if (!cleaned) return null;
    const suffixIndex = cleaned.search(/[?#]/);
    const pathOnly = (suffixIndex >= 0 ? cleaned.slice(0, suffixIndex) : cleaned) || '';
    const suffix = suffixIndex >= 0 ? cleaned.slice(suffixIndex) : '';
    const segs = pathOnly.split('/');
    const id = String(segs[0] || '').trim();
    if (!id) return null;
    const rest = segs.slice(1).join('/');
    const basePath = rest ? normalizeBasePath('/' + rest) : '';
    return { proto, id, ...(basePath ? { basePath } : {}), ...(suffix ? { suffix } : {}) };
  };

  if (lower.startsWith('ipfs://')) {
    return parseProto('ipfs', v.slice('ipfs://'.length));
  }
  if (lower.startsWith('ipns://')) {
    return parseProto('ipns', v.slice('ipns://'.length));
  }
  if (lower.startsWith('lumen://ipfs/')) {
    return parseProto('ipfs', v.slice('lumen://ipfs/'.length));
  }
  if (lower.startsWith('lumen://ipns/')) {
    return parseProto('ipns', v.slice('lumen://ipns/'.length));
  }
  if (lower.startsWith('/ipfs/')) {
    return parseProto('ipfs', v.slice('/ipfs/'.length));
  }
  if (lower.startsWith('/ipns/')) {
    return parseProto('ipns', v.slice('/ipns/'.length));
  }
  if (isCidLike(v)) return { proto: 'ipfs', id: v };
  return null;
}

function parseIpnsRecordTarget(value: any): DomainTarget | null {
  const parsed = parseRecordTarget(value);
  if (parsed) return parsed;
  const id = String(value ?? '').trim().replace(/^\/+/, '');
  if (!id || /[/?#\s]/.test(id)) return null;
  return { proto: 'ipns', id };
}

function normalizeResolverRecords(input: any): ResolverRecord[] {
  const rawRecords = Array.isArray(input)
    ? input
    : Array.isArray(input?.records)
      ? input.records
      : input && typeof input === 'object'
        ? Object.entries(input)
            .filter(([key]) => !['version', 'lumenRecordsVersion', 'createdAt', 'updatedAt'].includes(String(key)))
            .map(([key, value]) => ({ key, value }))
        : [];

  return rawRecords
    .map((record: any) => ({
      key: String(record?.key || '').trim(),
      value: String(record?.value ?? '').trim(),
    }))
    .filter((record: ResolverRecord) => record.key && record.value);
}

export function pickRecordTarget(records: ResolverRecord[]): DomainTarget | null {
  const list = normalizeResolverRecords(records);
  const preferredKeys = ['cid', 'ipfs', 'ipns', 'root', 'site', 'website'];
  for (const k of preferredKeys) {
    const rec = list.find((r) => String(r.key || '').toLowerCase() === k);
    const parsed = rec ? (k === 'ipns' ? parseIpnsRecordTarget(rec.value) : parseRecordTarget(rec.value)) : null;
    if (parsed) return parsed;
  }
  return null;
}

export async function loadStableLinkRecords(name: string): Promise<ResolverRecord[]> {
  const cid = await resolveIpnsToCid(name);
  if (!cid) return [];
  const api: any = useInternalLumen();
  if (!api || typeof api.ipfsGet !== 'function') return [];
  const res = await api.ipfsGet(`/ipfs/${cid}`, { timeoutMs: 8000 }).catch(() => null);
  if (!res?.ok) return [];
  const text = bytesToText(res.data);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return normalizeResolverRecords(parsed);
  } catch {
    return [];
  }
}

export async function resolveStableLinkTarget(name: string): Promise<DomainTarget | null> {
  const records = await loadStableLinkRecords(name);
  return pickRecordTarget(records);
}

function splitSubdomain(host: string): { baseDomain: string; recordKey: string | null } {
  const h = String(host || '').trim().toLowerCase();
  const parts = h.split('.').filter(Boolean);
  if (parts.length >= 3) {
    return { recordKey: parts[0] || null, baseDomain: parts.slice(1).join('.') };
  }
  return { recordKey: null, baseDomain: h };
}

export async function resolveIpnsToCid(name: string): Promise<string | null> {
  const n = String(name || '').trim();
  if (!n) return null;
  const res = await useInternalLumen()?.ipfsResolveIPNS?.(n).catch(() => null);
  const path = String(res?.path || '');
  const m = path.match(/\/ipfs\/([^/]+)/i);
  return m && m[1] ? m[1] : null;
}

export async function resolveDomainTarget(
  host: string
): Promise<{ target: DomainTarget; baseDomain: string }> {
  const normalizeIpfsTarget = async (t: DomainTarget): Promise<DomainTarget> => {
    if (!t || t.proto !== 'ipfs') return t;
    const id = String(t.id || '').trim();
    // CIDv0 -> CIDv1 base32 (required for localhost subdomain gateways).
    if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(id)) return t;

    const api: any = useInternalLumen();
    if (!api || typeof api.ipfsCidToBase32 !== 'function') return t;
    const res = await api.ipfsCidToBase32(id).catch(() => null);
    const next = String(res?.cid || '').trim();
    if (!next) return t;
    return { ...t, id: next };
  };

  const { baseDomain, recordKey } = splitSubdomain(host);
  const dnsApi = useInternalLumen()?.dns;
  const infoRes =
    dnsApi && typeof dnsApi.getDomainInfo === 'function'
      ? await dnsApi.getDomainInfo(baseDomain).catch(() => null)
      : null;
  const info =
    (infoRes && (infoRes.data?.domain || infoRes.data)) ||
    (infoRes && infoRes.domain) ||
    infoRes ||
    null;
  if (infoRes && infoRes.ok === false) {
    if (Number(infoRes.status) === 404) {
      const err: any = new Error('domain_not_registered');
      err.code = 'domain_not_registered';
      throw err;
    }
    const msg = String(infoRes.error || 'dns_lookup_failed');
    throw new Error(msg);
  }

  if (recordKey && info && Array.isArray(info.records)) {
    const rec = info.records.find((r: any) => String(r?.key || '').toLowerCase() === recordKey);
    const parsed = rec ? parseRecordTarget(rec.value) : null;
    if (parsed) return { target: await normalizeIpfsTarget(parsed), baseDomain };
  }

  if (info && Array.isArray(info.records)) {
    const parsed = pickRecordTarget(info.records);
    if (parsed) return { target: await normalizeIpfsTarget(parsed), baseDomain };
  }

  const cid = info?.cid ? String(info.cid).trim() : '';
  const parsedCid = cid ? parseRecordTarget(cid) : null;
  if (parsedCid) return { target: await normalizeIpfsTarget(parsedCid), baseDomain };

  const ipns = info?.ipns ? String(info.ipns).trim() : '';
  const parsedIpns = ipns ? parseIpnsRecordTarget(ipns) : null;
  if (parsedIpns) return { target: await normalizeIpfsTarget(parsedIpns), baseDomain };

  if (isCidLike(baseDomain)) return { target: await normalizeIpfsTarget({ proto: 'ipfs', id: baseDomain }), baseDomain };

  throw new Error(t('Domain is not linked to any IPFS/IPNS content.'));
}

export function buildCandidateUrl(base: string, target: DomainTarget, path: string, suffix: string): string {
  const b = String(base || '').replace(/\/+$/, '');
  const canonical = normalizePath(path);
  const effectiveSuffix = suffix || (canonical === '/' ? String(target?.suffix || '') : '');
  const basePath = target && target.basePath ? normalizePath(String(target.basePath)) : '/';
  const baseNorm = basePath === '/' ? '' : basePath.replace(/\/+$/, '');

  // If the caller already included the basePath in `path`, don't duplicate it.
  let effectivePath = canonical;
  if (baseNorm) {
    if (canonical === baseNorm || canonical.startsWith(baseNorm + '/')) {
      effectivePath = canonical;
    } else if (canonical === '/') {
      effectivePath = baseNorm + '/';
    } else {
      effectivePath = baseNorm + canonical;
    }
  }

  // Keep explicit trailing slash for directory targets.
  if (effectivePath === '') effectivePath = '/';

  // Local subdomain gateway support to fix absolute-path SPA builds (e.g. /assets/*).
  // Only enable for CIDv1 base32 (`bafy...`) because CIDv0 is case-sensitive and will be lowercased in DNS.
  try {
    const u = new URL(b);
    const host = String(u.hostname || '').toLowerCase();
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const isCidV1B32 = target.proto === 'ipfs' && /^bafy[a-z0-9]{20,}$/i.test(target.id);
    if (isLocal && isCidV1B32) {
      const port = u.port ? `:${u.port}` : '';
      const proto = u.protocol || 'http:';
      const idLower = String(target.id).toLowerCase();
      const subHost = `${idLower}.ipfs.localhost`;
      return `${proto}//${subHost}${port}${effectivePath}${effectiveSuffix}`;
    }
  } catch {}

  return `${b}/${target.proto}/${target.id}${effectivePath}${effectiveSuffix}`;
}

export async function probeUrl(url: string, timeoutMs = 2500): Promise<boolean> {
  const httpHead = useInternalLumen()?.httpHead;
  const httpGet = useInternalLumen()?.httpGet;
  if (typeof httpHead === 'function') {
    const r = await httpHead(url, { timeout: timeoutMs }).catch(() => null);
    if (r && (r.ok === true || [200, 206, 301, 302, 304, 403, 405].includes(Number(r.status)))) return true;
  }
  if (typeof httpGet === 'function') {
    const r = await httpGet(url, { timeout: timeoutMs, headers: { Range: 'bytes=0-0' } }).catch(() => null);
    if (r && (r.ok === true || [200, 206, 301, 302, 304, 403, 405].includes(Number(r.status)))) return true;
  }
  return false;
}

export async function loadWhitelistedGatewayBases(): Promise<string[]> {
  const now = Date.now();
  if (gatewayCache && now - gatewayCache.ts < 60_000) return gatewayCache.bases;

  const api: any = useInternalLumen();
  const profilesApi = api?.profiles;
  const gwApi = api?.gateway;
  if (!profilesApi || !gwApi || typeof gwApi.getPlansOverview !== 'function') {
    gatewayCache = { ts: now, bases: [] };
    return [];
  }

  const active = await profilesApi.getActive?.().catch(() => null);
  const profileId = active?.id;
  if (!profileId) {
    gatewayCache = { ts: now, bases: [] };
    return [];
  }

  const res = await gwApi
    .getPlansOverview(profileId, { includePricing: false, timeoutMs: 2500 })
    .catch(() => null);
  const list = Array.isArray(res?.gateways) ? res.gateways : [];
  const bases: string[] = [];

  if (typeof gwApi.getBaseUrl === 'function') {
    for (const g of list) {
      const hint = String(g?.endpoint ?? g?.baseUrl ?? g?.url ?? '').trim();
      if (!hint) continue;
      const out = await gwApi.getBaseUrl(profileId, hint).catch(() => null);
      const b = String(out?.baseUrl ?? out?.base_url ?? '').trim();
      if (b) bases.push(b);
    }
  }

  const uniq = Array.from(new Set(bases.map((x) => x.replace(/\/+$/, ''))));
  gatewayCache = { ts: now, bases: uniq };
  return uniq;
}

export async function pickFastestSource(
  target: DomainTarget,
  path: string,
  suffix: string,
  opts: { onStatus?: (s: string) => void } = {}
): Promise<{ base: string; label: string }> {
  const publicGatewayBases = [
    "https://ipfs.io",
    "https://dweb.link",
  ];

  const localP = (async () => {
    opts.onStatus?.(t('Trying IPFS peer-to-peer…'));
    const base = localIpfsGatewayBase();
    const ok = await probeUrl(buildCandidateUrl(base, target, path, suffix), 2000);
    if (!ok) throw new Error('local_unavailable');
    return { base, label: t('Local IPFS') };
  })();

  const gatewaysP = (async () => {
    opts.onStatus?.(t('Querying whitelisted gateways…'));
    const bases = await loadWhitelistedGatewayBases();
    if (!bases.length) throw new Error('no_gateways');
    const probes = bases.map((b) =>
      (async () => {
        const ok = await probeUrl(buildCandidateUrl(b, target, path, suffix), 2500);
        if (!ok) throw new Error('probe_failed');
        return { base: b, label: b.replace(/^https?:\/\//i, '') };
      })()
    );
    return await Promise.any(probes);
  })();

  try {
    return await Promise.any([localP, gatewaysP]);
  } catch (_e) {
    // Last-resort fallbacks: public gateways are slower and less private, so only use them
    // once local/whitelisted sources have all failed.
    opts.onStatus?.(t("Trying public IPFS gateways…"));
    const probes = publicGatewayBases.map((b) =>
      (async () => {
        const ok = await probeUrl(buildCandidateUrl(b, target, path, suffix), 4000);
        if (!ok) throw new Error("probe_failed");
        return { base: b, label: b.replace(/^https?:\/\//i, "") };
      })(),
    );
    return await Promise.any(probes);
  }
}
