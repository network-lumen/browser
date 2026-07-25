<template>
  <div class="bg-gradient-extensions-store w-full h-full min-h-0 flex flex-column">
    <header class="flex-align-center-justify-space-between flex-wrap-wrap gap-16px border-bottom-1-slate-a16 pt-20px px-24px pb-16px">
      <div class="">
        <h1 class="color-store-heading">{{ headerTitle }}</h1>
        <p class="m-0px mt-8px max-w-760px color-store-subtitle" v-if="headerDescription">{{ headerDescription }}</p>
      </div>

      <div v-if="storeInstallId" class="flex-align-center flex-wrap-wrap flex-justify-end gap-10px flex-1-1-420px">
        <button
          type="button"
          class="disabled-fade-50 cursor-pointer border-none py-12px px-16px color-white min-w-170px min-h-48px color-store-button bg-gradient-teal-sky shadow-0-18-40-rgba-14-165-233-0-26"
          :disabled="installInFlight"
          @click="importCurrentExtension"
        >
          {{ primaryActionLabel }}
        </button>
      </div>
    </header>

    <div v-if="statusMessage" class="border-radius-14px py-12px px-16px color-store-info bg-rgba-37-99-235-a18 mt-0px mx-24px mb-16px" :class="{ 'color-store-error bg-rgba-185-28-28-a20': statusError }">
      {{ statusMessage }}
    </div>

    <webview
      v-if="storeTargetUrl"
      ref="webviewRef"
      class="flex-1 overflow-hidden min-h-0 border-1-slate-a16 border-radius-20px bg-white mt-12px mx-24px mb-24px"
      :src="storeTargetUrl"
      :useragent="storeUserAgent"
      partition="persist:lumen-store"
      allowpopups
      :webpreferences="webprefs"
      @will-navigate="onWillNavigate"
      @did-navigate="onDidNavigate"
      @did-navigate-in-page="onDidNavigateInPage"
      @did-fail-load="onDidFailLoad"
      @new-window="onNewWindow"
      @ipc-message="onIpcMessage"
      @did-start-loading="onDidStartLoading"
      @did-stop-loading="onDidStopLoading"
      @page-title-updated="onPageTitleUpdated"
      @dom-ready="onDomReady"
    ></webview>

    <footer class="flex-align-center flex-wrap-wrap text-11px gap-12px line-height-14 color-store-footnote mt-0px mx-24px mb-18px">
      <span><strong class="txt-weight-light color-store-strong">Official listing:</strong> Chrome Web Store content is provided by Google.</span>
      <span><strong class="txt-weight-light color-store-strong">Lumen install:</strong> installation is handled by Lumen.</span>
      <span><strong class="txt-weight-light color-store-strong">Affiliation:</strong> Lumen is independent and is not affiliated with Google.</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from "vue";
import { isBrowserUrl } from "../navigationUrl";
import { useTabLoadingSync } from "../useTabLoading";
import { useInternalLumen } from '../../composables/useInternalLumen';

const DEFAULT_STORE_URL = "https://chromewebstore.google.com/category/extensions";
const STORE_SEARCH_BASE_URL = "https://chromewebstore.google.com/search/";
const CRX_DOWNLOAD_MARKER = "clients2.google.com/service/update2/crx";
const FALLBACK_STORE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const currentTabUrl = inject<any>("currentTabUrl", null);
const currentTabId = inject<any>("currentTabId", null);
const currentTabRefresh = inject<any>("currentTabRefresh", null);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>("navigate", null);
const openInNewTab = inject<((url: string) => void) | null>("openInNewTab", null);
const registerFindTarget = inject<((tabId: string, targetWebContentsId: number | null) => void) | null>(
  "findRegisterTarget",
  null,
);

const webviewRef = ref<any>(null);
const pageActive = ref(false);
const pendingAppNav = ref(false);
const skipNextRouteLoadUrl = ref("");
const webviewLoading = ref(false);
const addressInput = ref("");
const statusMessage = ref("");
const statusError = ref(false);
const installInFlight = ref(false);
const storePageTitle = ref("");
const storeListingVersion = ref("");
const installedExtensions = ref<Array<{ id: string; version: string; enabled: boolean; loaded: boolean }>>([]);
let removeExtensionsChangedListener: (() => void) | null = null;

useTabLoadingSync(webviewLoading);

const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";

