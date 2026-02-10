<template>
  <div class="web-page">
    <webview
      v-if="currentHttpUrl"
      ref="webviewRef"
      class="webview"
      :src="currentHttpUrl"
      partition="persist:lumen"
      allowpopups
      :webpreferences="webprefs"
      @will-navigate="onWillNavigate"
      @did-navigate="onDidNavigate"
      @did-navigate-in-page="onDidNavigateInPage"
      @new-window="onNewWindow"
      @ipc-message="onIpcMessage"
      @dom-ready="onDomReady"
    ></webview>
    <div v-else class="empty"></div>
  </div>
</template>

<script setup lang="ts">
 import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from "vue";

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

const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";

function isHttpUrl(raw: string): boolean {
  return /^\s*https?:\/\//i.test(String(raw || ""));
}

function isAllowedNewTabUrl(raw: string): boolean {
  const s = String(raw || "").trim();
  return isHttpUrl(s) || /^lumen:\/\//i.test(s);
}

function onIpcMessage(ev: any) {
  if (!pageActive.value) return;
  const channel = String(ev?.channel || "");
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

const currentHttpUrl = computed(() => {
  const u = String(currentTabUrl?.value || "").trim();
  return isHttpUrl(u) ? u : "";
});

function loadUrl(url: string) {
  const w: any = webviewRef.value;
  if (!w || !url) return;
  try {
    pendingAppNav.value = true;
    if (typeof w.loadURL === "function") {
      w.loadURL(url);
    } else {
      w.src = url;
    }
  } catch {
    pendingAppNav.value = false;
  }
}

watch(
  () => currentHttpUrl.value,
  (u) => {
    if (!pageActive.value) return;
    if (!u) return;
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
  const href = String(ev?.url || "");
  if (/^\s*lumen:\/\//i.test(href)) {
    ev.preventDefault?.();
    navigate?.(href.trim(), { push: true });
    return;
  }
  if (!isHttpUrl(href)) {
    ev.preventDefault?.();
  }
}

function onDidNavigate(ev: any) {
  syncNavFromWebview(String(ev?.url || ""));
}

function onDidNavigateInPage(ev: any) {
  syncNavFromWebview(String(ev?.url || ""));
}

function syncNavFromWebview(rawUrl: string) {
  if (!pageActive.value) return;
  if (!navigate) return;
  const next = String(rawUrl || "").trim();
  if (!isHttpUrl(next)) return;
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
   if (isAllowedNewTabUrl(href)) openInNewTab?.(href);
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
   if (!currentHttpUrl.value) return;
   window.setTimeout(() => {
     reportFindTarget(attempts - 1);
   }, 50);
 }

 function onDomReady() {
   void nextTick(() => reportFindTarget());
 }

 onMounted(() => {
   pageActive.value = true;
   void nextTick(() => reportFindTarget());
 });
 onActivated(() => {
   pageActive.value = true;
   void nextTick(() => reportFindTarget());
 });
 onDeactivated(() => {
   pageActive.value = false;
   try {
     const tabId = String(currentTabId?.value || "").trim();
     if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
   } catch {
     // ignore
   }
 });
 onBeforeUnmount(() => {
   pageActive.value = false;
   try {
     const tabId = String(currentTabId?.value || "").trim();
     if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
   } catch {
     // ignore
   }
 });

 watch(
   () => currentHttpUrl.value,
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

<style scoped>
.web-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--bg-tertiary);
  overflow: hidden;
}

.webview,
.empty {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-primary);
}
</style>
