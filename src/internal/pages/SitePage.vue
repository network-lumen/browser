<template>
  <div class="site-page">
    <main class="main-content">
      <header v-if="error" class="content-header">
        <div class="header-actions">
          <button
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
        <div v-if="statusLine" class="loading-lines">
          <div>{{ statusLine }}</div>
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
        <template v-if="resolvedHttpUrl && isHlsPath">
          <video
            ref="videoEl"
            class="site-video"
            controls
            autoplay
            playsinline
          ></video>
          <div v-if="hlsError" class="hls-error">
            {{ hlsError }}
          </div>
        </template>
        <webview
          v-else-if="resolvedHttpUrl"
          ref="siteWebview"
          class="site-webview"
          :src="resolvedHttpUrl"
          partition="persist:lumen"
          allowpopups
          :webpreferences="webprefs"
          @will-navigate="onWillNavigate"
          @did-navigate="onDidNavigate"
          @did-navigate-in-page="onDidNavigateInPage"
          @new-window="onNewWindow"
          @ipc-message="onIpcMessage"
        ></webview>
        <div v-else class="site-empty"></div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, ref, watch } from "vue";
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
const statusLine = ref("");
const resolvedHttpUrl = ref("");
const siteWebview = ref<any>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const isHlsPath = ref(false);
const hlsError = ref("");

const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";

type ActiveState = {
  host: string;
  target: DomainTarget;
};

const active = ref<ActiveState | null>(null);

let suppressNextResolve = false;
let hlsInstance: any = null;

