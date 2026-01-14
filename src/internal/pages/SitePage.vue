<template>
  <div class="site-page">
    <main class="main-content">
      <header v-if="error" class="content-header">
        <div class="header-actions">
          <button
            v-if="error"
            class="plans-btn"
            type="button"
            @click="retry"
            :disabled="loading"
          >
            <RefreshCw :size="16" />
            <span>Retry</span>
          </button>
        </div>
      </header>

      <div v-if="loading" class="loading-wrap">
        <UiSpinner size="md" />

      </div>

      <div v-else-if="error" class="error-wrap">
        <div class="error-content">
          <h3>{{ error }}</h3>
          <div class="error-details">
            <p>This content may not be available because:</p>
            <ul>
              <li>The content hasn't been pinned to any gateway yet</li>
              <li>The gateway servers are slow or unavailable</li>
              <li>Your local IPFS node doesn't have this content</li>
              <li>The domain record doesn't point to valid content</li>
            </ul>
            <p class="error-hint">
              Try again later or check if the content exists on IPFS.
            </p>
          </div>
        </div>
      </div>

      <div v-else class="viewer">
        <iframe
          v-if="resolvedHttpUrl && resolvedFrameUrl"
          class="site-frame"
          :src="resolvedFrameUrl"
          ref="siteFrame"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-popups"
        ></iframe>
        <iframe
          v-else-if="resolvedHttpUrl"
          class="site-frame"
          :src="resolvedHttpUrl"
          ref="siteFrame"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-popups"
        ></iframe>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { RefreshCw } from "lucide-vue-next";
import UiSpinner from "../../ui/UiSpinner.vue";
import {
  buildCandidateUrl,
  DomainTarget,
  normalizePath,
  pickFastestSource,
  resolveDomainTarget,
} from "../services/contentResolver";

const currentTabUrl = inject<any>("currentTabUrl", null);
const currentTabId = inject<any>("currentTabId", null);
const currentTabRefresh = inject<any>("currentTabRefresh", null);
const navigate = inject<
  ((url: string, opts?: { push?: boolean }) => void) | null
>("navigate", null);
const openInNewTab = inject<((url: string) => void) | null>(
  "openInNewTab",
  null,
);

const loading = ref(false);
const error = ref("");
const resolvedHttpUrl = ref("");
const resolvedSrcdoc = ref("");
const resolvedFrameUrl = ref("");
const statusLine = ref("");
const siteFrame = ref<HTMLIFrameElement | null>(null);
const active = ref<{
  host: string;
  path: string;
  suffix: string;
  proto: DomainTarget["proto"] | "";
  id: string;
  resolvedPath: string;
  resolvedHttpUrl: string;
  baseDocUrl: string;
  siteToken: string;
} | null>(null);

let resolvedFrameObjectUrl: string | null = null;
function clearResolvedFrame() {
  try {
    if (resolvedFrameObjectUrl) URL.revokeObjectURL(resolvedFrameObjectUrl);
  } catch {
    // ignore
  }
  resolvedFrameObjectUrl = null;
  resolvedFrameUrl.value = "";
}

function setResolvedFrameFromSrcdoc(srcdoc: string) {
  const html = String(srcdoc || "");
  if (!html) {
    clearResolvedFrame();
    return;
  }
  clearResolvedFrame();
  try {
    resolvedFrameObjectUrl = URL.createObjectURL(
      new Blob([html], { type: "text/html" }),
    );
    resolvedFrameUrl.value = resolvedFrameObjectUrl || "";
  } catch {
    clearResolvedFrame();
  }
}

