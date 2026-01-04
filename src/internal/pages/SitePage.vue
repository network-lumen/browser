<template>
  <div class="site-page">
    <main class="main-content">
      <header class="content-header">
        <div>
          <h1 class="txt-lg txt-weight-strong">{{ title }}</h1>
          <p class="txt-xs color-gray-blue margin-top-10">
            <span class="mono">{{ displayUrl }}</span>
          </p>
        </div>

        <div class="header-actions">
          <button class="plans-btn" type="button" @click="copyLink" :disabled="!displayUrl">
            <Copy :size="16" />
            <span>Copy link</span>
          </button>
          <button class="plans-btn" type="button" @click="retry" :disabled="loading">
            <RefreshCw :size="16" />
            <span>Retry</span>
          </button>
        </div>
      </header>

      <div v-if="loading" class="loading-wrap">
        <UiSpinner size="md" />
        <div class="loading-lines">
          <span class="txt-xs color-gray-blue">Resolving on-chain content…</span>
          <span v-if="statusLine" class="txt-xs color-gray-blue">{{ statusLine }}</span>
        </div>
      </div>

      <div v-else-if="error" class="error-wrap">
        {{ error }}
      </div>

      <div v-else class="viewer">
        <div v-if="activeSourceLabel" class="source-pill txt-xs">
          Source: {{ activeSourceLabel }}
        </div>
        <iframe
          v-if="resolvedHttpUrl"
          class="site-frame"
          :src="resolvedHttpUrl"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-same-origin"
        ></iframe>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { Copy, RefreshCw } from 'lucide-vue-next';
import UiSpinner from '../../ui/UiSpinner.vue';

const currentTabUrl = inject<any>('currentTabUrl', null);

const loading = ref(false);
const error = ref('');
const resolvedHttpUrl = ref('');
const activeSourceLabel = ref('');
const statusLine = ref('');

type DomainTarget = { proto: 'ipfs' | 'ipns'; id: string };

function stripQueryHash(url: string): string {
  return String(url || '').split(/[?#]/, 1)[0] || '';
}

function parseLumenUrl(raw: string): { host: string; path: string; suffix: string } {
  const s = String(raw || '').trim();
  const u = /^lumen:\/\//i.test(s) ? s.slice('lumen://'.length) : s;
  const host = (u.split(/[\/?#]/, 1)[0] || '').trim();
  const afterHost = u.slice(host.length);
  const m = afterHost.match(/^([^?#]*)(.*)$/);
  const path = m?.[1] || '';
  const suffix = m?.[2] || '';
  return { host, path: path || '/', suffix };
}

function splitSubdomain(host: string): { baseDomain: string; recordKey: string | null } {
  const h = String(host || '').trim().toLowerCase();
  const parts = h.split('.').filter(Boolean);
  if (parts.length >= 3) {
    return { recordKey: parts[0] || null, baseDomain: parts.slice(1).join('.') };
  }
  return { recordKey: null, baseDomain: h };
}

function normalizePath(p: string): string {
  const raw = String(p || '').trim();
  if (!raw) return '/';
  const pathOnly = raw.split(/[?#]/, 1)[0] || '';
  if (!pathOnly.startsWith('/')) return '/' + pathOnly;
  return pathOnly;
}

function isCidLike(v: string): boolean {
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

async function resolveIpnsToCid(name: string): Promise<string | null> {
  const n = String(name || '').trim();
  if (!n) return null;
  const res = await (window as any).lumen?.ipfsResolveIPNS?.(n).catch(() => null);
  const path = String(res?.path || '');
  const m = path.match(/\/ipfs\/([^/]+)/i);
  return m && m[1] ? m[1] : null;
}

async function resolveDomainTarget(host: string): Promise<{ target: DomainTarget; baseDomain: string }> {
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

function buildCandidateUrl(base: string, target: DomainTarget, path: string, suffix: string): string {
  const b = String(base || '').replace(/\/+$/, '');
  const p = normalizePath(path);
  const sub = p === '/' ? '/' : p;
  return `${b}/${target.proto}/${target.id}${sub}${suffix || ''}`;
}

async function probeUrl(url: string, timeoutMs = 2500): Promise<boolean> {
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

let gatewayCache: { ts: number; bases: string[] } | null = null;
async function loadWhitelistedGatewayBases(): Promise<string[]> {
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

async function pickFastestSource(target: DomainTarget, path: string, suffix: string): Promise<{ base: string; label: string }> {
  const localBase = 'http://127.0.0.1:8080';
  const localP = (async () => {
    statusLine.value = 'Trying IPFS peer-to-peer…';
    const ok = await probeUrl(buildCandidateUrl(localBase, target, path, suffix), 2000);
    if (!ok) throw new Error('local_unavailable');
    return { base: localBase, label: 'Local IPFS' };
  })();

  const gatewaysP = (async () => {
    statusLine.value = 'Querying whitelisted gateways…';
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

  return await Promise.any([localP, gatewaysP]);
}

async function resolveAndLoad() {
  const url = currentTabUrl?.value || window.location.href;
  const parsed = parseLumenUrl(url);
  const host = parsed.host;
  const path = normalizePath(parsed.path || '/');
  const suffix = parsed.suffix || '';

  loading.value = true;
  error.value = '';
  resolvedHttpUrl.value = '';
  activeSourceLabel.value = '';
  statusLine.value = '';

  try {
    const { target } = await resolveDomainTarget(host);
    let effectivePath = path;

    if (effectivePath === '/' || effectivePath === '') {
      // Prefer index.html for website roots; fallback to '/' if missing.
      const indexPath = '/index.html';
      try {
        const picked = await pickFastestSource(target, indexPath, suffix);
        resolvedHttpUrl.value = buildCandidateUrl(picked.base, target, indexPath, suffix);
        activeSourceLabel.value = picked.label;
        return;
      } catch {
        // fallback below
        effectivePath = '/';
      }
    }

    const picked = await pickFastestSource(target, effectivePath, suffix);
    resolvedHttpUrl.value = buildCandidateUrl(picked.base, target, effectivePath, suffix);
    activeSourceLabel.value = picked.label;
  } catch (e: any) {
    const isAgg = typeof AggregateError !== 'undefined' && e instanceof AggregateError;
    error.value = isAgg
      ? 'No source could serve this content.'
      : String(e?.message || e || 'Unable to load this domain.');
  } finally {
    loading.value = false;
    statusLine.value = '';
  }
}

const displayUrl = computed(() => String(currentTabUrl?.value || window.location.href || '').trim());

const title = computed(() => {
  const raw = displayUrl.value;
  const host = parseLumenUrl(raw).host;
  return host || 'Site';
});

async function copyLink() {
  try {
    await navigator.clipboard.writeText(displayUrl.value);
  } catch {
    // ignore
  }
}

function retry() {
  void resolveAndLoad();
}

watch(
  () => currentTabUrl?.value,
  () => resolveAndLoad(),
  { immediate: true }
);
</script>

<style scoped>
.site-page {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--bg-primary, #ffffff);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow: hidden;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.plans-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-primary, #1e293b);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.plans-btn:hover:not(:disabled) {
  background: var(--bg-primary, #ffffff);
  border-color: #3498db;
}

.plans-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
}

.loading-lines {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.error-wrap {
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.viewer {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
}

.source-pill {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.12);
  color: var(--text-secondary, #334155);
  backdrop-filter: blur(6px);
}

.site-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
}
</style>