function buildChromeLikeUserAgent() {
  const base = safeString(window?.navigator?.userAgent || "", 1024);
  const stripped = base
    .replace(/\sElectron\/[^\s]+/gi, "")
    .replace(/\sLumen\/[^\s]+/gi, "")
    .trim();
  if (/\bChrome\/\d+/i.test(stripped)) return stripped;
  return FALLBACK_STORE_USER_AGENT;
}

const storeUserAgent = buildChromeLikeUserAgent();

function safeString(value: unknown, maxLen = 4096) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function isChromeWebStoreUrl(raw: string): boolean {
  try {
    const url = new URL(String(raw || "").trim());
    const host = String(url.hostname || "").trim().toLowerCase();
    return host === "chromewebstore.google.com" || host.endsWith(".chromewebstore.google.com");
  } catch {
    return false;
  }
}

function isChromeCrxDownloadUrl(raw: string): boolean {
  const value = safeString(raw, 8192).toLowerCase();
  return value.includes(CRX_DOWNLOAD_MARKER);
}

function extractChromeWebStoreId(input: string) {
  const raw = safeString(input, 4096);
  if (!raw) return "";

  const direct = raw.match(/\b([a-p]{32})\b/i);
  if (direct) return String(direct[1] || "").toLowerCase();

  try {
    const url = new URL(raw);
    const segments = String(url.pathname || "")
      .split("/")
      .map((segment) => safeString(segment, 128))
      .filter(Boolean);
    const fromPath = segments.find((segment) => /^[a-p]{32}$/i.test(segment));
    if (fromPath) return String(fromPath).toLowerCase();

    const fromSearch =
      safeString(url.searchParams.get("id"), 64) ||
      safeString(url.searchParams.get("extension_id"), 64);
    if (/^[a-p]{32}$/i.test(fromSearch)) return fromSearch.toLowerCase();

    const x = safeString(url.searchParams.get("x"), 4096);
    if (x) {
      const nested = decodeURIComponent(x);
      const nestedMatch = nested.match(/(?:^|&)id=([a-p]{32})(?:&|$)/i);
      if (nestedMatch) return String(nestedMatch[1] || "").toLowerCase();
    }
  } catch {
    // ignore
  }

  return "";
}

function buildDetailUrl(extensionId: string) {
  const id = safeString(extensionId, 64);
  return id ? `https://chromewebstore.google.com/detail/${id}` : DEFAULT_STORE_URL;
}

function buildSearchUrl(query: string) {
  const q = safeString(query, 512);
  return q ? `${STORE_SEARCH_BASE_URL}${encodeURIComponent(q)}` : DEFAULT_STORE_URL;
}

function humanizeSlug(raw: string) {
  const slug = safeString(raw, 256).replace(/[-_]+/g, " ").trim();
  if (!slug) return "";
  return slug.replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripStoreTitle(raw: string) {
  return safeString(raw, 256)
    .replace(/\s*-\s*Chrome Web Store\s*$/i, "")
    .replace(/\s*-\s*Google Chrome\s*$/i, "")
    .trim();
}

function normalizeVersion(raw: unknown) {
  return safeString(raw, 128).replace(/^v/i, "");
}

function compareVersions(a: unknown, b: unknown) {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  if (!left && !right) return 0;
  if (left && !right) return 1;
  if (!left && right) return -1;

  const toParts = (value: string) =>
    value
      .split(/[^0-9A-Za-z]+/)
      .filter(Boolean)
      .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));

  const l = toParts(left);
  const r = toParts(right);
  const len = Math.max(l.length, r.length);
  for (let i = 0; i < len; i += 1) {
    const lp = l[i];
    const rp = r[i];
    if (lp === undefined && rp === undefined) return 0;
    if (lp === undefined) return -1;
    if (rp === undefined) return 1;
    if (typeof lp === "number" && typeof rp === "number") {
      if (lp > rp) return 1;
      if (lp < rp) return -1;
      continue;
    }
    const ls = String(lp);
    const rs = String(rp);
    if (ls > rs) return 1;
    if (ls < rs) return -1;
  }
  return 0;
}

