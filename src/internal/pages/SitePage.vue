<template>
  <!-- ####### lumen://<domain>.lmn PERSONAL DOMAIN SITE (fallback) ####### -->
  <div class="w-full h-full min-h-0 bg-primary overflow-hidden flex" :class="{ 'fullscreen-trigger fixed inset-0 z-max bg-black': webviewHtmlFullscreen }">
    <main class="fullscreen-target flex-1 flex flex-column overflow-hidden min-h-0 p-0px">
      <div v-if="loading" class="flex-1 flex-align-justify-center">
        <UiSpinner size="lg" />
      </div>

      <div v-else-if="domainNotFound" class="flex-1 flex-align-justify-center bg-primary p-32px">
        <UiCard padding="none" :shadow="false" class="shadow-md max-w-380px">
          <UiEmptyState title="This domain belongs to no one">
            <Tag :size="26" />
            <template #description>
              <p class="m-0px max-w-520px text-14px line-height-15"><strong class="color-text-primary">{{ requestedHost }}</strong> hasn't been registered yet. You can buy it if you'd like.</p>
            </template>
            <template #actions>
              <UiButton variant="primary" type="button" @click="goToBuyDomain">
                <span>Buy this domain</span>
              </UiButton>
            </template>
          </UiEmptyState>
        </UiCard>
      </div>

      <div v-else-if="error" class="flex-1 flex-align-justify-center bg-primary p-32px">
        <UiCard padding="none" :shadow="false" class="shadow-md max-w-380px">
          <UiEmptyState title="This content isn't available right now">
            <FileQuestion :size="26" />
            <template #description>
              <p class="m-0px max-w-520px text-14px line-height-15">The content couldn't be found. Please try again later.</p>
              <p class="m-0px max-w-520px text-14px line-height-15">
                If this is your site,
                <UiButton variant="none" type="button" @click="goToCreateWebsiteDocs" class="underline color-primary cursor-pointer">read the setup guide</UiButton>.
              </p>
            </template>
          </UiEmptyState>
        </UiCard>
      </div>

      <div v-else class="fullscreen-target flex-1 min-h-0 overflow-hidden relative">
        <template v-if="resolvedHttpUrl && isHlsPath">
          <video
            ref="videoEl"
            class="w-full h-full border-none bg-primary"
            controls
            autoplay
            playsinline
          ></video>
          <div v-if="hlsError" class="absolute text-14px cursor-events-none py-12px px-16px right-16px bg-error-a15 border-1-error-a30 left-16px bottom-16px backdrop-blur-6">
            {{ hlsError }}
          </div>
        </template>
        <webview
          v-else-if="resolvedHttpUrl"
          ref="siteWebview"
          class="fullscreen-target w-full h-full border-none bg-primary"
          :src="resolvedHttpUrl"
          partition="persist:lumen"
          allowpopups
          allowfullscreen
          allow="fullscreen"
          :webpreferences="webprefs"
          @will-navigate="onWillNavigate"
          @did-navigate="onDidNavigate"
          @did-navigate-in-page="onDidNavigateInPage"
          @new-window="onNewWindow"
          @ipc-message="onIpcMessage"
          @did-start-loading="onWebviewDidStartLoading"
          @did-stop-loading="onWebviewDidStopLoading"
          @dom-ready="onDomReady"
          @enter-html-full-screen="onWebviewEnterHtmlFullscreen"
          @leave-html-full-screen="onWebviewLeaveHtmlFullscreen"
        ></webview>
        <div v-else class="w-full h-full border-none bg-primary"></div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import UiCard from '../../ui/UiCard.vue';
import UiButton from '../../ui/UiButton.vue';
import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from "vue";
import { FileQuestion, Tag } from "lucide-vue-next";
import UiSpinner from "../../ui/UiSpinner.vue";
import UiEmptyState from "../../ui/UiEmptyState.vue";
import { useTabLoadingSync } from "../useTabLoading";
import { useInternalLumen } from '../../composables/useInternalLumen';
import {
  buildCandidateUrl,
  normalizePath,
  pickFastestSource,
  resolveDomainTarget,
} from "../services/contentResolver";
import type { ActiveState } from "../../types/sitePage";
import { safeString } from "../services/coerce";
import { installExtensionFromChromeWebStore } from "../services/extensions";
import {
  getWebviewWebContentsId,
  registerWebviewFindTarget,
  retryWebviewRegistration
} from "../services/webviewRegistration";

import { useTabNavigation, useTabState } from "../../composables/useTabNavigation";
const { currentTabUrl, currentTabId, currentTabRefresh } = useTabState();
const { navigate, openInNewTab } = useTabNavigation();
const registerFindTarget = inject<((tabId: string, targetWebContentsId: number | null) => void) | null>(
  "findRegisterTarget",
  null,
);

const loading = ref(false);
const error = ref(false);
const domainNotFound = ref(false);
const requestedHost = ref("");
const resolvedHttpUrl = ref("");
const siteWebview = ref<any>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const isHlsPath = ref(false);
const hlsError = ref("");
const webviewLoading = ref(false);
const webviewHtmlFullscreen = ref(false);

