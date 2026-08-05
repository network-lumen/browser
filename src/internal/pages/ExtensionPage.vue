<template>
  <!-- ####### lumen://extension EXTENSION POPUP ####### -->
  <div class="absolute inset-0 flex min-h-0 min-w-0 bg-dark-111">
    <UiExtensionStatus v-if="error" error>{{ error }}</UiExtensionStatus>
    <UiExtensionStatus v-else-if="guestPreloadLoading">Preparing extension host…</UiExtensionStatus>
    <UiExtensionStatus v-else-if="!extensionGuestPreloadUrl" error>Extension guest preload is unavailable.</UiExtensionStatus>
    <UiExtensionStatus v-else-if="loading && !webviewMountUrl">Loading extension…</UiExtensionStatus>
    <webview
      v-else-if="webviewMountUrl"
      ref="webviewRef"
      class="flex-1 w-full h-full bg-dark-111 border-none"
      :src="webviewMountUrl"
      :preload="extensionGuestPreloadUrl"
      partition="persist:lumen"
      allowpopups
      :webpreferences="webprefs"
      @will-navigate="onWillNavigate"
      @did-navigate="onDidNavigate"
      @did-navigate-in-page="onDidNavigateInPage"
      @new-window="onNewWindow"
      @ipc-message="onIpcMessage"
      @did-start-loading="onDidStartLoading"
      @did-stop-loading="onDidStopLoading"
      @dom-ready="onDomReady"
    ></webview>
    <UiExtensionStatus v-else>Preparing extension…</UiExtensionStatus>
  </div>
</template>

<script setup lang="ts">
import { useInternalLumen } from '../../composables/useInternalLumen';
import UiExtensionStatus from '../../ui/UiExtensionStatus.vue';
import {
  computed,
  inject,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  buildExtensionTabUrl,
  isBrowserUrl,
  isExtensionUrl,
  parseExtensionTabUrl,
} from "../navigationUrl";
import { useTabLoadingSync } from "../useTabLoading";
import type { InstalledExtension } from "../../types/extension";
import {
  getWebviewWebContentsId,
  registerWebviewFindTarget
} from "../services/webviewRegistration";
import {
  fetchInstalledExtensions,
  findExtensionByRuntimeId as findExtensionInList,
  getRuntimeIdFromExtensionUrl,
  normalizeInstalledExtension,
  toSyntheticTabId,
  upsertExtension
} from "../services/extensions";

import { useTabNavigation } from "../../composables/useTabNavigation";
const currentTabUrl = inject<any>("currentTabUrl", null);
const currentTabId = inject<any>("currentTabId", null);
const currentTabRefresh = inject<any>("currentTabRefresh", null);
const { navigate, openInNewTab } = useTabNavigation();
const registerFindTarget = inject<((tabId: string, targetWebContentsId: number | null) => void) | null>(
  "findRegisterTarget",
  null,
);

const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";

const webviewRef = ref<any>(null);
const extensionGuestPreloadUrl = ref("");
const guestPreloadLoading = ref(true);
const pageActive = ref(false);
const pendingAppNav = ref(false);
const loading = ref(false);
const webviewLoading = ref(false);
const error = ref("");
const resolvedExtensionUrl = ref("");
const installedExtensions = ref<InstalledExtension[]>([]);
const resolvedExtension = ref<InstalledExtension | null>(null);
let guestLoadInFlight = false;
let queuedGuestLoadUrl = "";

useTabLoadingSync(computed(() => loading.value || webviewLoading.value));

const routeInfo = computed(() => parseExtensionTabUrl(String(currentTabUrl?.value || "").trim()));
const webviewMountUrl = computed(
  () => normalizeDocumentBase(resolvedExtensionUrl.value) || String(resolvedExtensionUrl.value || "").trim(),
);

function upsertInstalledExtension(entry: InstalledExtension | null) {
  installedExtensions.value = upsertExtension(installedExtensions.value, entry);
}

async function refreshInstalledExtensions() {
  const entries = await fetchInstalledExtensions();
  if (entries) installedExtensions.value = entries;
}

