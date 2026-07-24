<template>
  <div class="w-full h-full min-h-0 bg-primary overflow-hidden" :class="{ 'fullscreen-trigger fixed inset-0 z-max bg-black': webviewHtmlFullscreen }">
    <div v-if="isChromeWebStorePage" class="w-full h-full flex-align-justify-center p-32px bg-primary">
      <div class="webpage-store-proxy-card flex flex-column gap-12px text-center p-24px border-radius-20px border-1 bg-card shadow-xl max-w-520px">
        <h3 class="m-0px text-18px color-text-primary">Chrome Web Store opens in Lumen Extensions</h3>
        <p class="m-0px color-text-secondary line-height-15">
          Lumen fetches Chrome Web Store metadata directly and imports extensions
          from the internal Extensions page.
        </p>
        <button type="button" class="webpage-store-proxy-btn border-none color-white cursor-pointer border-radius-full txt-weight-light bg-accent py-12px px-16px align-self-center" @click="openChromeWebStoreImport">
          Open Extensions
        </button>
      </div>
    </div>
    <webview
      v-else-if="currentBrowserUrl"
      ref="webviewRef"
      class="fullscreen-target w-full h-full border-none bg-primary"
      :src="currentBrowserUrl"
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
      @did-start-loading="onDidStartLoading"
      @did-stop-loading="onDidStopLoading"
      @dom-ready="onDomReady"
      @page-favicon-updated="onPageFaviconUpdated"
      @enter-html-full-screen="onWebviewEnterHtmlFullscreen"
      @leave-html-full-screen="onWebviewLeaveHtmlFullscreen"
    ></webview>
    <div v-else class="w-full h-full border-none bg-primary"></div>
  </div>
</template>

<script setup lang="ts">
 import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from "vue";
 import { buildExtensionTabUrl, isBrowserUrl, isExtensionUrl } from "../navigationUrl";
 import { useTabLoadingSync } from "../useTabLoading";
import { useInternalLumen } from '../../composables/useInternalLumen';

 const currentTabUrl = inject<any>("currentTabUrl", null);
 const currentTabId = inject<any>("currentTabId", null);
 const currentTabRefresh = inject<any>("currentTabRefresh", null);
 const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>("navigate", null);
 const openInNewTab = inject<((url: string) => void) | null>("openInNewTab", null);
 const openExtensionPopup = inject<((input: any) => void) | null>("openExtensionPopup", null);
 const registerFindTarget = inject<((tabId: string, targetWebContentsId: number | null) => void) | null>(
   "findRegisterTarget",
   null,
 );
 const setTabFavicon = inject<((icon: string | null) => void) | null>("setTabFavicon", null);

const webviewRef = ref<any>(null);
const pageActive = ref(false);
const pendingAppNav = ref(false);
const webviewLoading = ref(false);
const webviewHtmlFullscreen = ref(false);
const installedExtensions = ref<any[]>([]);

useTabLoadingSync(webviewLoading);

const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";

function isAllowedNewTabUrl(raw: string): boolean {
  const s = String(raw || "").trim();
  return isBrowserUrl(s) || /^lumen:\/\//i.test(s);
}

function isChromeWebStoreUrl(raw: string): boolean {
  try {
    const url = new URL(String(raw || '').trim());
    const host = String(url.hostname || '').trim().toLowerCase();
    return host === 'chromewebstore.google.com' || host.endsWith('.chromewebstore.google.com');
  } catch {
    return false;
  }
}

const isChromeWebStorePage = computed(() => isChromeWebStoreUrl(currentBrowserUrl.value));

async function refreshInstalledExtensions() {
  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.listExtensions !== "function") return;
    const result = await api.listExtensions();
    if (!result || result.ok === false) return;
    installedExtensions.value = Array.isArray(result.extensions) ? result.extensions : [];
  } catch {
    // ignore
  }
}

function getRuntimeIdFromExtensionUrl(rawUrl: string): string {
  try {
    return String(new URL(String(rawUrl || "").trim()).hostname || "").trim();
  } catch {
    return "";
  }
}