useTabLoadingSync(computed(() => loading.value || webviewLoading.value));

const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";

function currentWebContentsId(): number | null {
  return getWebviewWebContentsId(siteWebview.value);
}

function registerFindTargetOnce(): number | null {
  return registerWebviewFindTarget(registerFindTarget, currentTabId?.value, currentWebContentsId());
}

function registerFindTargetWithRetry() {
  retryWebviewRegistration(
    registerFindTargetOnce,
    () => !!resolvedHttpUrl.value && !isHlsPath.value
  );
}

// Lets F12 toggle devtools for this personal-site webview even in packaged builds
// (see electron/main.cjs's siteDevtoolsTargetIds) - scoped to lumen://mysite.lmn pages only,
// unlike Ctrl+Alt+I/Ctrl+Shift+I which stay dev-build-only for everything else.
let registeredDevtoolsTargetId: number | null = null;

function registerDevtoolsTargetOnce(): number | null {
  const id = currentWebContentsId();
  if (id != null && id !== registeredDevtoolsTargetId) {
    try {
      useInternalLumen()?.devtools?.registerSiteTarget(id);
      registeredDevtoolsTargetId = id;
    } catch {
      // ignore
    }
  }
  return id;
}

function registerDevtoolsTargetWithRetry() {
  retryWebviewRegistration(
    registerDevtoolsTargetOnce,
    () => !!resolvedHttpUrl.value && !isHlsPath.value
  );
}

function unregisterDevtoolsTarget() {
  if (registeredDevtoolsTargetId == null) return;
  try {
    useInternalLumen()?.devtools?.unregisterSiteTarget(registeredDevtoolsTargetId);
  } catch {
    // ignore
  }
  registeredDevtoolsTargetId = null;
}

// Tags this webview's webContents with the domain it's showing, so permission
// prompts triggered from inside it (Pin/Send/etc.) report "web.lmn" instead of the
// resolved ipfs:/ipns: gateway URL the webview actually navigated to under the hood
// (see site:registerDomainTarget in electron/main.cjs). Re-registered on every
// resolve, not just once: the same <webview> instance is reused across navigations
// between different .lmn domains in the same tab (KeepAlive cache key is 'site' for
// all of them), so the host needs updating even though the webContents id doesn't.
let registeredDomainHost: string | null = null;
let registeredDomainWebContentsId: number | null = null;

function registerDomainTargetOnce(): number | null {
  const id = currentWebContentsId();
  const host = active.value?.host || "";
  // Re-send whenever EITHER the host or the webContents id differs from what
  // we last successfully registered - comparing the host alone is not
  // enough: on a refresh the resolved host is typically unchanged, but the
  // underlying webview's webContents id can still come back different, and
  // the previous id-agnostic check would then wrongly assume "already
  // registered" and skip re-sending, leaving the new id's registration
  // permanently missing in the main process (site:registerDomainTarget is
  // never re-sent, so senderSiteContext falls back to the raw resolved
  // ipfs/ipns address for that webContents for the rest of its lifetime).
  if (id != null && host && (host !== registeredDomainHost || id !== registeredDomainWebContentsId)) {
    try {
      useInternalLumen()?.site?.registerDomainTarget(id, host);
      registeredDomainHost = host;
      registeredDomainWebContentsId = id;
    } catch {
      // ignore
    }
  }
  return id;
}

function registerDomainTargetWithRetry(attempts = 40) {
  const id = registerDomainTargetOnce();
  if (id != null) return;
  if (attempts <= 0) return;
  if (!resolvedHttpUrl.value || isHlsPath.value) return;
  window.setTimeout(() => {
    registerDomainTargetWithRetry(attempts - 1);
  }, 50);
}

function unregisterDomainTarget() {
  if (registeredDomainHost == null) return;
  try {
    const id = registeredDomainWebContentsId ?? currentWebContentsId();
    if (id != null) useInternalLumen()?.site?.unregisterDomainTarget(id);
  } catch {
    // ignore
  }
  registeredDomainHost = null;
  registeredDomainWebContentsId = null;
}

function onDomReady() {
  webviewLoading.value = false;
  void nextTick(() => {
    registerFindTargetWithRetry();
    registerDevtoolsTargetWithRetry();
    registerDomainTargetWithRetry();
  });
}

function onWebviewEnterHtmlFullscreen() {
  webviewHtmlFullscreen.value = true;
  document.body.classList.add("lumen-webview-html-fullscreen");
  try {
    useInternalLumen()?.setWindowMode?.("fullscreen");
  } catch {}
}

function onWebviewLeaveHtmlFullscreen() {
  webviewHtmlFullscreen.value = false;
  document.body.classList.remove("lumen-webview-html-fullscreen");
  try {
    useInternalLumen()?.setWindowMode?.("exit-fullscreen");
  } catch {}
}

const active = ref<ActiveState | null>(null);

