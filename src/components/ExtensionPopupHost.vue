<template>
  <div class="extension-popup-layer" @click="requestClose()">
    <div class="extension-popup-shell" :style="popupShellStyle" @click.stop>
      <button type="button" class="extension-popup-close" aria-label="Close extension popup" @click="requestClose()">
        <X :size="14" />
      </button>

      <div v-if="error" class="extension-popup-status extension-popup-status-error">
        {{ error }}
      </div>
      <div v-else-if="guestPreloadLoading" class="extension-popup-status">
        Preparing extension…
      </div>
      <div v-else-if="!extensionGuestPreloadUrl" class="extension-popup-status extension-popup-status-error">
        Extension guest preload is unavailable.
      </div>
      <div v-else-if="loading && !webviewMountUrl" class="extension-popup-status">
        Loading extension…
      </div>
      <webview
        v-else-if="webviewMountUrl"
        ref="webviewRef"
        class="extension-popup-webview"
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
      <div v-else class="extension-popup-status">
        Preparing extension…
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import { isBrowserUrl, isExtensionUrl } from "../internal/navigationUrl";

type InstalledExtension = {
  id: string;
  runtimeId: string;
  name: string;
  enabled: boolean;
  launchUrl: string;
};

const props = defineProps<{
  extensionId: string;
  extensionName?: string;
  targetUrl?: string;
  userGesture?: boolean;
  sourceTabId?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  topOffset?: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "navigate", payload: { url: string; openInNewTab?: boolean }): void;
}>();

const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";

const webviewRef = ref<any>(null);
const extensionGuestPreloadUrl = ref("");
const guestPreloadLoading = ref(true);
const loading = ref(false);
const webviewLoading = ref(false);
const error = ref("");
const resolvedExtensionUrl = ref("");
const installedExtensions = ref<InstalledExtension[]>([]);
const resolvedExtension = ref<InstalledExtension | null>(null);
let guestLoadInFlight = false;
let queuedGuestLoadUrl = "";
let guestLoadGeneration = 0;
let popupDisposed = false;

const popupShellStyle = computed(() => ({
  top: `${Math.max(Number(props.topOffset || 0), 0)}px`,
  height: `min(760px, calc(100vh - ${Math.max(Number(props.topOffset || 0), 0) + 12}px))`,
  maxHeight: `calc(100vh - ${Math.max(Number(props.topOffset || 0), 0) + 12}px)`,
}));

const webviewMountUrl = computed(
  () => normalizeDocumentBase(resolvedExtensionUrl.value) || String(resolvedExtensionUrl.value || "").trim(),
);

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeInstalledExtension(entry: any): InstalledExtension | null {
  const id = safeString(entry?.id);
  if (!id) return null;
  return {
    id,
    runtimeId: safeString(entry?.runtimeId),
    name: safeString(entry?.name || "Extension") || "Extension",
    enabled: !!entry?.enabled,
    launchUrl: safeString(entry?.launchUrl),
  };
}

function upsertInstalledExtension(entry: InstalledExtension | null) {
  if (!entry) return;
  const next = installedExtensions.value.filter((item) => item.id !== entry.id);
  next.push(entry);
  installedExtensions.value = next;
}

async function refreshInstalledExtensions() {
  try {
    const api = (window as any).lumen?.extensions;
    if (!api || typeof api.listExtensions !== "function") return;
    const result = await api.listExtensions();
    if (!result || result.ok === false) return;
    installedExtensions.value = (Array.isArray(result.extensions) ? result.extensions : [])
      .map((entry: any) => normalizeInstalledExtension(entry))
      .filter(Boolean) as InstalledExtension[];
  } catch {
    // ignore
  }
}

async function ensureGuestPreloadUrl() {
  if (extensionGuestPreloadUrl.value) return extensionGuestPreloadUrl.value;

  const api = (window as any).lumen?.extensions;
  if (!api || typeof api.getGuestPreloadUrl !== "function") {
    guestPreloadLoading.value = false;
    return "";
  }

  try {
    const value = await api.getGuestPreloadUrl();
    extensionGuestPreloadUrl.value = safeString(value);
  } catch {
    extensionGuestPreloadUrl.value = "";
  } finally {
    guestPreloadLoading.value = false;
  }

  return extensionGuestPreloadUrl.value;
}

function getRuntimeIdFromExtensionUrl(rawUrl: string): string {
  try {
    return safeString(new URL(safeString(rawUrl)).hostname);
  } catch {
    return "";
  }
}

function currentRuntimeId(): string {
  return safeString(resolvedExtension.value?.runtimeId) || getRuntimeIdFromExtensionUrl(resolvedExtensionUrl.value);
}