function findExtensionByRuntimeId(runtimeId: string): any | null {
  const target = String(runtimeId || "").trim();
  if (!target) return null;
  return (
    installedExtensions.value.find(
      (entry: any) => String(entry?.runtimeId || "").trim() === target,
    ) || null
  );
}

async function resolveAppTargetUrl(rawUrl: string): Promise<string> {
  const href = String(rawUrl || "").trim();
  if (!href) return "";
  if (/^lumen:\/\//i.test(href)) return href;
  if (!isExtensionUrl(href)) return isBrowserUrl(href) ? href : "";

  if (!installedExtensions.value.length) {
    await refreshInstalledExtensions();
  }

  const runtimeId = getRuntimeIdFromExtensionUrl(href);
  const target = findExtensionByRuntimeId(runtimeId);
  const extensionId = String(target?.id || "").trim();
  if (!extensionId) return "";

  const sourceTabId = String(currentTabId?.value || "").trim();
  const sourceUrl = String(currentBrowserUrl.value || "").trim();
  const sourceTitle = sourceUrl;

  return buildExtensionTabUrl(extensionId, {
    url: href,
    name: String(target?.name || "").trim(),
    sourceTabId,
    sourceUrl,
    sourceTitle,
  });
}

async function navigateToResolvedTarget(rawUrl: string, openInNewTabFlag = false) {
  const href = String(rawUrl || "").trim();
  if (isExtensionUrl(href)) {
    if (typeof openExtensionPopup === "function") {
      openExtensionPopup({
        url: href,
        userGesture: false,
      });
      return;
    }
  }
  const next = await resolveAppTargetUrl(rawUrl);
  if (!next) return;
  if (openInNewTabFlag) openInNewTab?.(next);
  else navigate?.(next, { push: true });
}

function onIpcMessage(ev: any) {
  if (!pageActive.value) return;
  const channel = String(ev?.channel || "");
  if (channel === "extensions:installFromStore") {
    const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
    const input =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object"
          ? String((payload as any).id || (payload as any).url || "").trim()
          : "";
    if (!input) return;
    void installChromeWebStoreExtension(input);
    return;
  }
  if (channel === "extensions:shimNavigate") {
    const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
    const url =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object" && typeof (payload as any).url === "string"
          ? (payload as any).url
          : "";
    const href = String(url || "").trim();
    if (!isAllowedNewTabUrl(href)) return;

    const openInNewTabFlag =
      !!(payload && typeof payload === "object" && (payload as any).openInNewTab);
    void navigateToResolvedTarget(href, openInNewTabFlag);
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
  const href = String(url || "").trim();
  if (!/^lumen:\/\//i.test(href)) return;

  const openInNewTabFlag =
    !!(payload && typeof payload === "object" && (payload as any).openInNewTab);
  if (openInNewTabFlag) openInNewTab?.(href);
  else navigate?.(href, { push: true });
}

async function installChromeWebStoreExtension(input: string) {
  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.installFromChromeWebStore !== "function") return;
    const result = await api.installFromChromeWebStore(input);
    if (!result || result.ok === false) {
      console.warn("[webview][extensions] install from store failed:", result?.error || "unknown_error");
      return;
    }
    console.log("[webview][extensions] extension imported from store:", input);
  } catch (error: any) {
    console.warn("[webview][extensions] install from store failed:", error?.message || error || "unknown_error");
  }
}

const currentBrowserUrl = computed(() => {
  const u = String(currentTabUrl?.value || "").trim();
  if (isExtensionUrl(u)) return "";
  return isBrowserUrl(u) ? u : "";
});

watch(
  () => String(currentTabUrl?.value || "").trim(),
  (u) => {
    if (!pageActive.value) return;
    if (!isExtensionUrl(u)) return;
    void navigateToResolvedTarget(u, false);
  },
  { immediate: true },
);

function openChromeWebStoreImport() {
  const target = currentBrowserUrl.value;
  if (!target) return;
  navigate?.(`lumen://extensions?input=${encodeURIComponent(target)}`, { push: true });
}

function loadUrl(url: string) {
  const w: any = webviewRef.value;
  if (!w || !url) return;
  try {
    pendingAppNav.value = true;
    webviewLoading.value = true;
    if (typeof w.loadURL === "function") {
      w.loadURL(url);
    } else {
      w.src = url;
    }
  } catch {
    pendingAppNav.value = false;
    webviewLoading.value = false;
  }
}

watch(
  () => currentBrowserUrl.value,
  (u) => {
    if (!pageActive.value) return;
    if (!u) return;
    if (isChromeWebStoreUrl(u)) {
      pendingAppNav.value = false;
      openChromeWebStoreImport();
      return;
    }
    const w: any = webviewRef.value;
    const current = String(
      typeof w?.getURL === "function" ? w.getURL() : w?.src || "",
    ).trim();
    if (current && current === u) return;
    loadUrl(u);
  },
  { immediate: true },
);

watch(
  () => currentTabRefresh?.value,
  () => {
    if (!pageActive.value) return;
    const w: any = webviewRef.value;
    try {
      w?.reload?.();
    } catch {
      // ignore
    }
  },
);

function onWillNavigate(ev: any) {
  if (!pageActive.value) return;
  const href = String(ev?.url || "").trim();
  if (/^\s*lumen:\/\//i.test(href)) {
    ev.preventDefault?.();
    navigate?.(href, { push: true });
    return;
  }
  if (isExtensionUrl(href)) {
    ev.preventDefault?.();
    void navigateToResolvedTarget(href, false);
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

function syncNavFromWebview(rawUrl: string) {
  if (!pageActive.value) return;
  if (!navigate) return;
  const next = String(rawUrl || "").trim();
  if (isExtensionUrl(next)) {
    void navigateToResolvedTarget(next, false);
    return;
  }
  if (!isBrowserUrl(next)) return;
  const cur = String(currentTabUrl?.value || "").trim();
  if (cur && cur === next) {
    pendingAppNav.value = false;
    return;
  }
  const push = pendingAppNav.value ? false : true;
  pendingAppNav.value = false;
  navigate(next, { push });
}

 function onNewWindow(ev: any) {
   if (!pageActive.value) return;
   ev.preventDefault?.();
   const href = String(ev?.url || "").trim();
   if (!isAllowedNewTabUrl(href)) return;
   void navigateToResolvedTarget(href, true);
 }

 function getWebviewWebContentsId(): number | null {
   const w: any = webviewRef.value;
   if (!w || typeof w.getWebContentsId !== "function") return null;
   try {
     const id = w.getWebContentsId();
     return typeof id === "number" && Number.isFinite(id) ? id : null;
   } catch {
     return null;
   }
 }

 function reportFindTargetOnce(): number | null {
   const tabId = String(currentTabId?.value || "").trim();
   if (!tabId) return null;
   if (typeof registerFindTarget !== "function") return null;
   const id = getWebviewWebContentsId();
   try {
     registerFindTarget(tabId, id);
   } catch {
     // ignore
   }
   return id;
 }

 function reportFindTarget(attempts = 40) {
   const id = reportFindTargetOnce();
   if (id != null) return;
   if (attempts <= 0) return;
   if (!currentBrowserUrl.value) return;
   window.setTimeout(() => {
     reportFindTarget(attempts - 1);
   }, 50);
 }

 function onDomReady() {
   webviewLoading.value = false;
   void nextTick(() => reportFindTarget());
 }

 function onPageFaviconUpdated(ev: any) {
   if (!pageActive.value) return;
   const favicons = Array.isArray(ev?.favicons) ? ev.favicons : [];
   const icon = typeof favicons[0] === "string" ? favicons[0].trim() : "";
   setTabFavicon?.(icon || null);
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

 onMounted(() => {
   pageActive.value = true;
   void refreshInstalledExtensions();
   void nextTick(() => reportFindTarget());
 });
 onActivated(() => {
   pageActive.value = true;
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
   onWebviewLeaveHtmlFullscreen();
   try {
     const tabId = String(currentTabId?.value || "").trim();
     if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
   } catch {
     // ignore
   }
 });

 watch(
   () => currentBrowserUrl.value,
   (u) => {
     if (!u) {
       try {
         const tabId = String(currentTabId?.value || "").trim();
         if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
       } catch {
         // ignore
       }
       return;
     }
     void nextTick(() => reportFindTarget());
   },
   { immediate: true },
 );
</script>

