import { getLocalGatewayBase } from './appSettings';

export type DomainTarget = { proto: 'ipfs' | 'ipns'; id: string };

export function localIpfsGatewayBase(): string {
  return getLocalGatewayBase();
}

type GatewayCache = { ts: number; bases: string[] } | null;
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
  if (lower.startsWith('ipfs://')) {
    const id = v.slice('ipfs://'.length).replace(/^\/+/, '').split(/[/?#]/, 1)[0];
    return id ? { proto: 'ipfs', id } : null;
  }
  if (lower.startsWith('ipns://')) {
    const id = v.slice('ipns://'.length).replace(/^\/+/, '').split(/[/?#]/, 1)[0];
    return id ? { proto: 'ipns', id } : null;
  }
  if (lower.startsWith('lumen://ipfs/')) {
    const id = v.slice('lumen://ipfs/'.length).replace(/^\/+/, '').split(/[/?#]/, 1)[0];
    return id ? { proto: 'ipfs', id } : null;
  }
  if (lower.startsWith('lumen://ipns/')) {
    const id = v.slice('lumen://ipns/'.length).replace(/^\/+/, '').split(/[/?#]/, 1)[0];
    return id ? { proto: 'ipns', id } : null;
  }
  if (isCidLike(v)) return { proto: 'ipfs', id: v };
  return null;
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
  const res = await (window as any).lumen?.ipfsResolveIPNS?.(n).catch(() => null);
  const path = String(res?.path || '');
  const m = path.match(/\/ipfs\/([^/]+)/i);
  return m && m[1] ? m[1] : null;
}

export async function resolveDomainTarget(
  host: string
): Promise<{ target: DomainTarget; baseDomain: string }> {
  const { baseDomain, recordKey } = splitSubdomain(host);
  const dnsApi = (window as any).lumen?.dns;
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
    const msg = String(infoRes.error || 'dns_lookup_failed');
    throw new Error(msg);
  }

  if (recordKey && info && Array.isArray(info.records)) {
    const rec = info.records.find((r: any) => String(r?.key || '').toLowerCase() === recordKey);
    const parsed = rec ? parseRecordTarget(rec.value) : null;
    if (parsed) return { target: parsed, baseDomain };
  }

  if (info && Array.isArray(info.records)) {
    const preferredKeys = ['cid', 'ipfs', 'ipns', 'root', 'site', 'website'];
    for (const k of preferredKeys) {
      const rec = info.records.find((r: any) => String(r?.key || '').toLowerCase() === k);
      const parsed = rec ? parseRecordTarget(rec.value) : null;
      if (parsed) return { target: parsed, baseDomain };
    }
  }

  const cid = info?.cid ? String(info.cid).trim() : '';
  if (cid && isCidLike(cid)) return { target: { proto: 'ipfs', id: cid }, baseDomain };

  const ipns = info?.ipns ? String(info.ipns).trim() : '';
  if (ipns) return { target: { proto: 'ipns', id: ipns }, baseDomain };

  if (isCidLike(baseDomain)) return { target: { proto: 'ipfs', id: baseDomain }, baseDomain };

  throw new Error('Domain is not linked to any IPFS/IPNS content.');
}

export function buildCandidateUrl(base: string, target: DomainTarget, path: string, suffix: string): string {
  const b = String(base || '').replace(/\/+$/, '');
  const p = normalizePath(path);
  const sub = p === '/' ? '/' : p;
  return `${b}/${target.proto}/${target.id}${sub}${suffix || ''}`;
}

export async function probeUrl(url: string, timeoutMs = 2500): Promise<boolean> {
  const httpHead = (window as any).lumen?.httpHead;
  const httpGet = (window as any).lumen?.httpGet;
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

  const api: any = (window as any).lumen;
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

  const res = await gwApi.getPlansOverview(profileId).catch(() => null);
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
    "https://cloudflare-ipfs.com",
  ];

  const localP = (async () => {
    opts.onStatus?.('Trying IPFS peer-to-peer…');
    const base = localIpfsGatewayBase();
    const ok = await probeUrl(buildCandidateUrl(base, target, path, suffix), 2000);
    if (!ok) throw new Error('local_unavailable');
    return { base, label: 'Local IPFS' };
  })();

  const gatewaysP = (async () => {
    opts.onStatus?.('Querying whitelisted gateways…');
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
    opts.onStatus?.("Trying public IPFS gateways…");
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