function normalizeDocumentBase(rawUrl: string): string {
  try {
    const url = new URL(safeString(rawUrl));
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

async function navigateGuestInPage(target: string): Promise<boolean> {
  if (popupDisposed) return false;
  const w: any = webviewRef.value;
  if (!w || !target) return false;
  const current = safeString(typeof w?.getURL === "function" ? w.getURL() : w?.src);
  if (!current) return false;
  if (normalizeDocumentBase(current) !== normalizeDocumentBase(target)) return false;
  try {
    if (typeof w.executeJavaScript !== "function") return false;
    webviewLoading.value = true;
    await Promise.resolve(
      w.executeJavaScript(`window.location.href = ${JSON.stringify(target)};`, true),
    );
    if (popupDisposed) return false;
    return true;
  } catch {
    webviewLoading.value = false;
    return false;
  }
}

async function flushGuestLoadQueue() {
  if (guestLoadInFlight) return;
  const generation = guestLoadGeneration;
  guestLoadInFlight = true;
  try {
    while (queuedGuestLoadUrl) {
      if (popupDisposed || generation !== guestLoadGeneration) return;
      const target = safeString(queuedGuestLoadUrl);
      queuedGuestLoadUrl = "";
      const w: any = webviewRef.value;
      if (!w || !target) continue;

      if (await navigateGuestInPage(target)) continue;
      if (popupDisposed || generation !== guestLoadGeneration) return;

      const initialTarget = normalizeDocumentBase(target) || target;
      const shouldReplayInPage = initialTarget !== target;

      try {
        webviewLoading.value = true;
        if (popupDisposed || generation !== guestLoadGeneration) return;
        if (typeof w.loadURL === "function") {
          await Promise.resolve(w.loadURL(initialTarget));
        } else {
          w.src = initialTarget;
        }
        if (popupDisposed || generation !== guestLoadGeneration) return;
        if (shouldReplayInPage && !queuedGuestLoadUrl) {
          queuedGuestLoadUrl = target;
        }
      } catch {
        webviewLoading.value = false;
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
  const target = safeString(url);
  if (!target) return;
  queuedGuestLoadUrl = target;
  void flushGuestLoadQueue();
}

function clearGuestLoadQueue() {
  guestLoadGeneration += 1;
  queuedGuestLoadUrl = "";
  guestLoadInFlight = false;
}

function closeGuestDevTools() {
  const w: any = webviewRef.value;
  if (!w) return;
  try {
    if (typeof w.isDevToolsOpened === "function" && w.isDevToolsOpened()) {
      w.closeDevTools?.();
    }
  } catch {
    // ignore
  }
}

function requestClose() {
  closeGuestDevTools();
  emit("close");
}

function ensureLoaded(url: string) {
  const target = safeString(url);
  if (!target) return;
  if (queuedGuestLoadUrl === target) return;
  const w: any = webviewRef.value;
  const current = safeString(typeof w?.getURL === "function" ? w.getURL() : w?.src);
  if (current === target) return;
  queueGuestLoad(target);
}

function toSyntheticTabId(raw: string): number {
  const text = safeString(raw);
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 1) return Math.trunc(numeric);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
  }
  return 1000 + (hash % 900000);
}

function getExtensionHostTabContext() {
  const sourceUrl = safeString(props.sourceUrl);
  if (!sourceUrl || !isBrowserUrl(sourceUrl)) return null;

  const title = safeString(props.sourceTitle || sourceUrl) || sourceUrl;
  const tab = {
    id: toSyntheticTabId(safeString(props.sourceTabId || "active")),
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
    permissions: {
      activeTabGranted: !!props.userGesture,
    },
  };
}

function sendExtensionHostTabContext(requestId = "") {
  const w: any = webviewRef.value;
  if (!w || typeof w.send !== "function") return;
  try {
    w.send("extensions:tabContext", {
      requestId: safeString(requestId),
      context: getExtensionHostTabContext(),
    });
  } catch {
    // ignore
  }
}

function handleNavigationRequest(rawUrl: string, openInNewTab = false) {
  const href = safeString(rawUrl);
  if (!href) return;

  if (isExtensionUrl(href)) {
    const runtimeId = getRuntimeIdFromExtensionUrl(href);
    const current = currentRuntimeId();
    if (current && runtimeId && runtimeId !== current) {
      emit("navigate", { url: href, openInNewTab });
      requestClose();
      return;
    }
    resolvedExtensionUrl.value = href;
    ensureLoaded(href);
    return;
  }

  if (/^lumen:\/\//i.test(href) || isBrowserUrl(href)) {
    emit("navigate", { url: href, openInNewTab });
    requestClose();
  }
}

function onWillNavigate(ev: any) {
  const href = safeString(ev?.url);
  if (!href) return;
  ev.preventDefault?.();
  handleNavigationRequest(href, false);
}

function onDidNavigate(ev: any) {
  const href = safeString(ev?.url);
  if (isExtensionUrl(href)) {
    resolvedExtensionUrl.value = href;
  }
}

function onDidNavigateInPage(ev: any) {
  const href = safeString(ev?.url);
  if (isExtensionUrl(href)) {
    resolvedExtensionUrl.value = href;
  }
}

function onDidStartLoading() {
  webviewLoading.value = true;
}

function onDidStopLoading() {
  webviewLoading.value = false;
}

function onNewWindow(ev: any) {
  ev.preventDefault?.();
  handleNavigationRequest(safeString(ev?.url), true);
}

function onIpcMessage(ev: any) {
  const channel = safeString(ev?.channel);
  const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
  const rawUrl =
    typeof payload === "string"
      ? payload
      : payload && typeof payload === "object" && typeof (payload as any).url === "string"
        ? safeString((payload as any).url)
        : "";

  if (channel === "extensions:shimNavigate") {
    const openInNewTab = !!(payload && typeof payload === "object" && (payload as any).openInNewTab);
    handleNavigationRequest(rawUrl, openInNewTab);
    return;
  }

  if (channel === "extensions:requestTabContext") {
    const requestId =
      payload && typeof payload === "object" ? safeString((payload as any).requestId) : "";
    sendExtensionHostTabContext(requestId);
    return;
  }

  if (channel === "lumen:navigate") {
    const openInNewTab = !!(payload && typeof payload === "object" && (payload as any).openInNewTab);
    handleNavigationRequest(rawUrl, openInNewTab);
  }
}

function formatPrepareError(rawError: unknown) {
  const code = safeString((rawError as any)?.message || (rawError as any)?.error || rawError);
  if (code === "extension_not_found") return "This extension could not be found.";
  if (code === "extension_disabled") return "This extension is disabled.";
  if (code === "extension_launch_url_missing") return "This extension does not expose an entry page.";
  return "Failed to open this extension.";
}

async function resolvePopupTarget() {
  const extensionId = safeString(props.extensionId);
  if (!extensionId) {
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
    const api = (window as any).lumen?.extensions;
    if (!api || typeof api.prepareTab !== "function") {
      throw new Error("extensions_api_unavailable");
    }

    const result = await api.prepareTab(extensionId, safeString(props.targetUrl));
    if (!result || result.ok === false) {
      throw new Error(safeString(result?.error || "extension_tab_prepare_failed"));
    }

    const nextEntry = normalizeInstalledExtension(result.extension);
    resolvedExtension.value = nextEntry;
    upsertInstalledExtension(nextEntry);

    const targetUrl = safeString(result.targetUrl || nextEntry?.launchUrl);
    if (!targetUrl) {
      throw new Error("extension_launch_url_missing");
    }

    resolvedExtensionUrl.value = targetUrl;
    ensureLoaded(targetUrl);
  } catch (prepareError) {
    resolvedExtension.value = null;
    resolvedExtensionUrl.value = "";
    error.value = formatPrepareError(prepareError);
  } finally {
    loading.value = false;
  }
}

function onDomReady() {
  webviewLoading.value = false;
  sendExtensionHostTabContext();
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === "Escape") {
    ev.preventDefault();
    requestClose();
  }
}

watch(
  () => [safeString(props.extensionId), safeString(props.targetUrl), safeString(props.extensionName)].join("|"),
  () => {
    void resolvePopupTarget();
  },
  { immediate: true },
);

watch(
  () => [safeString(props.sourceTabId), safeString(props.sourceUrl), safeString(props.sourceTitle)].join("|"),
  () => {
    sendExtensionHostTabContext();
  },
);

onMounted(async () => {
  popupDisposed = false;
  window.addEventListener("keydown", onKeydown);
  await ensureGuestPreloadUrl();
  await refreshInstalledExtensions();
  if (resolvedExtensionUrl.value) {
    ensureLoaded(resolvedExtensionUrl.value);
  }
  sendExtensionHostTabContext();
});

onBeforeUnmount(() => {
  popupDisposed = true;
  closeGuestDevTools();
  window.removeEventListener("keydown", onKeydown);
  clearGuestLoadQueue();
});
</script>

<style scoped>
.extension-popup-layer {
  position: absolute;
  inset: 0;
  z-index: 1400;
  background: transparent;
}

.extension-popup-shell {
  position: absolute;
  right: 12px;
  width: min(420px, calc(100vw - 24px));
  height: min(760px, calc(100vh - 24px));
  max-height: calc(100vh - 24px);
  border-radius: 14px;
  overflow: hidden;
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.extension-popup-webview {
  width: 100%;
  height: 100%;
  border: 0;
  background: #111111;
}

.extension-popup-status {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 24px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  text-align: center;
}

.extension-popup-status-error {
  color: #ffb4b4;
}

.extension-popup-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
}

.extension-popup-close:hover {
  background: rgba(15, 23, 42, 0.92);
}
</style>