function parseLumenUrl(raw: string): {
  host: string;
  path: string;
  suffix: string;
} {
  const s = String(raw || "").trim();
  const u = /^lumen:\/\//i.test(s) ? s.slice("lumen://".length) : s;
  const host = (u.split(/[\/?#]/, 1)[0] || "").trim();
  const afterHost = u.slice(host.length);
  const m = afterHost.match(/^([^?#]*)(.*)$/);
  const path = m?.[1] || "";
  const suffix = m?.[2] || "";
  return { host, path: path || "/", suffix };
}

function normalizeSuffix(raw: string): {
  search: string;
  hash: string;
  full: string;
} {
  const full = String(raw || "");
  const idxHash = full.indexOf("#");
  const idxQ = full.indexOf("?");
  const hasQ = idxQ >= 0 && (idxHash < 0 || idxQ < idxHash);
  const search = hasQ
    ? full.slice(idxQ, idxHash >= 0 ? idxHash : undefined)
    : "";
  const hash = idxHash >= 0 ? full.slice(idxHash) : "";
  return { search, hash, full };
}

function isOnlyHashChange(prev: string, next: string): boolean {
  const a = normalizeSuffix(prev);
  const b = normalizeSuffix(next);
  return a.search === b.search && a.hash !== b.hash;
}

function safeInjectIntoHead(html: string, inject: string): string {
  const src = String(html || "");
  const m = src.match(/<head\\b[^>]*>/i);
  if (m && m.index != null) {
    const idx = m.index + m[0].length;
    return src.slice(0, idx) + inject + src.slice(idx);
  }
  return inject + src;
}

function makeSiteToken(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function buildDomainSiteSrcdoc(params: {
  html: string;
  host: string;
  target: DomainTarget;
  canonicalPath: string;
  resolvedPath: string;
  suffix: string;
  baseDocUrl: string;
  siteToken: string;
}): string {
  const host = String(params.host || "").trim();
  const proto = params.target.proto;
  const id = String(params.target.id || "").trim();
  const targetBasePathRaw = String((params.target as any).basePath || "").trim();
  const targetBasePath = (() => {
    const s = String(targetBasePathRaw || "").trim();
    if (!s) return "";
    const n = normalizePath(s);
    return n === "/" ? "" : n.replace(/\/+$/, "");
  })();
  const canonicalPath = String(params.canonicalPath || "/");
  const resolvedPath = String(params.resolvedPath || canonicalPath || "/");
  const suffix = String(params.suffix || "");
  const baseDocUrl = String(params.baseDocUrl || "");
  const siteToken = String(params.siteToken || "");

  const escapedBaseHref = baseDocUrl.replace(/\"/g, "&quot;");
  const inject = `
<base href="${escapedBaseHref}" />
<script>
(function(){
  const HOST = ${JSON.stringify(host)};
  const PROTO = ${JSON.stringify(proto)};
  const ID = ${JSON.stringify(id)};
  const TARGET_BASE_PATH = ${JSON.stringify(targetBasePath)};
  const CANON_PATH = ${JSON.stringify(canonicalPath)};
  const RESOLVED_PATH = ${JSON.stringify(resolvedPath)};
  const BASE_DOC_URL = ${JSON.stringify(baseDocUrl)};
  const SITE_TOKEN = ${JSON.stringify(siteToken)};

  const PREFIX = '/' + PROTO + '/' + ID;
  const PSEUDO_PATH = PREFIX + CANON_PATH;

  function stripTargetBase(p){
    try{
      const path = String(p || '') || '/';
      const base = String(TARGET_BASE_PATH || '');
      if (!base) return path;
      if (path === base) return '/';
      if (path.indexOf(base + '/') === 0) return path.slice(base.length) || '/';
      return path;
    }catch{
      return String(p || '') || '/';
    }
  }

  function post(msg){
    try{ parent.postMessage(Object.assign({ __lumen_site: true }, msg), '*') }catch{}
  }

  // Minimal window.lumen bridge for lumen://domain pages.
  try{
    const pending = new Map();
    let seq = 0;

    function rpc(method, params){
      return new Promise(function(resolve){
        try{
          const id = 'rpc-' + Date.now().toString(36) + '-' + (++seq).toString(36);
          pending.set(id, resolve);
          post({ type: 'rpc', token: SITE_TOKEN, id: id, method: String(method || ''), params: params ?? null });
          setTimeout(function(){
            try{
              if (!pending.has(id)) return;
              pending.delete(id);
              resolve({ ok: false, error: 'rpc_timeout' });
            }catch{}
          }, 60000);
        }catch{
          resolve({ ok: false, error: 'rpc_failed' });
        }
      });
    }

    const lumen = window.lumen && typeof window.lumen === 'object' ? window.lumen : {};
    lumen.sendToken = function(payload){ return rpc('sendToken', payload || {}); };
    lumen.pin = function(input){
      try{
        if (input && typeof input === 'object') return rpc('pin', input);
        return rpc('pin', { cidOrUrl: String(input || '') });
      }catch{
        return rpc('pin', { cidOrUrl: String(input || '') });
      }
    };
    lumen.save = lumen.pin;
    window.lumen = lumen;

    function handleRpcResponse(d){
      try{
        if (!d || d.type !== 'rpc:response') return false;
        if (String(d.token || '') !== String(SITE_TOKEN || '')) return true;
        const id = typeof d.id === 'string' ? d.id : '';
        if (!id) return true;
        const resolve = pending.get(id);
        if (!resolve) return true;
        pending.delete(id);
        if (d.ok === true) resolve(d.result);
        else resolve({ ok: false, error: String(d.error || 'rpc_failed') });
        return true;
      }catch{
        return true;
      }
    }

    window.addEventListener('message', function(ev){
      try{
        const d = ev && ev.data ? ev.data : null;
        if (!d || d.__lumen_parent !== true) return;
        if (handleRpcResponse(d)) return;
      }catch{}
    });
  }catch{}

  function applySuffix(suf){
    try{
      const s = (typeof suf === 'string' ? suf : '').trim()
      const nextSuffix = (s && (s[0] === '?' || s[0] === '#')) ? s : ''
      if (!nextSuffix) return
      if (nextSuffix[0] === '#') {
        if (location.hash !== nextSuffix) location.hash = nextSuffix
        return
      }
      if ((location.search || '') + (location.hash || '') !== nextSuffix) {
        history.replaceState(null, '', nextSuffix)
      }
    }catch{}
    try{
      if (location.hash && location.hash.length > 1) {
        const id = decodeURIComponent(location.hash.slice(1));
        requestAnimationFrame(function(){
          try{ const el = document.getElementById(id); if (el) el.scrollIntoView(); }catch{}
        });
      }
    }catch{}
  }

  function toLumenUrl(href){
    const h = String(href || '').trim();
    if (!h) return null;
    if (/^(javascript:|mailto:|tel:)/i.test(h)) return null;
    if (h[0] === '#') return 'lumen://' + HOST + CANON_PATH + (location.search || '') + h;

    // Special-case directories resolved as index.html: keep canonical "/dir/" for ?query / #hash links.
    if ((h[0] === '?' || h[0] === '#') && /\\/index\\.html$/i.test(RESOLVED_PATH) && /\\/$/.test(CANON_PATH)) {
      return 'lumen://' + HOST + CANON_PATH + h;
    }

    // Relative links: resolve against the effective resolved path.
    try{
      const u = new URL(h, 'https://lumen.local' + RESOLVED_PATH);
      if (u.origin !== 'https://lumen.local') return null;
      const outPath = stripTargetBase(u.pathname);
      return 'lumen://' + HOST + outPath + (u.search || '') + (u.hash || '');
    }catch{
      // Absolute HTTP URLs: best-effort map back if they still point inside /<proto>/<id>/...
      try{
        const u = new URL(h, BASE_DOC_URL);
        if (!u || !u.pathname) return null;
        if (u.pathname.indexOf(PREFIX) !== 0) return null;
        const rest = u.pathname.slice(PREFIX.length) || '/';
        const outPath = stripTargetBase(rest);
        return 'lumen://' + HOST + outPath + (u.search || '') + (u.hash || '');
      }catch{
        return null;
      }
    }
  }

  applySuffix(${JSON.stringify(suffix)});

  document.addEventListener('click', function(e){
    try{
      if (!e || e.defaultPrevented) return;
      if (e.button !== 0) return;
      const el = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!el) return;
      const href = (el.getAttribute('href') || '').trim();
      if (!href) return;

      const target = (el.getAttribute('target') || '').toLowerCase();
      const wantsNewTab = target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

      const next = toLumenUrl(href);
      if (!next) return;

      e.preventDefault();
      if (wantsNewTab) post({ type: 'newtab', url: next });
      else post({ type: 'navigate', url: next });
    }catch{}
  }, true);

  window.addEventListener('message', function(ev){
    try{
      const d = ev && ev.data ? ev.data : null;
      if (!d || d.__lumen_parent !== true) return;
      if (d.type === 'setSuffix') {
        const suf = typeof d.suffix === 'string' ? d.suffix : '';
        applySuffix(suf);
      }
    }catch{}
  });

  window.addEventListener('hashchange', function(){
    try{ post({ type: 'sync', url: 'lumen://' + HOST + CANON_PATH + (location.search || '') + (location.hash || '') }) }catch{}
  });
})();
${"</scr" + "ipt>"}
`.trim();

  return safeInjectIntoHead(params.html, `\n${inject}\n`);
}

function syncSuffixToFrame(nextSuffix: string) {
  try {
    siteFrame.value?.contentWindow?.postMessage(
      {
        __lumen_parent: true,
        type: "setSuffix",
        suffix: String(nextSuffix || ""),
      },
      "*",
    );
  } catch {
    // ignore
  }
}

function safeString(v: any, maxLen = 2048): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sendRpcResponse(id: string, token: string, payload: any) {
  try {
    siteFrame.value?.contentWindow?.postMessage(
      {
        __lumen_parent: true,
        type: "rpc:response",
        id,
        token,
        ok: true,
        result: payload ?? null,
      },
      "*",
    );
  } catch {
    // ignore
  }
}

function sendRpcError(id: string, token: string, error: string) {
  try {
    siteFrame.value?.contentWindow?.postMessage(
      {
        __lumen_parent: true,
        type: "rpc:response",
        id,
        token,
        ok: false,
        error: String(error || "rpc_failed"),
      },
      "*",
    );
  } catch {
    // ignore
  }
}

async function handleSiteRpcRequest(d: any) {
  const id = safeString(d?.id, 128);
  const token = safeString(d?.token, 256);
  if (!id || !token) return;

  const curToken = safeString(active.value?.siteToken || "", 256);
  if (!curToken || token !== curToken) {
    sendRpcError(id, token, "invalid_token");
    return;
  }

  const method = safeString(d?.method, 64);
  const api: any = (window as any)?.lumen;
  const host = safeString(active.value?.host || "", 256);
  const href = safeString(currentTabUrl?.value || `lumen://${host}`, 4096);
  const tabId = safeString(currentTabId?.value || "", 256);

  if (!method) {
    sendRpcError(id, token, "missing_method");
    return;
  }

  if (method === "sendToken") {
    if (!api?.domainSite?.sendToken) {
      sendRpcError(id, token, "sendToken_unavailable");
      return;
    }
    const p = d?.params && typeof d.params === "object" ? d.params : {};
    const to = safeString(p?.to || p?.recipient || "", 256);
    const memo = safeString(p?.memo || p?.note || "", 1024);
    const amountRaw = p?.amountLmn ?? p?.amount_lmn ?? p?.amount;
    const amountNum = Number(amountRaw);
    const amountLmn = Number.isFinite(amountNum) ? amountNum : null;
    const res = await api.domainSite
      .sendToken({ tabId, host, href, to, memo, amountLmn })
      .catch((e: any) => ({ ok: false, error: String(e?.message || e || "send_failed") }));
    sendRpcResponse(id, token, res);
    return;
  }

  if (method === "pin") {
    if (!api?.domainSite?.pin) {
      sendRpcError(id, token, "pin_unavailable");
      return;
    }
    const p = d?.params && typeof d.params === "object" ? d.params : {};
    const cidOrUrl = safeString(p?.cidOrUrl ?? p?.cid ?? p?.url ?? "", 2048);
    const name = safeString(p?.name ?? p?.filename ?? p?.saveName ?? "", 256);
    const res = await api.domainSite
      .pin({ tabId, host, href, cidOrUrl, name })
      .catch((e: any) => ({ ok: false, error: String(e?.message || e || "pin_failed") }));
    sendRpcResponse(id, token, res);
    return;
  }

  sendRpcError(id, token, "unknown_method");
}

function onSiteMessage(evt: MessageEvent) {
  const d: any = (evt as any)?.data;
  const frameWin = siteFrame.value?.contentWindow || null;
  if (!frameWin || evt.source !== frameWin) return;
  if (!d || d.__lumen_site !== true) return;

  if (d.type === "rpc") {
    void handleSiteRpcRequest(d);
    return;
  }

  const next = typeof d.url === "string" ? d.url : "";
  if (!next) return;
  if (d.type === "newtab") {
    openInNewTab?.(next);
    return;
  }
  if (d.type === "sync") {
    navigate?.(next, { push: false });
    return;
  }
  if (d.type === "navigate") {
    navigate?.(next);
  }
}

function chooseCandidatePaths(p: string): string[] {
  const path = normalizePath(p || "/");
  // Prefer explicit index.html so caching/pinning stays file-scoped (avoid pinning whole directories).
  if (path === "/") return ["/index.html", "/"];
  if (/\/$/.test(path)) return [`${path}index.html`, path];
  return [path];
}

async function fetchHtml(
  url: string,
): Promise<{ ok: boolean; html?: string; contentType?: string }> {
  const u = String(url || "").trim();
  if (!u) return { ok: false };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(u, { method: "GET", signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false };
    const contentType = String(
      res.headers.get("content-type") || "",
    ).toLowerCase();
    const html = await res.text();
    return { ok: true, html, contentType };
  } catch {
    return { ok: false };
  }
}

async function resolveAndLoad() {
  const url = currentTabUrl?.value || window.location.href;
  const parsed = parseLumenUrl(url);
  const host = parsed.host;
  const path = normalizePath(parsed.path || "/");
  const suffix = parsed.suffix || "";

  const prev = active.value;
  if (
    prev &&
    prev.host === host &&
    prev.path === path &&
    prev.resolvedHttpUrl &&
    resolvedSrcdoc.value &&
    isOnlyHashChange(prev.suffix, suffix)
  ) {
    prev.suffix = suffix;
    active.value = { ...prev };
    syncSuffixToFrame(suffix);
    return;
  }

  loading.value = true;
  error.value = "";
  resolvedHttpUrl.value = "";
  resolvedSrcdoc.value = "";
  clearResolvedFrame();
  statusLine.value = "";

  try {
    const { target } = await resolveDomainTarget(host);
    const candidates = chooseCandidatePaths(path);

    let pickedBase: { base: string; label: string } | null = null;
    let resolvedPath = candidates[0] || path;
    let resolvedUrl = "";

    for (let i = 0; i < candidates.length; i++) {
      const candidatePath = candidates[i];
      try {
        pickedBase = await pickFastestSource(target, candidatePath, suffix, {
          onStatus: (s) => {
            statusLine.value = s;
          },
        });
        resolvedPath = candidatePath;
        resolvedUrl = buildCandidateUrl(
          pickedBase.base,
          target,
          candidatePath,
          suffix,
        );
        break;
      } catch {
        // try next candidate
      }
    }

    if (!pickedBase || !resolvedUrl) {
      throw new Error("No source could serve this content.");
    }

    resolvedHttpUrl.value = resolvedUrl;
    const baseDocUrl = (() => {
      try {
        const u = new URL(resolvedUrl);
        return `${u.origin}${u.pathname}`;
      } catch {
        return resolvedUrl.split("#")[0].split("?")[0];
      }
    })();

    const htmlRes = await fetchHtml(resolvedUrl.split("#")[0]);
    const isHtml =
      htmlRes.ok &&
      typeof htmlRes.html === "string" &&
      (/(^|;)\s*text\/html\b/i.test(String(htmlRes.contentType || "")) ||
        /\.html?$/i.test(resolvedPath) ||
        /^\s*<!doctype\s+html/i.test(htmlRes.html) ||
        /^\s*<html\b/i.test(htmlRes.html));

    if (isHtml && htmlRes.html) {
      const siteToken = makeSiteToken();
      resolvedSrcdoc.value = buildDomainSiteSrcdoc({
        html: htmlRes.html,
        host,
        target,
        canonicalPath: path,
        resolvedPath,
        suffix,
        baseDocUrl,
        siteToken,
      });
      setResolvedFrameFromSrcdoc(resolvedSrcdoc.value);
      active.value = {
        host,
        path,
        suffix,
        proto: target.proto,
        id: target.id,
        resolvedPath,
        resolvedHttpUrl: resolvedUrl,
        baseDocUrl,
        siteToken,
      };
      return;
    } else {
      resolvedSrcdoc.value = "";
      clearResolvedFrame();
    }

    active.value = {
      host,
      path,
      suffix,
      proto: target.proto,
      id: target.id,
      resolvedPath,
      resolvedHttpUrl: resolvedUrl,
      baseDocUrl,
      siteToken: "",
    };
  } catch (e: any) {
    const isAgg =
      typeof AggregateError !== "undefined" && e instanceof AggregateError;
    error.value = isAgg
      ? "No source could serve this content."
      : String(e?.message || e || "Unable to load this domain.");
  } finally {
    loading.value = false;
    statusLine.value = "";
  }
}

function retry() {
  void resolveAndLoad();
}

let siteMsgListenerAttached = false;
function attachSiteMsgListener() {
  if (siteMsgListenerAttached) return;
  window.addEventListener("message", onSiteMessage);
  siteMsgListenerAttached = true;
}
function detachSiteMsgListener() {
  if (!siteMsgListenerAttached) return;
  window.removeEventListener("message", onSiteMessage);
  siteMsgListenerAttached = false;
}

onMounted(() => {
  attachSiteMsgListener();
  startUrlWatch();
});
onActivated(() => {
  attachSiteMsgListener();
  startUrlWatch();
});
onDeactivated(() => {
  detachSiteMsgListener();
  stopUrlWatch();
});
onBeforeUnmount(() => {
  detachSiteMsgListener();
  clearResolvedFrame();
  stopUrlWatch();
});

let stopUrlWatchHandle: (() => void) | null = null;
function startUrlWatch() {
  if (stopUrlWatchHandle) return;
  stopUrlWatchHandle = watch(
    () => currentTabUrl?.value,
    () => resolveAndLoad(),
    { immediate: true },
  );
}
function stopUrlWatch() {
  if (!stopUrlWatchHandle) return;
  stopUrlWatchHandle();
  stopUrlWatchHandle = null;
}

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    if (pageActive.value) {
      resolveAndLoad();
    }
  }
);

</script>

<style scoped>
.site-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--bg-tertiary);
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  min-height: 0;
}

.content-header {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1rem 0;
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
  border-radius: var(--border-radius-sm);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-smooth);
}

.plans-btn:hover:not(:disabled) {
  background: var(--bg-primary);
  border-color: var(--accent-primary);
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
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.loading-lines {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.error-wrap {
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: var(--fill-error);
  color: var(--ios-red);
}

.error-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--ios-red);
}

.error-details {
  color: var(--ios-red);
}

.error-details p {
  margin-bottom: 0.75rem;
  font-size: 0.9375rem;
}

.error-details ul {
  list-style: disc;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.error-details li {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--ios-red);
}

.error-hint {
  font-size: 0.875rem;
  font-style: italic;
  color: var(--ios-red);
  margin-top: 1rem;
}

.viewer {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.site-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-primary);
}
</style>