function describeStoreTarget(raw: string) {
  const fallback = {
    kind: "browse",
    title: "Extensions",
    subtitle: "Browse official Chrome Web Store pages in Lumen. Discovery stays on the official listing while installation is handled by the browser.",
  };
  const href = safeString(raw, 8192);
  if (!href) return fallback;

  try {
    const url = new URL(href);
    const segments = String(url.pathname || "")
      .split("/")
      .map((segment) => safeString(segment, 256))
      .filter(Boolean);
    const extensionId = segments.find((segment) => /^[a-p]{32}$/i.test(segment)) || "";

    if (segments[0] === "detail") {
      const slug = humanizeSlug(segments[1] || "");
      return {
        kind: "detail",
        extensionId,
        title: slug || "Chrome Extension",
        subtitle: "Official listing open in Lumen. Installation is performed by Lumen after CRX verification and permission review.",
      };
    }

    if (segments[0] === "search") {
      const query = humanizeSlug(decodeURIComponent(segments.slice(1).join(" ") || ""));
      return {
        kind: "search",
        extensionId: "",
        title: query ? `Search: ${query}` : "Search Extensions",
        subtitle: "Search the official Chrome Web Store inside Lumen, then install compatible extensions with Lumen's native flow.",
      };
    }
  } catch {
    // ignore
  }

  return fallback;
}

function buildRouteUrl(targetUrl: string) {
  const normalized = safeString(targetUrl, 8192);
  const params = new URLSearchParams();
  if (normalized) params.set("url", normalized);
  const query = params.toString();
  return query ? `lumen://extensions?${query}` : "lumen://extensions";
}

function readRouteStoreUrl(raw: string) {
  const value = safeString(raw, 8192);
  if (!/^lumen:\/\//i.test(value)) return DEFAULT_STORE_URL;
  try {
    const queryString = value.includes("?") ? value.split("?", 2)[1] : "";
    const params = new URLSearchParams(queryString || "");
    const directUrl = safeString(params.get("url"), 8192);
    if (isChromeWebStoreUrl(directUrl)) return directUrl;

    const input = safeString(params.get("input"), 4096);
    const id = extractChromeWebStoreId(input);
    if (id) return buildDetailUrl(id);
    if (input) return buildSearchUrl(input);
  } catch {
    // ignore
  }
  return DEFAULT_STORE_URL;
}

function navigateStore(rawUrl: string, push = false) {
  const href = safeString(rawUrl, 8192);
  if (!href || !navigate) return;
  const next = buildRouteUrl(href);
  const current = safeString(currentTabUrl?.value, 8192);
  if (current === next) return;
  navigate(next, { push });
}

const routeTabUrl = computed(() => safeString(currentTabUrl?.value, 8192));
const storeTargetUrl = computed(() => {
  const raw = routeTabUrl.value;
  if (!raw) return "";
  return readRouteStoreUrl(raw);
});
const storeTargetInfo = computed(() => describeStoreTarget(storeTargetUrl.value));
const storeInstallId = computed(() => {
  const fromRoute = extractChromeWebStoreId(storeTargetUrl.value);
  if (fromRoute) return fromRoute;
  return extractChromeWebStoreId(addressInput.value);
});
const installedExtension = computed(() => {
  const id = storeInstallId.value;
  if (!id) return null;
  return installedExtensions.value.find((entry) => entry.id === id) || null;
});
const extensionUpdateAvailable = computed(() => {
  const installed = installedExtension.value;
  const listingVersion = normalizeVersion(storeListingVersion.value);
  if (!installed || !listingVersion) return false;
  return compareVersions(listingVersion, installed.version) > 0;
});
const primaryActionKind = computed<"install" | "remove" | "update">(() => {
  if (installedExtension.value) {
    return extensionUpdateAvailable.value ? "update" : "remove";
  }
  return "install";
});
const primaryActionLabel = computed(() => {
  if (installInFlight.value) {
    if (primaryActionKind.value === "remove") return "Removing…";
    if (primaryActionKind.value === "update") return "Updating…";
    return "Installing…";
  }
  if (primaryActionKind.value === "remove") return "Remove";
  if (primaryActionKind.value === "update") return "Update";
  return "Install in Lumen";
});
const headerTitle = computed(() => {
  return stripStoreTitle(storePageTitle.value) || storeTargetInfo.value.title;
});
const headerDescription = computed(() => {
  if (storeInstallId.value) {
    return "Official Chrome Web Store listing.";
  }
  return storeTargetInfo.value.subtitle;
});

function getWebviewCurrentUrl(): string {
  const w: any = webviewRef.value;
  if (!w) return "";
  try {
    if (typeof w.getURL === "function") {
      return safeString(w.getURL(), 8192);
    }
  } catch {
    // ignore
  }
  return safeString(w?.src || "", 8192);
}

function loadUrl(target: string) {
  const href = safeString(target, 8192);
  const w: any = webviewRef.value;
  if (!w || !href) return;
  try {
    pendingAppNav.value = true;
    statusMessage.value = "";
    statusError.value = false;
    webviewLoading.value = true;
    const current = getWebviewCurrentUrl();
    const currentSrc = safeString(w?.src || "", 8192);
    if (current === href || currentSrc === href) {
      pendingAppNav.value = false;
      webviewLoading.value = false;
      return;
    }
    w.src = href;
  } catch {
    pendingAppNav.value = false;
    webviewLoading.value = false;
  }
}

function registerFindTargetOnce() {
  const tabId = safeString(currentTabId?.value, 256);
  if (!tabId || typeof registerFindTarget !== "function") return null;
  const w: any = webviewRef.value;
  if (!w || typeof w.getWebContentsId !== "function") return null;
  try {
    const id = w.getWebContentsId();
    registerFindTarget(tabId, typeof id === "number" && Number.isFinite(id) ? id : null);
    return id;
  } catch {
    return null;
  }
}

function registerFindTargetWithRetry(attempts = 40) {
  const id = registerFindTargetOnce();
  if (id != null) return;
  if (attempts <= 0) return;
  window.setTimeout(() => registerFindTargetWithRetry(attempts - 1), 50);
}

function onDomReady() {
  webviewLoading.value = false;
  void nextTick(() => registerFindTargetWithRetry());
}

function onPageTitleUpdated(ev: any) {
  storePageTitle.value = stripStoreTitle(ev?.title);
}

async function refreshInstalledExtensions() {
  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.listExtensions !== "function") return;
    const result = await api.listExtensions();
    if (!result || result.ok === false) return;
    installedExtensions.value = (Array.isArray(result.extensions) ? result.extensions : [])
      .map((entry: any) => ({
        id: safeString(entry?.id, 128).toLowerCase(),
        version: normalizeVersion(entry?.version),
        enabled: !!entry?.enabled,
        loaded: !!entry?.loaded,
      }))
      .filter((entry: any) => !!entry.id);
  } catch {
    // ignore
  }
}

