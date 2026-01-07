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
        <div class="loading-lines">
          <span class="txt-xs color-gray-blue"
            >Resolving on-chain content…</span
          >
          <span v-if="statusLine" class="txt-xs color-gray-blue">{{
            statusLine
          }}</span>
        </div>
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
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        ></iframe>
        <iframe
          v-else-if="resolvedHttpUrl"
          class="site-frame"
          :src="resolvedHttpUrl"
          ref="siteFrame"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-same-origin"
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

function buildDomainSiteSrcdoc(params: {
  html: string;
  host: string;
  target: DomainTarget;
  canonicalPath: string;
  resolvedPath: string;
  suffix: string;
  baseDocUrl: string;
}): string {
  const host = String(params.host || "").trim();
  const proto = params.target.proto;
  const id = String(params.target.id || "").trim();
  const canonicalPath = String(params.canonicalPath || "/");
  const resolvedPath = String(params.resolvedPath || canonicalPath || "/");
  const suffix = String(params.suffix || "");
  const baseDocUrl = String(params.baseDocUrl || "");

  const escapedBaseHref = baseDocUrl.replace(/\"/g, "&quot;");
  const inject = `
<base href="${escapedBaseHref}" />
<script>
(function(){
  const HOST = ${JSON.stringify(host)};
  const PROTO = ${JSON.stringify(proto)};
  const ID = ${JSON.stringify(id)};
  const CANON_PATH = ${JSON.stringify(canonicalPath)};
  const RESOLVED_PATH = ${JSON.stringify(resolvedPath)};
  const BASE_DOC_URL = ${JSON.stringify(baseDocUrl)};

  const PREFIX = '/' + PROTO + '/' + ID;
  const PSEUDO_PATH = PREFIX + CANON_PATH;

  function post(msg){
    try{ parent.postMessage(Object.assign({ __lumen_site: true }, msg), '*') }catch{}
  }

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
      return 'lumen://' + HOST + u.pathname + (u.search || '') + (u.hash || '');
    }catch{
      // Absolute HTTP URLs: best-effort map back if they still point inside /<proto>/<id>/...
      try{
        const u = new URL(h, BASE_DOC_URL);
        if (!u || !u.pathname) return null;
        if (u.pathname.indexOf(PREFIX) !== 0) return null;
        const rest = u.pathname.slice(PREFIX.length) || '/';
        return 'lumen://' + HOST + rest + (u.search || '') + (u.hash || '');
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

  return safeInjectIntoHead(params.html, `\\n${inject}\\n`);
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

function onSiteMessage(evt: MessageEvent) {
  const d: any = (evt as any)?.data;
  if (!d || d.__lumen_site !== true) return;
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
  if (path === "/") return ["/", "/index.html"];
  if (/\/$/.test(path)) return [path, `${path}index.html`];
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
      resolvedSrcdoc.value = buildDomainSiteSrcdoc({
        html: htmlRes.html,
        host,
        target,
        canonicalPath: path,
        resolvedPath,
        suffix,
        baseDocUrl,
      });
      setResolvedFrameFromSrcdoc(resolvedSrcdoc.value);
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
</script>

<style scoped>
.site-page {
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-primary, #ffffff);
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
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
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
  background: #fef2f2;
  color: #b91c1c;
}

.error-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #991b1b;
}

.error-details {
  color: #7f1d1d;
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
  color: #b91c1c;
}

.error-hint {
  font-size: 0.875rem;
  font-style: italic;
  color: #dc2626;
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
  background: #ffffff;
}
</style>