let suppressNextResolve = false;
let hlsInstance: any = null;
const IGNORABLE_HLS_WARNING_DETAILS = new Set([
  "bufferStalledError",
  "bufferNudgeOnStall",
]);

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
    if (!data?.fatal && IGNORABLE_HLS_WARNING_DETAILS.has(details)) {
      if (hlsError.value.includes(`HLS ${details}`)) hlsError.value = "";
      return;
    }
    const reason = String(data?.reason || "");
    const type = String(data?.type || "");
    const errMsg = String(data?.errorMessage(error, ""));
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
    domainNotFound.value = false;
    error.value = true;
    return;
  }

  // Avoid expensive resolve when we just updated the address bar from the webview.
  if (suppressNextResolve && !opts.force) {
    suppressNextResolve = false;
    return;
  }
  suppressNextResolve = false;

  loading.value = true;
  error.value = false;
  domainNotFound.value = false;
  requestedHost.value = host;

  try {
    const { target } = await resolveDomainTarget(host);
    const candidates = chooseCandidatePaths(canonicalPath);

    let resolvedUrl = "";
    for (const candidatePath of candidates) {
      try {
        const pickedBase = await pickFastestSource(target, candidatePath, suffix);
        resolvedUrl = buildCandidateUrl(pickedBase.base, target, candidatePath, suffix);
        break;
      } catch {
        // try next candidate
      }
    }

    if (!resolvedUrl) throw new Error("No source could serve this content.");

    // Prefer the lumen://<domain> origin over the gateway URL: the gateway host
    // carries the CID, so the site would lose all of its browser storage on
    // every republish. Registering is what keeps that origin pointing at the
    // current target. If registration fails, fall back to the gateway URL - the
    // page still works, it just gets the old, CID-scoped storage.
    try {
      const registered = await useInternalLumen()?.site?.registerHost?.(host, target);
      if (registered?.ok && registered.origin) {
        const pathForHost = canonicalPath === "/" ? "/" : canonicalPath;
        resolvedUrl = `${registered.origin}${pathForHost}${suffix || ''}`;
      }
    } catch {
      // keep the gateway URL
    }

    resolvedHttpUrl.value = resolvedUrl;
    active.value = { host, target };
  } catch (e) {
    // The resolver tags this one case with a `code` so an unregistered domain
    // gets its own screen instead of the generic failure.
    const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;
    if (code === "domain_not_registered") {
      domainNotFound.value = true;
    } else {
      error.value = true;
    }
    resolvedHttpUrl.value = "";
    active.value = null;
  } finally {
    loading.value = false;
  }
}

function goToBuyDomain() {
  navigate?.("lumen://domain/", { push: true });
}

function goToCreateWebsiteDocs() {
  navigate?.("lumen://help/publish", { push: true });
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

function onWebviewDidStartLoading() {
  webviewLoading.value = true;
}

function onWebviewDidStopLoading() {
  webviewLoading.value = false;
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
  if (channel === "extensions:installFromStore") {
    const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
    const input =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object"
          ? safeString((payload as any).id || (payload as any).url, 4096)
          : "";
    if (input) void installChromeWebStoreExtension(input);
    return;
  }
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

async function installChromeWebStoreExtension(input: string) {
  await installExtensionFromChromeWebStore(input, "site-webview");
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

watch(
  () => [resolvedHttpUrl.value, isHlsPath.value],
  async ([url, isHls]) => {
    const tabId = String(currentTabId?.value || "").trim();
    if (!tabId || typeof registerFindTarget !== "function") return;

    if (!url || isHls) {
      webviewLoading.value = false;
      try {
        registerFindTarget(tabId, null);
      } catch {
        // ignore
      }
      unregisterDevtoolsTarget();
      unregisterDomainTarget();
      return;
    }

    await nextTick();
    registerFindTargetWithRetry();
    registerDevtoolsTargetWithRetry();
    registerDomainTargetWithRetry();
  },
  { immediate: true, flush: "post" },
);

onMounted(() => {
  void nextTick(() => {
    registerFindTargetWithRetry();
    registerDevtoolsTargetWithRetry();
    registerDomainTargetWithRetry();
  });
});
onActivated(() => {
  void nextTick(() => {
    registerFindTargetWithRetry();
    registerDevtoolsTargetWithRetry();
    registerDomainTargetWithRetry();
  });
});
onDeactivated(() => {
  webviewLoading.value = false;
  try {
    const tabId = String(currentTabId?.value || "").trim();
    if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
  } catch {
    // ignore
  }
  unregisterDevtoolsTarget();
  unregisterDomainTarget();
});

onBeforeUnmount(() => {
  webviewLoading.value = false;
  onWebviewLeaveHtmlFullscreen();
  unregisterDevtoolsTarget();
  unregisterDomainTarget();
  try {
    siteWebview.value?.stop?.();
  } catch {
    // ignore
  }
  void ensureHlsStopped();
  try {
    const tabId = String(currentTabId?.value || "").trim();
    if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
  } catch {
    // ignore
  }
});
</script>