async function installChromeWebStoreExtension(input: string) {
  const id = extractChromeWebStoreId(input);
  if (!id) {
    statusError.value = true;
    statusMessage.value = "This page does not expose a valid Chrome Web Store extension ID.";
    return;
  }

  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.installFromChromeWebStore !== "function") return;
    installInFlight.value = true;
    statusError.value = false;
    statusMessage.value = "";
    const result = await api.installFromChromeWebStore(id);
    if (!result || result.ok === false) {
      statusError.value = true;
      statusMessage.value = result?.error || "Lumen installation failed.";
      return;
    }
    statusError.value = false;
    statusMessage.value = "";
    await refreshInstalledExtensions();
  } catch (error: any) {
    statusError.value = true;
    statusMessage.value = error?.message || String(error || "Lumen installation failed.");
  } finally {
    installInFlight.value = false;
  }
}

async function removeCurrentExtension() {
  const id = storeInstallId.value;
  if (!id) return;
  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.removeExtension !== "function") return;
    installInFlight.value = true;
    statusError.value = false;
    statusMessage.value = "";
    const result = await api.removeExtension(id);
    if (!result || result.ok === false) {
      statusError.value = true;
      statusMessage.value = result?.error || "Extension removal failed.";
      return;
    }
    await refreshInstalledExtensions();
  } catch (error: any) {
    statusError.value = true;
    statusMessage.value = error?.message || String(error || "Extension removal failed.");
  } finally {
    installInFlight.value = false;
  }
}

function importCurrentExtension() {
  if (!storeInstallId.value || installInFlight.value) return;
  if (primaryActionKind.value === "remove") {
    void removeCurrentExtension();
    return;
  }
  void installChromeWebStoreExtension(storeInstallId.value);
}

function openBrowserTarget(rawUrl: string, inNewTab = true) {
  const href = safeString(rawUrl, 8192);
  if (!href) return;
  if (/^lumen:\/\//i.test(href)) {
    if (inNewTab) openInNewTab?.(href);
    else navigate?.(href, { push: true });
    return;
  }
  if (!isBrowserUrl(href)) return;
  if (inNewTab) openInNewTab?.(href);
  else navigate?.(href, { push: true });
}