async function ensureGuestPreloadUrl() {
  if (extensionGuestPreloadUrl.value) return extensionGuestPreloadUrl.value;

  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.getGuestPreloadUrl !== "function") {
    guestPreloadLoading.value = false;
    return "";
  }

  try {
    const value = await api.getGuestPreloadUrl();
    extensionGuestPreloadUrl.value = String(value || "").trim();
  } catch {
    extensionGuestPreloadUrl.value = "";
  } finally {
    guestPreloadLoading.value = false;
  }

  return extensionGuestPreloadUrl.value;
}

function findExtensionByRuntimeId(runtimeId: string): InstalledExtension | null {
  return findExtensionInList(installedExtensions.value, runtimeId);
}

function resolveExtensionRouteTarget(rawUrl: string): string {
  const href = String(rawUrl || "").trim();
  if (!href) return "";
  if (/^lumen:\/\//i.test(href)) return href;

  if (isExtensionUrl(href)) {
    const runtimeId = getRuntimeIdFromExtensionUrl(href);
    const targetEntry =
      findExtensionByRuntimeId(runtimeId) ||
      resolvedExtension.value ||
      null;
    const extensionId = String(targetEntry?.id || routeInfo.value?.extensionId || "").trim();
    if (!extensionId) return "";
    const name = String(targetEntry?.name || routeInfo.value?.name || "").trim();
    return buildExtensionTabUrl(extensionId, {
      url: href,
      name,
      sourceTabId: String(routeInfo.value?.sourceTabId || "").trim(),
      sourceUrl: String(routeInfo.value?.sourceUrl || "").trim(),
      sourceTitle: String(routeInfo.value?.sourceTitle || "").trim(),
    });
  }

  if (isBrowserUrl(href)) return href;
  return "";
}

function normalizeDocumentBase(rawUrl: string): string {
  try {
    const url = new URL(String(rawUrl || "").trim());
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

async function navigateGuestInPage(target: string): Promise<boolean> {
  const w: any = webviewRef.value;
  if (!w || !target) return false;
  const current = String(typeof w?.getURL === "function" ? w.getURL() : w?.src || "").trim();
  if (!current) return false;
  if (normalizeDocumentBase(current) !== normalizeDocumentBase(target)) return false;
  try {
    pendingAppNav.value = true;
    webviewLoading.value = true;
    if (typeof w.executeJavaScript !== "function") return false;
    await Promise.resolve(
      w.executeJavaScript(`window.location.href = ${JSON.stringify(target)};`, true),
    );
    return true;
  } catch {
    pendingAppNav.value = false;
    webviewLoading.value = false;
    return false;
  }
}

async function flushGuestLoadQueue() {
  if (guestLoadInFlight) return;
  guestLoadInFlight = true;
  try {
    while (queuedGuestLoadUrl) {
      const target = String(queuedGuestLoadUrl || "").trim();
      queuedGuestLoadUrl = "";
      const w: any = webviewRef.value;
      if (!w || !target) continue;

      const navigatedInPage = await navigateGuestInPage(target);
      if (navigatedInPage) continue;

      const initialTarget = normalizeDocumentBase(target) || target;
      const shouldReplayInPage = initialTarget !== target;

      try {
        pendingAppNav.value = true;
        webviewLoading.value = true;
        if (typeof w.loadURL === "function") {
          await Promise.resolve(w.loadURL(initialTarget));
        } else {
          w.src = initialTarget;
        }
        if (shouldReplayInPage && !queuedGuestLoadUrl) {
          queuedGuestLoadUrl = target;
        }
      } catch (loadError) {
        const superseded = !!queuedGuestLoadUrl && queuedGuestLoadUrl !== target;
        if (superseded) {
          continue;
        }
        pendingAppNav.value = false;
        webviewLoading.value = false;
        try {
          console.warn("[extension-page] guest load failed", {
            target: initialTarget,
            error: String((loadError as any)?.message || loadError || "unknown_error"),
          });
        } catch {
          // ignore
        }
      }
    }
  } finally {
    guestLoadInFlight = false;
    if (queuedGuestLoadUrl) {
      void flushGuestLoadQueue();
    }
  }
}

function queueGuestLoad(url: string) {
  const target = String(url || "").trim();
  if (!target) return;
  queuedGuestLoadUrl = target;
  void flushGuestLoadQueue();
}

function clearGuestLoadQueue() {
  queuedGuestLoadUrl = "";
  guestLoadInFlight = false;
}

function ensureLoaded(url: string) {
  const target = String(url || "").trim();
  if (!target) return;
  if (queuedGuestLoadUrl === target) return;
  const w: any = webviewRef.value;
  const current = String(typeof w?.getURL === "function" ? w.getURL() : w?.src || "").trim();
  if (current === target) return;
  queueGuestLoad(target);
}

function reportFindTargetOnce(): number | null {
  return registerWebviewFindTarget(
    registerFindTarget,
    currentTabId?.value,
    getWebviewWebContentsId(webviewRef.value)
  );
}

function reportFindTarget(attempts = 40) {
  const id = reportFindTargetOnce();
  if (id != null) return;
  if (attempts <= 0 || !resolvedExtensionUrl.value) return;
  window.setTimeout(() => reportFindTarget(attempts - 1), 50);
}

function getExtensionHostTabContext() {
  const sourceUrl = String(routeInfo.value?.sourceUrl || "").trim();
  if (!sourceUrl || !isBrowserUrl(sourceUrl)) return null;

  const title = String(routeInfo.value?.sourceTitle || sourceUrl).trim() || sourceUrl;
  const tab = {
    id: toSyntheticTabId(String(routeInfo.value?.sourceTabId || "")),
    windowId: 1,
    active: true,
    highlighted: true,
    selected: true,
    status: "complete",
    title,
    url: sourceUrl,
    favIconUrl: "",
    incognito: false,
  };

  return {
    tab,
    window: {
      id: 1,
      focused: true,
      alwaysOnTop: false,
      incognito: false,
      type: "normal",
      state: "normal",
      tabs: [tab],
    },
  };
}

function sendExtensionHostTabContext(requestId = "") {
  const w: any = webviewRef.value;
  if (!w || typeof w.send !== "function") return;
  try {
    w.send("extensions:tabContext", {
      requestId: String(requestId || "").trim(),
      context: getExtensionHostTabContext(),
    });
  } catch {
    // ignore
  }
}

function onDomReady() {
  webviewLoading.value = false;
  sendExtensionHostTabContext();
  void nextTick(() => reportFindTarget());
}

function syncNavFromWebview(rawUrl: string) {
  if (!pageActive.value || !navigate) return;
  const next = resolveExtensionRouteTarget(rawUrl);
  if (!next) return;
  const current = String(currentTabUrl?.value || "").trim();
  if (current === next) {
    pendingAppNav.value = false;
    return;
  }
  const push = pendingAppNav.value ? false : true;
  pendingAppNav.value = false;
  navigate(next, { push });
}

function onWillNavigate(ev: any) {
  if (!pageActive.value) return;
  const href = String(ev?.url || "").trim();
  if (/^lumen:\/\//i.test(href)) {
    ev.preventDefault?.();
    navigate?.(href, { push: true });
    return;
  }
  if (!isBrowserUrl(href)) {
    ev.preventDefault?.();
  }
}

function onDidNavigate(ev: any) {
  syncNavFromWebview(String(ev?.url || ""));
}

function onDidNavigateInPage(ev: any) {
  syncNavFromWebview(String(ev?.url || ""));
}

function onDidStartLoading() {
  webviewLoading.value = true;
}

function onDidStopLoading() {
  webviewLoading.value = false;
}

function onNewWindow(ev: any) {
  if (!pageActive.value) return;
  ev.preventDefault?.();
  const next = resolveExtensionRouteTarget(String(ev?.url || ""));
  if (!next) return;
  openInNewTab?.(next);
}

function onIpcMessage(ev: any) {
  if (!pageActive.value) return;
  const channel = String(ev?.channel || "");
  const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
  const rawUrl =
    typeof payload === "string"
      ? payload
      : payload && typeof payload === "object" && typeof (payload as any).url === "string"
        ? String((payload as any).url || "")
        : "";
  const href = rawUrl.trim();

  if (channel === "extensions:shimNavigate") {
    const next = resolveExtensionRouteTarget(href);
    if (!next) return;
    const openInNewTabFlag = !!(payload && typeof payload === "object" && (payload as any).openInNewTab);
    if (openInNewTabFlag) openInNewTab?.(next);
    else navigate?.(next, { push: true });
    return;
  }

  if (channel === "extensions:requestTabContext") {
    const requestId =
      payload && typeof payload === "object" ? String((payload as any).requestId || "").trim() : "";
    sendExtensionHostTabContext(requestId);
    return;
  }

  if (channel !== "lumen:navigate") return;
  if (!/^lumen:\/\//i.test(href)) return;

  const openInNewTabFlag = !!(payload && typeof payload === "object" && (payload as any).openInNewTab);
  if (openInNewTabFlag) openInNewTab?.(href);
  else navigate?.(href, { push: true });
}

function formatPrepareError(rawError: unknown) {
  const code = String(
    (rawError as any)?.message || (rawError as any)?.error || rawError || "extension_open_failed",
  ).trim();

  if (code === "extension_not_found") return "This extension could not be found.";
  if (code === "extension_disabled") return "This extension is disabled.";
  if (code === "extension_launch_url_missing") return "This extension does not expose an entry page.";
  return "Failed to open this extension.";
}

async function resolveCurrentExtensionTab() {
  const info = routeInfo.value;
  if (!info?.extensionId) {
    error.value = "This extension could not be found.";
    resolvedExtension.value = null;
    resolvedExtensionUrl.value = "";
    return;
  }
  if (!(await ensureGuestPreloadUrl())) {
    error.value = "Extension guest preload is unavailable.";
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.prepareTab !== "function") {
      throw new Error("extensions_api_unavailable");
    }

    const result = await api.prepareTab(info.extensionId, info.targetUrl || "");
    if (!result || result.ok === false) {
      throw new Error(String(result?.error || "extension_tab_prepare_failed"));
    }

    const nextEntry = normalizeInstalledExtension(result.extension);
    resolvedExtension.value = nextEntry;
    upsertInstalledExtension(nextEntry);

    const targetUrl = String(result.targetUrl || nextEntry?.launchUrl || "").trim();
    if (!targetUrl) {
      throw new Error("extension_launch_url_missing");
    }

    resolvedExtensionUrl.value = targetUrl;

    const canonicalTabUrl = String(
      buildExtensionTabUrl(info.extensionId, {
        url: targetUrl,
        name: String(nextEntry?.name || info.name || "").trim(),
        sourceTabId: String(info.sourceTabId || "").trim(),
        sourceUrl: String(info.sourceUrl || "").trim(),
        sourceTitle: String(info.sourceTitle || "").trim(),
      }),
    ).trim();
    const current = String(currentTabUrl?.value || "").trim();
    if (canonicalTabUrl && current !== canonicalTabUrl) {
      navigate?.(canonicalTabUrl, { push: false });
      return;
    }

    if (pageActive.value) {
      ensureLoaded(targetUrl);
    }
  } catch (prepareError) {
    resolvedExtension.value = null;
    resolvedExtensionUrl.value = "";
    error.value = formatPrepareError(prepareError);
  } finally {
    loading.value = false;
  }
}

watch(
  () => String(currentTabUrl?.value || "").trim(),
  () => {
    void resolveCurrentExtensionTab();
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

let removeExtensionsChangedListener: (() => void) | null = null;

onMounted(async () => {
  pageActive.value = true;
  await ensureGuestPreloadUrl();
  await refreshInstalledExtensions();
  try {
    const api = useInternalLumen()?.extensions;
    if (api && typeof api.onChanged === "function") {
      removeExtensionsChangedListener = api.onChanged(() => {
        void refreshInstalledExtensions();
      });
    }
  } catch {
    // ignore
  }

  if (resolvedExtensionUrl.value) {
    ensureLoaded(resolvedExtensionUrl.value);
  }
  void nextTick(() => reportFindTarget());
});

onActivated(() => {
  pageActive.value = true;
  if (resolvedExtensionUrl.value) {
    ensureLoaded(resolvedExtensionUrl.value);
  }
  void nextTick(() => reportFindTarget());
});

onDeactivated(() => {
  pageActive.value = false;
  webviewLoading.value = false;
  try {
    const tabId = String(currentTabId?.value || "").trim();
    if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
  } catch {
    // ignore
  }
});

onBeforeUnmount(() => {
  pageActive.value = false;
  webviewLoading.value = false;
  clearGuestLoadQueue();
  try {
    removeExtensionsChangedListener?.();
  } catch {
    // ignore
  }
  removeExtensionsChangedListener = null;
  try {
    const tabId = String(currentTabId?.value || "").trim();
    if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
  } catch {
    // ignore
  }
});
</script>

