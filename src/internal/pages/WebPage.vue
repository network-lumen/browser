<template>
  <div class="web-page">
    <webview
      v-if="currentHttpUrl"
      ref="webviewRef"
      class="webview"
      :src="currentHttpUrl"
      partition="persist:lumen"
      :webpreferences="webprefs"
      @will-navigate="onWillNavigate"
      @did-navigate="onDidNavigate"
      @did-navigate-in-page="onDidNavigateInPage"
      @new-window="onNewWindow"
    ></webview>
    <div v-else class="empty"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from "vue";

const currentTabUrl = inject<any>("currentTabUrl", null);
const currentTabRefresh = inject<any>("currentTabRefresh", null);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>("navigate", null);
const openInNewTab = inject<((url: string) => void) | null>("openInNewTab", null);

const webviewRef = ref<any>(null);
const pageActive = ref(false);
const pendingAppNav = ref(false);

const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";

function isHttpUrl(raw: string): boolean {
  return /^\s*https?:\/\//i.test(String(raw || ""));
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
  if (isHttpUrl(href)) openInNewTab?.(href);
}

onMounted(() => {
  pageActive.value = true;
});
onActivated(() => {
  pageActive.value = true;
});
onDeactivated(() => {
  pageActive.value = false;
});
onBeforeUnmount(() => {
  pageActive.value = false;
});
</script>

<style scoped>
.web-page {
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-tertiary);
}

.webview,
.empty {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-primary);
}
</style>