function onIpcMessage(ev: any) {
  if (!pageActive.value) return;
  const channel = safeString(ev?.channel, 128);

  if (channel === "extensions:installFromStore") {
    const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
    const input =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object"
          ? safeString((payload as any).id || (payload as any).url, 4096)
          : "";
    if (!input) return;
    void installChromeWebStoreExtension(input);
    return;
  }

  if (channel === "extensions:storePageMeta") {
    const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
    if (!payload || typeof payload !== "object") return;
    const pageId = safeString((payload as any).id, 128).toLowerCase();
    if (pageId && pageId === storeInstallId.value) {
      storeListingVersion.value = normalizeVersion((payload as any).version);
    } else if (!pageId) {
      storeListingVersion.value = normalizeVersion((payload as any).version);
    }
    const title = stripStoreTitle((payload as any).title);
    if (title) storePageTitle.value = title;
    return;
  }

  if (channel === "lumen:navigate") {
    const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
    const href =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object"
          ? safeString((payload as any).url, 8192)
          : "";
    const openFlag = !!(payload && typeof payload === "object" && (payload as any).openInNewTab);
    if (!href) return;
    openBrowserTarget(href, openFlag);
  }
}

function syncNavFromWebview(rawUrl: string) {
  if (!pageActive.value) return;
  const href = safeString(rawUrl, 8192);
  if (!href) return;
  addressInput.value = href;
  if (!isChromeWebStoreUrl(href)) return;
  const current = storeTargetUrl.value;
  if (current === href) {
    pendingAppNav.value = false;
    return;
  }
  const push = pendingAppNav.value ? false : true;
  pendingAppNav.value = false;
  skipNextRouteLoadUrl.value = href;
  navigateStore(href, push);
}

function onWillNavigate(ev: any) {
  if (!pageActive.value) return;
  const href = safeString(ev?.url, 8192);
  if (!href) return;

  if (isChromeCrxDownloadUrl(href)) {
    ev.preventDefault?.();
    void installChromeWebStoreExtension(href);
    return;
  }

  if (isChromeWebStoreUrl(href)) {
    return;
  }

  ev.preventDefault?.();
  openBrowserTarget(href, true);
}

function onDidNavigate(ev: any) {
  syncNavFromWebview(String(ev?.url || ""));
}

function onDidNavigateInPage(ev: any) {
  syncNavFromWebview(String(ev?.url || ""));
}

function onNewWindow(ev: any) {
  const href = safeString(ev?.url, 8192);
  if (!href) return;
  ev.preventDefault?.();

  if (isChromeCrxDownloadUrl(href)) {
    void installChromeWebStoreExtension(href);
    return;
  }

  if (isChromeWebStoreUrl(href)) {
    navigateStore(href, true);
    return;
  }

  openBrowserTarget(href, true);
}

function onDidStartLoading() {
  webviewLoading.value = true;
}

function onDidStopLoading() {
  pendingAppNav.value = false;
  webviewLoading.value = false;
}

function onDidFailLoad(ev: any) {
  if (!pageActive.value) return;
  pendingAppNav.value = false;
  webviewLoading.value = false;

  const errorCode = Number(ev?.errorCode || 0);
  if (errorCode === -3) return;

  statusError.value = true;
  statusMessage.value = safeString(ev?.errorDescription, 512) || "Store navigation failed.";
}

watch(
  () => storeTargetUrl.value,
  (nextUrl) => {
    addressInput.value = nextUrl;
    storePageTitle.value = "";
    storeListingVersion.value = "";
    if (!pageActive.value) return;
    if (skipNextRouteLoadUrl.value && skipNextRouteLoadUrl.value === nextUrl) {
      skipNextRouteLoadUrl.value = "";
      return;
    }
    const current = getWebviewCurrentUrl();
    if (current && current === nextUrl) return;
    loadUrl(nextUrl);
  },
  { immediate: true },
);

watch(
  () => currentTabRefresh?.value,
  () => {
    if (!pageActive.value) return;
    try {
      webviewRef.value?.reload?.();
    } catch {
      // ignore
    }
  },
);

function activatePage() {
  pageActive.value = true;
  const target = storeTargetUrl.value;
  if (!target) return;
  const current = getWebviewCurrentUrl();
  if (current && current === target) return;
  loadUrl(target);
}

function deactivatePage() {
  pageActive.value = false;
  const tabId = safeString(currentTabId?.value, 256);
  if (!tabId || typeof registerFindTarget !== "function") return;
  try {
    registerFindTarget(tabId, null);
  } catch {
    // ignore
  }
}

onMounted(activatePage);
onActivated(activatePage);
onDeactivated(deactivatePage);
onMounted(() => {
  void refreshInstalledExtensions();
  const api = useInternalLumen()?.extensions;
  if (api && typeof api.onChanged === "function") {
    removeExtensionsChangedListener = api.onChanged(() => {
      void refreshInstalledExtensions();
    });
  }
});
onBeforeUnmount(() => {
  deactivatePage();
  removeExtensionsChangedListener?.();
  removeExtensionsChangedListener = null;
});
</script>