function parseLumenUrl(raw: string): { host: string; path: string; suffix: string } {
  const s = String(raw || "").trim();
  const u = /^lumen:\/\//i.test(s) ? s.slice("lumen://".length) : s;
  const host = (u.split(/[\/?#]/, 1)[0] || "").trim();
  const afterHost = u.slice(host.length);
  const m = afterHost.match(/^([^?#]*)(.*)$/);
  const path = m?.[1] || "";
  const suffix = m?.[2] || "";
  return { host, path: path || "/", suffix };
}

async function ensureHlsStopped() {
  try {
    if (hlsInstance && typeof hlsInstance.destroy === "function") hlsInstance.destroy();
  } catch {
    // ignore
  }
  hlsInstance = null;
  hlsError.value = "";
  try {
    if (videoEl.value) videoEl.value.src = "";
  } catch {
    // ignore
  }
}

async function ensureHlsPlaying(url: string) {
  const video = videoEl.value;
  if (!video) return;
  hlsError.value = "";

  // Safari (and some platforms) support HLS natively.
  try {
    if (typeof video.canPlayType === "function") {
      const can = video.canPlayType("application/vnd.apple.mpegurl");
      if (can === "probably" || can === "maybe") {
        await ensureHlsStopped();
        video.src = url;
        void video.play?.().catch?.(() => {});
        return;
      }
    }
  } catch {
    // ignore
  }

  const { default: Hls } = await import("hls.js");
  if (!Hls || typeof Hls.isSupported !== "function" || !Hls.isSupported()) {
    await ensureHlsStopped();
    video.src = url;
    return;
  }

  const sanitizeHlsUrl = (u: string): string =>
    String(u || "").replace(/%(?![0-9A-Fa-f]{2})/g, "%25");

  await ensureHlsStopped();
  hlsInstance = new Hls({
    lowLatencyMode: true,
    xhrSetup: (xhr: XMLHttpRequest, rawUrl: string) => {
      const nextUrl = sanitizeHlsUrl(rawUrl);
      if (nextUrl === rawUrl) return;
      try {
        xhr.open("GET", nextUrl, true);
      } catch {
        // ignore
      }
    },
  });

  hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
    void video.play?.().catch?.(() => {});
  });
  hlsInstance.on(Hls.Events.ERROR, (_evt: any, data: any) => {
    const url = String(data?.context?.url || data?.frag?.url || data?.url || "");
    const code = data?.response?.code || data?.response?.status || data?.networkDetails?.status || "";
    const details = String(data?.details || "");
    const reason = String(data?.reason || "");
    const type = String(data?.type || "");
    const errMsg = String(data?.error?.message || "");
    const respText = String(data?.response?.text || "");
    const msg = details || type || "hls_error";
    const extraBits = [reason, errMsg, respText].map((s) => String(s || "").trim()).filter(Boolean);
    const extra = extraBits.length ? ` - ${extraBits[0]}` : "";
    hlsError.value = `HLS ${msg}${extra}${code ? ` (HTTP ${code})` : ""}${url ? `: ${url}` : ""}`;
    try {
      if (data?.fatal && data?.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hlsInstance.startLoad();
      } else if (data?.fatal && data?.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hlsInstance.recoverMediaError();
      }
    } catch {
      // ignore
    }
  });

  try {
    hlsInstance.loadSource(url);
  } catch {}
  try {
    hlsInstance.attachMedia(video);
  } catch {}
}

function chooseCandidatePaths(p: string): string[] {
  const path = normalizePath(p || "/");
  // Prefer explicit index.html so gateway behavior matches /index.html resolution.
  if (path === "/") return ["/index.html", "/"];
  if (/\/$/.test(path)) return [`${path}index.html`, path];
  return [path];
}

function safeString(v: any, maxLen = 4096): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function resolveAndLoad(opts: { force?: boolean } = {}) {
  if (!currentTabUrl?.value) return;
  const url = safeString(currentTabUrl.value, 4096);
  const parsed = parseLumenUrl(url);
  const host = parsed.host;
  const canonicalPath = normalizePath(parsed.path || "/");
  const suffix = parsed.suffix || "";

  isHlsPath.value = canonicalPath.toLowerCase().endsWith(".m3u8");

  if (!host) {
    resolvedHttpUrl.value = "";
    active.value = null;
    error.value = "Invalid domain URL.";
    return;
  }

  // Avoid expensive resolve when we just updated the address bar from the webview.
  if (suppressNextResolve && !opts.force) {
    suppressNextResolve = false;
    return;
  }
  suppressNextResolve = false;

  const prev = active.value;

  loading.value = true;
  error.value = "";
  statusLine.value = "";

  try {
    const { target } = await resolveDomainTarget(host);
    const candidates = chooseCandidatePaths(canonicalPath);

    let resolvedUrl = "";
    for (const candidatePath of candidates) {
      try {
        const pickedBase = await pickFastestSource(target, candidatePath, suffix, {
          onStatus: (s) => {
            statusLine.value = s;
          },
        });
        resolvedUrl = buildCandidateUrl(pickedBase.base, target, candidatePath, suffix);
        break;
      } catch {
        // try next candidate
      }
    }

    if (!resolvedUrl) throw new Error("No source could serve this content.");
    resolvedHttpUrl.value = resolvedUrl;
    active.value = { host, target };
  } catch (e: any) {
    const isAgg =
      typeof AggregateError !== "undefined" && e instanceof AggregateError;
    error.value = isAgg
      ? "No source could serve this content."
      : String(e?.message || e || "Unable to load this domain.");
    resolvedHttpUrl.value = "";
    active.value = null;
  } finally {
    loading.value = false;
    statusLine.value = "";
  }
}

function retry() {
  void resolveAndLoad({ force: true });
}

function toLumenFromWebHref(raw: string): string | null {
  const href = safeString(raw, 4096);
  const ctx = active.value;
  if (!href || !ctx) return null;

  try {
    const u = new URL(href);
    const pathname = String(u.pathname || "/");
    const proto = String(ctx.target.proto || "").toLowerCase();
    const id = String(ctx.target.id || "").trim();
    if (!proto || !id) return null;

    const prefix = `/${proto}/${id}`;

    let rest = "";
    const pathLower = pathname.toLowerCase();
    const prefixLower = prefix.toLowerCase();

    // Path-style gateway: http://127.0.0.1:8080/ipfs/<cid>/...
    if (pathLower.startsWith(prefixLower)) {
      rest = pathname.slice(prefix.length) || "/";
    } else {
      // Subdomain-style gateway: http://<cid>.ipfs.localhost:8080/...
      const hostname = String(u.hostname || "").toLowerCase();
      const idLower = id.toLowerCase();
      const expectedPrefix = `${idLower}.${proto}.`;
      if (!hostname.startsWith(expectedPrefix)) return null;
      rest = pathname || "/";
    }
    if (!rest.startsWith("/")) rest = "/" + rest;

    const basePathRaw = String(ctx.target.basePath || "").trim();
    const basePath = basePathRaw ? normalizePath(basePathRaw) : "";
    const baseNorm = basePath && basePath !== "/" ? basePath.replace(/\/+$/, "") : "";
    if (baseNorm) {
      if (rest === baseNorm) rest = "/";
      else if (rest.startsWith(baseNorm + "/")) rest = rest.slice(baseNorm.length) || "/";
    }

    let outPath = rest || "/";
    if (!outPath.startsWith("/")) outPath = "/" + outPath;

    // Canonicalize directory index paths for nicer lumen://<domain>/ URLs.
    if (/\/index\.html$/i.test(outPath)) outPath = outPath.replace(/index\.html$/i, "");
    if (!outPath) outPath = "/";

    return `lumen://${ctx.host}${outPath}${u.search || ""}${u.hash || ""}`;
  } catch {
    return null;
  }
}

function toLumenIpfsOrIpnsFromWebHref(raw: string): string | null {
  const href = safeString(raw, 4096);
  if (!href) return null;
  try {
    const u = new URL(href);
    const pathname = String(u.pathname || "");
    const hostname = String(u.hostname || "").trim();

    // Subdomain gateway support: http://<cid>.ipfs.localhost:8080/...
    if (hostname) {
      const h = hostname.toLowerCase();
      let mHost = h.match(/^([a-z0-9]+)\.(ipfs|ipns)\./i);
      if (mHost && mHost[1] && mHost[2]) {
        const id = mHost[1];
        const kind = String(mHost[2]).toLowerCase();
        const rest = pathname || "/";
        return `lumen://${kind}/${id}${rest}${u.search || ""}${u.hash || ""}`;
      }
    }

    let m = pathname.match(/^\/ipfs\/([^/]+)(\/.*)?$/i);
    if (m) {
      const cid = m[1] || "";
      const rest = m[2] || "";
      return `lumen://ipfs/${cid}${rest}${u.search || ""}${u.hash || ""}`;
    }
    m = pathname.match(/^\/ipns\/([^/]+)(\/.*)?$/i);
    if (m) {
      const name = m[1] || "";
      const rest = m[2] || "";
      return `lumen://ipns/${name}${rest}${u.search || ""}${u.hash || ""}`;
    }
    return null;
  } catch {
    return null;
  }
}

function syncNavFromWebview(rawUrl: string, opts: { push?: boolean } = {}) {
  if (!navigate) return;
  const next = toLumenFromWebHref(rawUrl);
  if (!next) return;
  const cur = safeString(currentTabUrl?.value, 4096);
  if (cur && cur === next) return;
  suppressNextResolve = true;
  navigate(next, { push: opts.push ?? true });
}

function onWillNavigate(ev: any) {
  const href = safeString(ev?.url, 4096);
  if (!href) return;
  if (/^\s*lumen:\/\//i.test(href)) {
    ev.preventDefault?.();
    navigate?.(href.trim(), { push: true });
    return;
  }
  try {
    const u = new URL(href);
    const proto = (u.protocol || "").replace(":", "").toLowerCase();
    if (proto !== "http" && proto !== "https") {
      ev.preventDefault?.();
      return;
    }

    // Keep domain tabs scoped to the resolved /ipfs|ipns target.
    const inside = toLumenFromWebHref(href);
    if (inside) return;

    const lumen = toLumenIpfsOrIpnsFromWebHref(href);
    if (lumen) {
      ev.preventDefault?.();
      openInNewTab?.(lumen);
      return;
    }

    ev.preventDefault?.();
    openInNewTab?.(href);
  } catch {
    ev.preventDefault?.();
  }
}

function onDidNavigate(ev: any) {
  syncNavFromWebview(String(ev?.url || ""), { push: true });
}

function onDidNavigateInPage(ev: any) {
  syncNavFromWebview(String(ev?.url || ""), { push: true });
}

function onNewWindow(ev: any) {
  ev.preventDefault?.();
  const href = safeString(ev?.url, 4096);
  if (!href) return;
  const domain = toLumenFromWebHref(href);
  if (domain) {
    openInNewTab?.(domain);
    return;
  }
  const lumen = toLumenIpfsOrIpnsFromWebHref(href);
  if (lumen) {
    openInNewTab?.(lumen);
    return;
  }
  if (/^\s*https?:\/\//i.test(href)) openInNewTab?.(href.trim());
}

function onIpcMessage(ev: any) {
  const channel = safeString(ev?.channel, 64);
  if (channel !== "lumen:navigate") return;

  const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
  const url =
    typeof payload === "string"
      ? payload
      : payload && typeof payload === "object" && typeof (payload as any).url === "string"
        ? (payload as any).url
        : "";
  const href = safeString(url, 4096);
  if (!/^lumen:\/\//i.test(href)) return;

  const openInNewTabFlag =
    !!(payload && typeof payload === "object" && (payload as any).openInNewTab);
  if (openInNewTabFlag) openInNewTab?.(href);
  else navigate?.(href, { push: true });
}

watch(
  () => currentTabUrl?.value,
  () => {
    void resolveAndLoad();
  },
  { immediate: true },
);

watch(
  () => currentTabRefresh?.value,
  () => {
    try {
      siteWebview.value?.reload?.();
    } catch {
      // ignore
    }
    void resolveAndLoad({ force: true });
  },
);

watch(
  () => [
    resolvedHttpUrl.value,
    isHlsPath.value,
    loading.value,
    error.value,
    !!videoEl.value,
  ],
  async ([url, isHls, isLoading, err, hasVideo]) => {
    if (isLoading || err) {
      await ensureHlsStopped();
      return;
    }
    if (isHls && url && hasVideo) {
      await ensureHlsPlaying(String(url));
    } else {
      await ensureHlsStopped();
    }
  },
  { immediate: true, flush: "post" },
);

onBeforeUnmount(() => {
  try {
    siteWebview.value?.stop?.();
  } catch {
    // ignore
  }
  void ensureHlsStopped();
});
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
  color: var(--text-secondary);
  font-size: 0.875rem;
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

.site-webview,
.site-video,
.site-empty {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-primary);
}

.hls-error {
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: rgba(254, 202, 202, 0.18);
  color: var(--ios-red);
  font-size: 0.875rem;
  backdrop-filter: blur(6px);
  pointer-events: none;
}
</style>
