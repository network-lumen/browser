<template>
  <div class="ipfspage-ipfs-page flex w-full h-full bg-primary" :class="{ 'ipfspage-ipfs-page--bare': isBareHtmlView }">
    <main class="ipfspage-main-content flex flex-column flex-1 p-24px overflow-auto">
      <UiPageHeader v-if="!isBareHtmlView">
        <template #actions>
          <UiButton variant="primary" v-if="isDir && indexHtmlEntry"
           
            type="button"
            @click="openIndexHtml"
            :disabled="!navigate" class="disabled-fade-50">
            <span>Open website</span>
          </UiButton>
          <UiButton variant="primary" v-if="isDir && masterM3u8Entry"
           
            type="button"
            @click="openMasterHls"
            :disabled="!navigate"
            title="Play HLS video" class="disabled-fade-50">
            <Play :size="16" />
            <span>Play video</span>
          </UiButton>
          <UiButton
            variant="secondary"
            class="ipfspage-plans-btn disabled-fade-50"
            type="button"
            @click="openSaveModal"
            :class="{ 'ipfspage-save-active': saved }"
            :disabled="!canSaveToDrive || saving || saved"
            :title="
              saved ? 'Saved to Drive' : saving ? 'Saving...' : 'Save to Drive'
            "
          >
            <Check v-if="saved" :size="16" />
            <Save v-else :size="16" />
            <span>{{ saved ? "Saved" : saving ? "Saving..." : "Save" }}</span>
          </UiButton>
          <UiButton variant="primary" type="button"
            @click="copyLink"
            :disabled="!rootCid" class="disabled-fade-50">
            <Copy :size="16" />
            <span>Copy link</span>
          </UiButton>
          <UiButton variant="primary" type="button"
            @click="download"
            v-if="!isPreviewUnavailable"
            :disabled="!canDownload" class="disabled-fade-50">
            <Download :size="16" />
            <span>Download</span>
          </UiButton>
        </template>
      </UiPageHeader>

      <UiCard padding="none" :shadow="false" v-if="loading" class="ipfspage-loading-wrap flex-align-center gap-12px p-16px">
        <UiSpinner size="md" />
      </UiCard>

      <div v-else-if="error" class="ipfspage-error-wrap p-16px border-radius-lg color-error bg-fill-error border-width-ios-red-a35">
        {{ error }}
      </div>

      <template v-else>
        <div v-if="!rootCid" class="ipfspage-welcome-wrap flex-align-justify-center py-48px px-32px">
          <div class="ipfspage-welcome-content text-center max-w-600px">
            <h2 class="ipfspage-welcome-content-h2 text-28px txt-weight-light color-text-primary mb-12px">IPFS Content Viewer</h2>
            <p>View and download content from IPFS using CIDs.</p>
            <UiCard padding="none" :shadow="false" class="ipfspage-welcome-example p-24px mb-32px">
              <p class="ipfspage-example-label fw-500 color-text-secondary text-14px mb-12px">Example:</p>
              <code class="ipfspage-welcome-example-code block bg-card border-default border-radius-8px py-12px px-16px mono text-14px color-primary break-all"
                >lumen://ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco</code
              >
            </UiCard>
            <p class="ipfspage-welcome-hint color-text-tertiary text-14px">
              Enter an IPFS CID in the address bar to view content.
            </p>
          </div>
        </div>

        <div v-else-if="isDir" class="dir-wrap">
          <div class="ipfspage-breadcrumb flex-align-center flex-wrap-wrap gap-6px p-0px pt-8px pb-8px">
            <UiButton variant="primary" type="button"
              @click="openDirRoot"
              :disabled="!navigate" class="ipfspage-crumb disabled-fade-60">
              /
            </UiButton>
            <template v-for="(c, idx) in crumbs" :key="c.path">
              <span v-if="idx > 0" class="ipfspage-sep color-text-secondary">/</span>
              <UiButton variant="primary" type="button"
                @click="openDirCrumb(idx)"
                :disabled="!navigate" class="ipfspage-crumb disabled-fade-60">
                {{ c.label }}
              </UiButton>
            </template>
          </div>

          <UiCard padding="none" :shadow="false" v-if="!entries.length" class="ipfspage-empty-dir p-16px color-text-secondary">Empty folder.</UiCard>

          <div v-else class="ipfspage-dir-table border-radius-lg border-default overflow-hidden">
            <div
              v-for="it in entries"
              :key="it.key"
              class="ipfspage-dir-row gap-12px grid flex-inline-align-center py-12px px-16px border-bottom-1 bg-primary"
              @dblclick="openEntry(it)"
            >
              <div class="ipfspage-dir-name flex-align-center cursor-pointer gap-10px min-w-0" @click="openEntry(it)">
                <Folder v-if="it.type === 'dir'" :size="16" class="ipfspage-ico color-text-secondary" />
                <BookOpen v-else-if="isEpubName(it.name)" :size="16" class="ipfspage-ico color-text-secondary" />
                <File v-else :size="16" class="ipfspage-ico color-text-secondary" />
                <span class="txt-overflow-ellipsis nowrap overflow-hidden">{{
                  it.name
                }}</span>
              </div>
              <div class="ipfspage-dir-size mono text-right color-text-secondary text-14px">
                {{ it.size != null ? formatSize(it.size) : "-" }}
              </div>
              <div class="ipfspage-dir-actions flex-justify-end gap-8px">
                <UiButton variant="primary" type="button"
                  @click.stop="copyLinkFor(it)" class="ipfspage-btn-ghost">
                  Copy link
                </UiButton>
                <UiButton variant="primary" type="button"
                  @click.stop="openEntry(it)" class="ipfspage-btn-ghost">
                  Open
                </UiButton>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="ipfspage-viewer flex-align-justify-center border-radius-12px p-16px border-1 bg-secondary relative min-h-360px"
          :class="{ 'border-none border-radius-0 bg-transparent min-h-0': isBareHtmlView, 'block min-w-0': viewKind === 'text' || viewKind === 'markdown' || viewKind === 'docx', }"
        >
          <img
            v-if="viewKind === 'image'"
            :src="contentUrl"
            class="ipfspage-media img border-radius-12px border-1 bg-primary max-h-75vh max-w-full"
            alt=""
            @error="onMediaError"
          />

          <template v-else-if="viewKind === 'video'">
            <video
              ref="videoEl"
              :src="videoSrc"
              class="ipfspage-media border-radius-12px border-1 bg-primary max-h-75vh max-w-full"
              controls
              playsinline
            ></video>
            <div v-if="hlsError" class="ipfspage-hls-error border-radius-12px color-error absolute text-14px cursor-events-none py-12px px-14px right-100 bg-ios-red-a12 border-1-ios-red-a35">
              {{ hlsError }}
            </div>
          </template>

          <audio
            v-else-if="viewKind === 'audio'"
            :src="contentUrl"
            controls
            class="ipfspage-audio w-full"
          ></audio>

           <webview
             v-else-if="viewKind === 'html'"
             ref="siteWebview"
             :src="contentUrl"
             class="ipfspage-embed w-full border-radius-12px border-1 bg-primary"
             :class="{ 'ipfspage-embed--bare': isBareHtmlView }"
             partition="persist:lumen"
             allowpopups
             :webpreferences="webprefs"
             @will-navigate="onWebviewWillNavigate"
             @did-navigate="onWebviewDidNavigate"
             @did-navigate-in-page="onWebviewDidNavigateInPage"
             @new-window="onWebviewNewWindow"
             @ipc-message="onWebviewIpcMessage"
             @did-start-loading="onWebviewDidStartLoading"
             @did-stop-loading="onWebviewDidStopLoading"
             @dom-ready="onWebviewDomReady"
           ></webview>

          <iframe
            v-else-if="viewKind === 'pdf'"
            :src="contentUrl"
            class="ipfspage-embed w-full border-radius-12px border-1 bg-primary"
          ></iframe>

          <iframe
            v-else-if="viewKind === 'epub'"
            :src="epubReaderUrl"
            class="ipfspage-embed w-full border-radius-12px border-1 bg-primary"
            allow="fullscreen"
          ></iframe>

          <pre v-else-if="viewKind === 'docx'" class="ipfspage-text w-full text-14px color-text-primary overflow-auto pre-wrap max-h-75vh">{{
            docxContent
          }}</pre>

          <article
            v-else-if="viewKind === 'markdown'"
            class="markdown-body ipfspage-markdown-view w-full my-0px mx-auto overflow-auto border-1 border-radius-16px shadow-none bg-card max-h-75vh"
            data-color-mode="auto"
            v-html="markdownHtml"
            @click="onMarkdownClick"
          ></article>

          <pre v-else-if="viewKind === 'text'" class="ipfspage-text w-full text-14px color-text-primary overflow-auto pre-wrap max-h-75vh">{{
            textContent
          }}</pre>

          <div v-else class="ipfspage-unsupported flex-align-justify-center w-full">
            <div class="ipfspage-unsupported-content text-center p-32px max-w-500px">
              <h3 class="ipfspage-unsupported-content-h3 text-20px txt-weight-light color-text-primary mb-12px">Preview not available</h3>
              <p>This content type cannot be previewed directly.</p>
            </div>
          </div>
        </div>
      </template>
    </main>

    <UiModal :model-value="showSaveModal" title="Save to Drive" panel-class="w-min-520px-92vw" @update:model-value="closeSaveModal">
          <div class="flex flex-column gap-8px">
            <label class="ipfspage-modal-label text-14px txt-weight-light color-text-primary" for="save-name">Name</label>
            <UiInput radius-class="border-radius-12px" :focus-ring="false" id="save-name"
              v-model="saveNameDraft"
             
             
              :placeholder="saveNamePlaceholder"
              :disabled="savePreparing || saving"
              @keydown.enter.prevent="confirmSaveToDrive" class="ipfspage-modal-input focus-ring focus-outline-none focus-shadow" />

            <div v-if="saveModalError" class="ipfspage-modal-error text-14px color-error mt-4px">
              {{ saveModalError }}
            </div>

            <div v-if="savePinJobId" class="ipfspage-pin-progress-card border-radius-12px mt-14px py-12px px-14px bg-primary-a08 border-1-ios-blue-a18">
              <div class="ipfspage-pin-progress-head flex-align-center-justify-space-between gap-12px mb-8px">
                <span class="ipfspage-pin-progress-status txt-weight-medium color-primary text-uppercase text-12px letter-spacing-004em">{{ savePinStatusLabel }}</span>
                <span v-if="savePinProgressCounter" class="ipfspage-pin-progress-counter color-text-secondary text-12px">{{ savePinProgressCounter }}</span>
              </div>
              <div class="ipfspage-pin-progress-track w-full border-radius-full relative overflow-hidden bg-fill-secondary h-8px">
                <div
                  class="ipfspage-pin-progress-fill h-full bg-gradient-primary"
                  :class="{ indeterminate: savePinProgressPercent == null && savePinIsRunning }"
                  :style="{ width: savePinProgressPercent == null ? '100%' : `${Math.max(0, Math.min(100, savePinProgressPercent))}%` }"
                ></div>
              </div>
              <div class="ipfspage-pin-progress-text color-text-secondary mt-8px text-13px break-word">
                {{ savePinProgressText || (savePinIsRunning ? "Saving content from the network…" : "Waiting for action.") }}
              </div>
            </div>
          </div>

          <template #footer>
            <UiButton variant="secondary" type="button" @click="closeSaveModal" :disabled="savePinIsRunning" class="disabled-fade-60">
              Cancel
            </UiButton>
            <UiButton variant="secondary" v-if="savePinCanPause" type="button" @click="pauseSavePinJob" class="disabled-fade-60">
              Pause
            </UiButton>
            <UiButton variant="secondary" v-if="savePinCanResume" type="button" @click="resumeSavePinJob" class="disabled-fade-60">
              Resume
            </UiButton>
            <UiButton variant="danger" v-if="savePinCanStop" type="button" @click="cancelSavePinJob" class="disabled-fade-60">
              Stop
            </UiButton>
            <UiButton variant="primary" type="button"
              :disabled="savePreparing || savePinIsRunning"
              @click="confirmSaveToDrive" class="disabled-fade-60">
              {{ savePinJobId ? (savePinCanResume ? "Resume save" : (savePinIsRunning ? "Saving..." : "Save")) : (saving ? "Saving..." : "Save") }}
            </UiButton>
          </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiCard from '../../ui/UiCard.vue';
import UiButton from '../../ui/UiButton.vue';
import UiModal from '../../ui/UiModal.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { copyToClipboard as copyToClipboardShared } from '../../composables/useClipboard';
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
import JSZip from "jszip";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { BookOpen, Check, Copy, Download, File, Folder, Play, Save } from "lucide-vue-next";
import "github-markdown-css/github-markdown.css";
import UiSpinner from "../../ui/UiSpinner.vue";
import { useTabLoadingSync } from "../useTabLoading";
import {
  localIpfsGatewayBase,
  loadWhitelistedGatewayBases,
  probeUrl,
  resolveStableLinkTarget,
} from "../services/contentResolver";
import { activeProfileId } from "../profilesStore";

type Entry = {
  key: string;
  name: string;
  cid: string;
  type: "dir" | "file";
  size: number | null;
  relPath: string;
};

 const currentTabUrl = inject<any>("currentTabUrl", null);
 const currentTabId = inject<any>("currentTabId", null);
 const currentTabRefresh = inject<any>("currentTabRefresh", null);
 const openInNewTab = inject<((url: string) => void) | null>(
   "openInNewTab",
   null,
 );
 const navigate = inject<
   ((url: string, opts?: { push?: boolean }) => void) | null
 >("navigate", null);
 const registerFindTarget = inject<((tabId: string, targetWebContentsId: number | null) => void) | null>(
   "findRegisterTarget",
   null,
 );

const loading = ref(false);
const error = ref("");
const entries = ref<Entry[]>([]);
const isDir = ref(false);
const viewKind = ref<
  | "image"
  | "video"
  | "audio"
  | "html"
  | "pdf"
  | "epub"
  | "docx"
  | "markdown"
  | "text"
  | "unknown"
>("unknown");
const textContent = ref("");
const docxContent = ref("");
const mediaErrored = ref(false);
const hlsError = ref("");
const webviewLoading = ref(false);
 const htmlSrcdoc = ref("");
 const htmlFrameUrl = ref("");
 const siteFrame = ref<HTMLIFrameElement | null>(null);
 const siteWebview = ref<any>(null);
 const videoEl = ref<HTMLVideoElement | null>(null);
let hlsInstance: any = null;
const IGNORABLE_HLS_WARNING_DETAILS = new Set([
  "bufferStalledError",
  "bufferNudgeOnStall",
]);
 const webprefs =
   "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";
 const pageActive = ref(false);
 const isBareHtmlView = ref(false);

useTabLoadingSync(computed(() => loading.value || webviewLoading.value));

 function getWebviewWebContentsId(): number | null {
   const w: any = siteWebview.value;
   if (!w || typeof w.getWebContentsId !== "function") return null;
   try {
     const id = w.getWebContentsId();
     return typeof id === "number" && Number.isFinite(id) ? id : null;
   } catch {
     return null;
   }
 }

 function registerFindTargetOnce(): number | null {
   const tabId = String(currentTabId?.value || "").trim();
   if (!tabId) return null;
   if (typeof registerFindTarget !== "function") return null;

   const id = viewKind.value === "html" ? getWebviewWebContentsId() : null;
   try {
     registerFindTarget(tabId, id);
   } catch {
     // ignore
   }
   return id;
 }

function registerFindTargetWithRetry(attempts = 40) {
  const id = registerFindTargetOnce();
  if (id != null) return;
  if (attempts <= 0) return;
  if (viewKind.value !== "html") return;
  window.setTimeout(() => {
    registerFindTargetWithRetry(attempts - 1);
  }, 50);
}

function onWebviewDomReady() {
  webviewLoading.value = false;
  void nextTick(() => registerFindTargetWithRetry());
}

function onWebviewDidStartLoading() {
  webviewLoading.value = true;
}

function onWebviewDidStopLoading() {
  webviewLoading.value = false;
}

const rootCid = ref("");
const rootProto = ref<"ipfs" | "ipns">("ipfs");
const relPath = ref("");
const wantsDir = ref(false);
const suffix = ref("");
const stableDisplayUrl = ref("");
const resolvedGatewayBase = ref("");
const saving = ref(false);
const saved = ref(false);
const savedCid = ref("");
const showSaveModal = ref(false);
const saveNameDraft = ref("");
const saveModalError = ref("");
const savePreparing = ref(false);
const saveTargetCid = ref("");
const savePinJobId = ref("");
const savePinJobStatus = ref("");
const savePinProgressText = ref("");
const savePinProgressCurrent = ref<number | null>(null);
const savePinProgressTotal = ref<number | null>(null);
const savePinProgressPercent = ref<number | null>(null);
const savePinProgressUnit = ref("");
const savePinWaitJobId = ref("");
let stopPinProgressListener: null | (() => void) = null;

const saveNamePlaceholder = computed(() => {
  const name = inferDefaultName();
  return name || "Enter a name";
});

const savePinIsRunning = computed(() =>
  ["queued", "running", "retry_waiting"].includes(String(savePinJobStatus.value || "").trim().toLowerCase()),
);
const savePinCanPause = computed(() => !!savePinJobId.value && savePinIsRunning.value);
const savePinCanResume = computed(() =>
  !!savePinJobId.value &&
  ["paused", "failed"].includes(String(savePinJobStatus.value || "").trim().toLowerCase()),
);
const savePinCanStop = computed(() =>
  !!savePinJobId.value &&
  !["completed", "cancelled"].includes(String(savePinJobStatus.value || "").trim().toLowerCase()),
);
const savePinStatusLabel = computed(() => {
  const status = String(savePinJobStatus.value || "").trim().toLowerCase();
  if (status === "queued") return "Queued";
  if (status === "running") return "Saving";
  if (status === "retry_waiting") return "Retrying";
  if (status === "paused") return "Paused";
  if (status === "failed") return "Failed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Stopped";
  return saving.value ? "Saving" : "Idle";
});
const savePinProgressCounter = computed(() => {
  const current =
    savePinProgressCurrent.value != null && Number.isFinite(savePinProgressCurrent.value)
      ? String(savePinProgressCurrent.value)
      : "";
  const total =
    savePinProgressTotal.value != null && Number.isFinite(savePinProgressTotal.value)
      ? String(savePinProgressTotal.value)
      : "";
  const unit = String(savePinProgressUnit.value || "").trim();
  if (current && total) return `${current}/${total}${unit ? ` ${unit}` : ""}`;
  if (current) return `${current}${unit ? ` ${unit}` : ""}`;
  if (savePinProgressPercent.value != null && Number.isFinite(savePinProgressPercent.value)) {
    return `${savePinProgressPercent.value.toFixed(0)}%`;
  }
  return "";
});

function clearSavePinJobState() {
  savePinJobId.value = "";
  savePinJobStatus.value = "";
  savePinProgressText.value = "";
  savePinProgressCurrent.value = null;
  savePinProgressTotal.value = null;
  savePinProgressPercent.value = null;
  savePinProgressUnit.value = "";
  savePinWaitJobId.value = "";
}

function applySavePinJobSnapshot(job: any) {
  if (!job || typeof job !== "object") return;
  savePinJobId.value = String(job.id || "").trim();
  savePinJobStatus.value = String(job.status || "").trim();
  savePinProgressText.value = String(job.progressText || "").trim();
  savePinProgressCurrent.value =
    job.progressCurrent == null || !Number.isFinite(Number(job.progressCurrent))
      ? null
      : Number(job.progressCurrent);
  savePinProgressTotal.value =
    job.progressTotal == null || !Number.isFinite(Number(job.progressTotal))
      ? null
      : Number(job.progressTotal);
  savePinProgressPercent.value =
    job.progressPercent == null || !Number.isFinite(Number(job.progressPercent))
      ? null
      : Number(job.progressPercent);
  savePinProgressUnit.value = String(job.progressUnit || "").trim();
  saving.value = ["queued", "running", "retry_waiting"].includes(
    String(job.status || "").trim().toLowerCase(),
  );
}

type DriveSavedFile = {
  cid: string;
  name: string;
  size: number;
  uploadedAt: number;
  type?: "file" | "dir";
  rootCid?: string;
  relPath?: string;
};

const DRIVE_FILES_KEY_PREFIX = "lumen:drive:files:v1";
const DRIVE_LOCAL_NAMES_KEY_PREFIX = "lumen:drive:names:v1";
const DRIVE_BACKUP_SEQ_KEY_PREFIX = "lumen:driveBackup:seq:v1";

function driveFilesStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_FILES_KEY_PREFIX}:${pid}` : `${DRIVE_FILES_KEY_PREFIX}:guest`;
}

function driveLocalNamesStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_LOCAL_NAMES_KEY_PREFIX}:${pid}` : `${DRIVE_LOCAL_NAMES_KEY_PREFIX}:guest`;
}

function driveBackupSeqKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_BACKUP_SEQ_KEY_PREFIX}:${pid}` : `${DRIVE_BACKUP_SEQ_KEY_PREFIX}:guest`;
}

function nextDriveBackupSeq(profileId: string): number {
  const key = driveBackupSeqKey(profileId);
  const current = Number.parseInt(String(localStorage.getItem(key) || "0"), 10);
  const base = Number.isFinite(current) && current >= 0 ? current : 0;
  const next = base + 1;
  try {
    localStorage.setItem(key, String(next));
  } catch {}
  return next;
}

function activeDriveProfileId(): string {
  return String(activeProfileId.value || "").trim() || "default";
}

function isEpubName(nameOrPath: string): boolean {
  const s = String(nameOrPath || "").toLowerCase();
  return s.endsWith(".epub") || s.includes(".epub?");
}

function getDefaultBibiOrigin(): string {
  try {
    const baseEl = document.querySelector<HTMLBaseElement>("base[href]");
    if (baseEl?.href) {
      const u = new URL("./lib/bibi/", baseEl.href);
      return u.href.replace(/\/+$/, "");
    }
  } catch {
    // ignore
  }

  try {
    const u = new URL("./lib/bibi/", window.location.href);
    return u.href.replace(/\/+$/, "");
  } catch {
    // ignore
  }

  return "/lib/bibi";
}

const bibiOrigin = computed(() =>
  String((window as any).BIBI_ORIGIN || getDefaultBibiOrigin()).replace(
    /\/+$/,
    "",
  ),
);

// For EPUB parsing, prefer a path-style gateway URL.
// The localhost subdomain gateway (`<cid>.ipfs.localhost`) is great for websites with absolute paths,
// but some EPUB readers/tools are more reliable with `/ipfs/<cid>` URLs.
const epubBookUrl = computed(() => {
  if (!rootCid.value) return "";
  const p = relPath.value ? `/${encodePath(relPath.value)}` : "";
  const base = resolvedGatewayBase.value || localIpfsGatewayBase();
  const b = String(base).replace(/\/+$/, "");
  const suf = suffix.value || "";
  return `${b}/${rootProto.value}/${rootCid.value}${p}${suf}`;
});

const epubReaderUrl = computed(() => {
  const book = String(epubBookUrl.value || "").trim();
  if (!book) return "";
  const bibi = String(bibiOrigin.value || "").replace(/\/+$/, "");
  if (!bibi) return "";
  return `${bibi}/index.html?book=${encodeURIComponent(
    book,
  )}#autostart=1&ui=full&reader=view`;
});

function decodeSafe(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function encodePath(p: string): string {
  const cleaned = String(p || "").replace(/^\/+/, "");
  if (!cleaned) return "";
  return cleaned
    .split("/")
    .filter((x) => x.length > 0)
    .map((s) => encodeURIComponent(s))
    .join("/");
}

let htmlFrameObjectUrl: string | null = null;
function clearHtmlFrame() {
  try {
    if (htmlFrameObjectUrl) URL.revokeObjectURL(htmlFrameObjectUrl);
  } catch {
    // ignore
  }
  htmlFrameObjectUrl = null;
  htmlFrameUrl.value = "";
}

function setHtmlFrameFromSrcdoc(srcdoc: string) {
  const html = String(srcdoc || "");
  if (!html) {
    clearHtmlFrame();
    return;
  }
  clearHtmlFrame();
  try {
    htmlFrameObjectUrl = URL.createObjectURL(
      new Blob([html], { type: "text/html" }),
    );
    htmlFrameUrl.value = htmlFrameObjectUrl || "";
  } catch {
    clearHtmlFrame();
  }
}

function splitPathSuffix(rawPath: string): { path: string; suffix: string } {
  const m = String(rawPath || "").match(/^([^?#]*)(.*)$/);
  const path = m?.[1] || "";
  const suffix = m?.[2] || "";
  return { path, suffix };
}

function parseIpfsUrl(raw: string): {
  proto: "ipfs" | "ipns";
  cid: string;
  rel: string;
  dir: boolean;
  suffix: string;
} {
  const s = String(raw || "").trim();
  if (!s) return { proto: "ipfs", cid: "", rel: "", dir: false, suffix: "" };

  const withoutScheme = /^lumen:\/\//i.test(s) ? s.slice("lumen://".length) : s;
  const proto = /^ipns(\/|$)/i.test(withoutScheme) ? "ipns" : "ipfs";
  const afterHost = withoutScheme.replace(/^(ipfs|ipns)\/?/i, "");
  const split = splitPathSuffix(afterHost);
  const hasTrailingSlash = /\/$/.test(split.path);
  const cleaned = split.path.replace(/^\/+/, "").replace(/\/+$/, "");

  const segs = cleaned.split("/").filter(Boolean).map(decodeSafe);
  const cid = segs[0] || "";
  const rel = segs.slice(1).join("/");
  return { proto, cid, rel, dir: hasTrailingSlash, suffix: split.suffix };
}

const displayLumenUrl = computed(() => {
  if (!rootCid.value) return `lumen://${rootProto.value}/`;
  const p = relPath.value
    ? `/${encodePath(relPath.value)}`
    : wantsDir.value || isDir.value
      ? "/"
      : "";
  return `lumen://${rootProto.value}/${rootCid.value}${p}${suffix.value || ""}`;
});

const contentUrl = computed(() => {
  if (!rootCid.value) return "";
  const p = relPath.value ? `/${encodePath(relPath.value)}` : "";
  const base = resolvedGatewayBase.value || localIpfsGatewayBase();

  const b = String(base).replace(/\/+$/, "");
  const suf = suffix.value || "";

  // Use localhost subdomain gateway when possible to support absolute paths (e.g. Next.js /_next/*).
  try {
    const u = new URL(b);
    const host = String(u.hostname || "").toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const isCidV1B32 = rootProto.value === "ipfs" && /^bafy[a-z0-9]{20,}$/i.test(rootCid.value);
    if (isLocal && isCidV1B32) {
      const port = u.port ? `:${u.port}` : "";
      const proto = u.protocol || "http:";
      const idLower = String(rootCid.value).toLowerCase();
      const siteHost = `${idLower}.ipfs.localhost`;
      return `${proto}//${siteHost}${port}${p || "/"}${suf}`;
    }
  } catch {}

  return `${b}/${rootProto.value}/${rootCid.value}${p}${suf}`;
});

type MarkdownTarget = {
  proto: "ipfs" | "ipns";
  id: string;
  path: string;
  dir: boolean;
  suffix: string;
};

type MarkdownResolvedLink =
  | { kind: "anchor"; value: string }
  | { kind: "internal"; value: string }
  | { kind: "external"; value: string };

function isDangerousMarkdownScheme(value: string): boolean {
  const s = String(value || "").trim().toLowerCase();
  return (
    s.startsWith("javascript:") ||
    s.startsWith("vbscript:") ||
    s.startsWith("file:")
  );
}

function decodePathSegments(pathname: string): string {
  return String(pathname || "")
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeSafe(seg))
    .join("/");
}

function parseExplicitMarkdownTarget(raw: string): MarkdownTarget | null {
  const input = String(raw || "").trim();
  if (!input || isDangerousMarkdownScheme(input)) return null;

  const lower = input.toLowerCase();
  let proto: MarkdownTarget["proto"] | null = null;
  let rest = "";

  if (lower.startsWith("lumen://ipfs/")) {
    proto = "ipfs";
    rest = input.slice("lumen://ipfs/".length);
  } else if (lower.startsWith("lumen://ipns/")) {
    proto = "ipns";
    rest = input.slice("lumen://ipns/".length);
  } else if (lower.startsWith("ipfs://")) {
    proto = "ipfs";
    rest = input.slice("ipfs://".length);
  } else if (lower.startsWith("ipns://")) {
    proto = "ipns";
    rest = input.slice("ipns://".length);
  } else if (lower.startsWith("/ipfs/")) {
    proto = "ipfs";
    rest = input.slice("/ipfs/".length);
  } else if (lower.startsWith("/ipns/")) {
    proto = "ipns";
    rest = input.slice("/ipns/".length);
  }

  if (!proto) return null;

  const split = splitPathSuffix(String(rest || "").replace(/^\/+/, ""));
  const pathOnly = String(split.path || "");
  const dir = /\/$/.test(pathOnly);
  const segs = pathOnly
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeSafe(seg));
  const id = String(segs[0] || "").trim();
  if (!id) return null;

  return {
    proto,
    id,
    path: segs.slice(1).join("/"),
    dir,
    suffix: split.suffix || "",
  };
}

function resolveRelativeMarkdownTarget(raw: string): MarkdownTarget | null {
  const input = String(raw || "").trim();
  if (!input || !rootCid.value || isDangerousMarkdownScheme(input)) return null;

  const basePath = relPath.value ? `/${encodePath(relPath.value)}` : "/";

  try {
    const next = new URL(input, `https://markdown.local${basePath}`);
    return {
      proto: rootProto.value,
      id: rootCid.value,
      path: decodePathSegments(next.pathname),
      dir: next.pathname.endsWith("/"),
      suffix: `${next.search || ""}${next.hash || ""}`,
    };
  } catch {
    return null;
  }
}

function buildMarkdownLumenUrl(target: MarkdownTarget): string {
  const rel = target.path
    ? `/${encodePath(target.path)}`
    : target.dir
      ? "/"
      : "";
  return `lumen://${target.proto}/${target.id}${rel}${target.suffix || ""}`;
}

function buildMarkdownGatewayUrl(target: MarkdownTarget): string {
  const base = String(
    resolvedGatewayBase.value || localIpfsGatewayBase(),
  ).replace(/\/+$/, "");
  const rel = target.path
    ? `/${encodePath(target.path)}`
    : target.dir
      ? "/"
      : "";
  return `${base}/${target.proto}/${target.id}${rel}${target.suffix || ""}`;
}

function resolveMarkdownLink(rawHref: string): MarkdownResolvedLink | null {
  const href = String(rawHref || "").trim();
  if (!href) return null;
  if (href.startsWith("#")) return { kind: "anchor", value: href };
  if (isDangerousMarkdownScheme(href)) return null;
  if (/^(https?:|mailto:|tel:)/i.test(href) || href.startsWith("//")) {
    return { kind: "external", value: href };
  }

  const explicitTarget = parseExplicitMarkdownTarget(href);
  if (explicitTarget) {
    return { kind: "internal", value: buildMarkdownLumenUrl(explicitTarget) };
  }

  const relativeTarget = resolveRelativeMarkdownTarget(href);
  if (relativeTarget) {
    return { kind: "internal", value: buildMarkdownLumenUrl(relativeTarget) };
  }

  return { kind: "external", value: href };
}

function resolveMarkdownImageSource(rawSrc: string): string | null {
  const src = String(rawSrc || "").trim();
  if (!src || src.startsWith("#") || isDangerousMarkdownScheme(src)) return null;
  if (/^(https?:|data:|blob:)/i.test(src) || src.startsWith("//")) return src;

  const explicitTarget = parseExplicitMarkdownTarget(src);
  if (explicitTarget) return buildMarkdownGatewayUrl(explicitTarget);

  const relativeTarget = resolveRelativeMarkdownTarget(src);
  if (relativeTarget) return buildMarkdownGatewayUrl(relativeTarget);

  return null;
}

function slugifyMarkdownHeading(
  text: string,
  counts: Map<string, number>,
): string {
  const base =
    String(text || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  const seen = counts.get(base) || 0;
  counts.set(base, seen + 1);
  return seen > 0 ? `${base}-${seen}` : base;
}

const markdownHtml = computed(() => {
  if (viewKind.value !== "markdown") return "";
  const source = String(textContent.value || "");
  if (!source.trim()) return "";

  const parsed = String(
    marked.parse(source, {
      gfm: true,
      breaks: false,
      async: false,
    }),
  );
  const sanitized = String(
    DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } }),
  );
  const doc = new DOMParser().parseFromString(
    `<body>${sanitized}</body>`,
    "text/html",
  );
  const body = doc.body;
  const headingCounts = new Map<string, number>();

  body.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
    const text = String(heading.textContent || "").trim();
    if (!text || heading.id) return;
    heading.id = slugifyMarkdownHeading(text, headingCounts);
  });

  body.querySelectorAll("a[href]").forEach((anchor) => {
    const resolved = resolveMarkdownLink(String(anchor.getAttribute("href") || ""));
    anchor.removeAttribute("data-lumen-href");
    if (!resolved) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      return;
    }
    if (resolved.kind === "internal") {
      anchor.setAttribute("href", "#");
      anchor.setAttribute("data-lumen-href", resolved.value);
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      return;
    }
    anchor.setAttribute("href", resolved.value);
    if (resolved.kind === "external") {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    } else {
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
    }
  });

  body.querySelectorAll("img[src]").forEach((img) => {
    const src = resolveMarkdownImageSource(String(img.getAttribute("src") || ""));
    if (!src) {
      img.remove();
      return;
    }
    img.setAttribute("src", src);
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
  });

  return String(
    DOMPurify.sanitize(body.innerHTML, { USE_PROFILES: { html: true } }),
  );
});

function onMarkdownClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const link = target?.closest?.("a[data-lumen-href]") as HTMLAnchorElement | null;
  const href = String(link?.dataset?.lumenHref || "").trim();
  if (!href) return;
  event.preventDefault();
  event.stopPropagation();
  if (typeof navigate === "function") {
    navigate(href);
    return;
  }
  window.open(href, "_blank");
}

async function pickGatewayBaseForCurrentTarget(): Promise<string> {
  const cid = String(rootCid.value || "").trim();
  if (!cid) return localIpfsGatewayBase();

  const relEncoded = relPath.value ? encodePath(relPath.value) : "";
  const suffixStr = String(suffix.value || "");
  const makeUrl = (base: string) => {
    const b = String(base || "").replace(/\/+$/, "");
    if (!b) return "";
    const rel = relEncoded ? `/${relEncoded}` : "";
    return `${b}/${rootProto.value}/${cid}${rel}${suffixStr}`;
  };

  const localBase = localIpfsGatewayBase();
  const localUrl = makeUrl(localBase);
  if (localUrl && (await probeUrl(localUrl, 2000))) return localBase;

  const whitelisted = await loadWhitelistedGatewayBases().catch(() => [] as string[]);
  if (whitelisted.length) {
    try {
      const best = await Promise.any(
        whitelisted.map(async (b) => {
          const url = makeUrl(b);
          const ok = url ? await probeUrl(url, 2500) : false;
          if (!ok) throw new Error("probe_failed");
          return b;
        }),
      );
      if (best) return best;
    } catch {
      // fall through
    }
  }

  const publicBases = ["https://ipfs.io", "https://dweb.link"];
  try {
    const best = await Promise.any(
      publicBases.map(async (b) => {
        const url = makeUrl(b);
        const ok = url ? await probeUrl(url, 4000) : false;
        if (!ok) throw new Error("probe_failed");
        return b;
      }),
    );
    if (best) return best;
  } catch {
    // fall through
  }

  return localBase;
}

const crumbs = computed(() => {
  const p = String(relPath.value || "").replace(/^\/+/, "");
  if (!p) return [];
  const parts = p.split("/").filter(Boolean);
  const out: { label: string; path: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push({ label: parts[i], path: parts.slice(0, i + 1).join("/") });
  }
  return out;
});

const canDownload = computed(() => !!rootCid.value && !loading.value);
const canSaveToDrive = computed(() => rootProto.value === "ipfs" && !!rootCid.value && !loading.value);
const isPreviewUnavailable = computed(
  () => !loading.value && !!rootCid.value && !isDir.value && viewKind.value === "unknown",
);

function guessViewKind(nameOrPath: string): typeof viewKind.value {
  const s = String(nameOrPath || "").toLowerCase();
  const ext = s.split(".").pop() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return "image";
  if (["mp4", "webm", "mov", "mkv", "avi", "m3u8"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["pdf"].includes(ext)) return "pdf";
  if (["epub"].includes(ext)) return "epub";
  if (["docx"].includes(ext)) return "docx";
  if (["html", "htm"].includes(ext)) return "html";
  if (["md", "markdown", "mdown", "mkd", "mkdn"].includes(ext))
    return "markdown";
  if (["txt", "json", "xml", "csv", "log"].includes(ext)) return "text";
  return "unknown";
}

function looksLikeMarkdown(text: string, nameOrPath = ""): boolean {
  const path = String(nameOrPath || "").toLowerCase();
  if (
    [".md", ".markdown", ".mdown", ".mkd", ".mkdn"].some((ext) =>
      path.endsWith(ext),
    )
  ) {
    return true;
  }

  const sample = String(text || "").slice(0, 24_000);
  if (!sample.trim()) return false;

  let score = 0;

  if (/^#{1,6}\s+\S+/m.test(sample)) score += 2;
  if (/^[^\n]+\n(?:=+|-+)\s*$/m.test(sample)) score += 2;
  if (/(^|\n)(`{3,}|~{3,})/.test(sample)) score += 2;
  if (/^\|.+\|\s*$[\r\n]+\|(?:\s*:?-+:?\s*\|)+/m.test(sample)) score += 2;
  if (/!\[[^\]\n]*\]\([^)]+\)/.test(sample)) score += 1;
  if (/\[[^\]\n]+\]\([^)]+\)/.test(sample)) score += 1;
  if (/^\s{0,3}(?:>|\-\s|\*\s|\+\s|\d+\.\s)\S+/m.test(sample)) score += 1;
  if (/^\s{0,3}(?:[-*_])(?:\s*\1){2,}\s*$/m.test(sample)) score += 1;

  const lineCount = sample.split(/\r?\n/).length;
  if (lineCount >= 4 && /^\s*[-*+]\s+\S+/m.test(sample)) score += 1;

  return score >= 2;
}

async function sniffViewKindFromHead(
  url: string,
): Promise<typeof viewKind.value> {
  const target = String(url || "").trim();
  if (!target) return "unknown";

  try {
    const httpHead = useInternalLumen()?.httpHead;
    let ct = "";

    // Prefer the Electron http bridge to avoid CORS issues with local gateways.
      const res = await httpHead(target, { timeout: 8000 }).catch(() => null);
      const headers =
        res && res.headers && typeof res.headers === "object" ? res.headers : {};
      const headerKey = Object.keys(headers).find(
        (k) => String(k || "").toLowerCase() === "content-type",
      );
      ct = headerKey ? String(headers[headerKey] || "") : "";

    ct = String(ct || "").toLowerCase();
    console.log("[ipfs-page] sniffed content-type:", ct, "for", url);
    if (!ct) return "unknown";
    if (ct.startsWith("image/")) return "image";
    if (ct.startsWith("video/")) return "video";
    if (ct.startsWith("audio/")) return "audio";
    if (ct.includes("application/vnd.apple.mpegurl")) return "video";
    if (ct.includes("application/x-mpegurl")) return "video";
    if (ct.includes("text/html")) return "html";
    if (ct.includes("application/pdf")) return "pdf";
    if (ct.includes("application/epub+zip")) return "epub";
    if (ct.includes("officedocument.wordprocessingml")) return "docx";
    if (ct.includes("text/markdown") || ct.includes("text/x-markdown"))
      return "markdown";
    if (ct.startsWith("text/")) return "text";
    if (ct.includes("application/json") || ct.includes("application/xml"))
      return "text";
    return "unknown";
  } catch (err) {
    console.warn("[ipfs-page] sniff failed:", err);
    return "unknown";
  }
}

// Only the first few KB are ever inspected (see detectMagicKindFromBytes), so fetch a
// bounded prefix via Range instead of downloading arbitrarily large/huge files whole just
// to sniff their type — this used to be able to pull a multi-GB file fully into memory.
const MAGIC_BYTES_SNIFF_LIMIT = 32_768;

async function detectViaMagicBytes(
  target: string,
): Promise<typeof viewKind.value> {
  try {
    const got = await useInternalLumen()
      ?.ipfsGet?.(target, { maxBytes: MAGIC_BYTES_SNIFF_LIMIT })
      .catch(() => null);
    if (!got?.ok || !Array.isArray(got.data)) return "unknown";

    const bytes = new Uint8Array(got.data);
    if (bytes.length < 12) return "unknown";

    const magicKind = detectMagicKindFromBytes(bytes);
    if (magicKind !== "unknown") return magicKind;

    return "unknown";
  } catch (err) {
    console.warn("[ipfs-page] magic bytes detection failed:", err);
    return "unknown";
  }
}

function detectMagicKindFromBytes(bytes: Uint8Array): typeof viewKind.value {
  try {
    if (!bytes || bytes.length < 12) return "unknown";

    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      // DOCX: ZIP container with `word/` parts.
      try {
        const sample = bytes.subarray(0, Math.min(bytes.length, 16_384));
        const enc = new TextEncoder();
        const hasWord = includesBytes(sample, enc.encode("word/"));
        const hasContentTypes = includesBytes(sample, enc.encode("[Content_Types].xml"));
        const hasWordDoc = includesBytes(sample, enc.encode("word/document.xml"));
        if (hasWord && (hasContentTypes || hasWordDoc)) return "docx";
      } catch {
        // ignore
      }

      // EPUB: ZIP container that contains a `mimetype` entry with content "application/epub+zip".
      // When the `mimetype` entry is stored uncompressed, that string typically appears very early.
      try {
        const needle = new TextEncoder().encode("application/epub+zip");
        const sample = bytes.subarray(0, Math.min(bytes.length, 2048));
        if (includesBytes(sample, needle)) return "epub";
      } catch {
        // ignore
      }
    }

    // Check magic bytes for common formats
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      return "image";
    // PNG: 89 50 4E 47
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    )
      return "image";
    // GIF: 47 49 46 38
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    )
      return "image";
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    )
      return "image";
    // PDF: 25 50 44 46
    if (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    )
      return "pdf";

    return "unknown";
  } catch {
    return "unknown";
  }
}

function includesBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (!haystack?.length || !needle?.length) return false;
  if (needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function decodeEntities(input: string): string {
  const s = String(input || "");
  if (!s) return "";
  const basic = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");

  return basic
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      try {
        const code = Number.parseInt(String(hex), 16);
        if (!Number.isFinite(code) || code <= 0) return " ";
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    })
    .replace(/&#([0-9]+);/g, (_m, dec) => {
      try {
        const code = Number.parseInt(String(dec), 10);
        if (!Number.isFinite(code) || code <= 0) return " ";
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    });
}

function squeezeWhitespace(text: string): string {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractDocxTextFromXml(xml: string): string {
  const raw = String(xml || "");
  if (!raw) return "";

  const paras = raw.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const out: string[] = [];
  for (const para of paras) {
    const parts: string[] = [];
    const matches = para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
    for (const m of matches) {
      const v = decodeEntities(m[1] || "");
      if (v) parts.push(v);
    }
    const joined = parts.join("");
    if (joined.trim()) out.push(joined.trim());
  }

  if (!out.length) {
    return squeezeWhitespace(decodeEntities(raw.replace(/<[^>]+>/g, " ")));
  }

  return squeezeWhitespace(out.join("\n"));
}

async function extractDocxTextFromBytes(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file("word/document.xml");
  if (!file) return "";
  const xml = await file.async("string");
  return extractDocxTextFromXml(xml);
}

const indexHtmlEntry = computed(() => {
  const candidates = entries.value.filter((e) => e.type === "file");
  return (
    candidates.find((e) => String(e.name).toLowerCase() === "index.html") ||
    candidates.find((e) => String(e.name).toLowerCase() === "index.htm") ||
    null
  );
});

const masterM3u8Entry = computed(() => {
  const candidates = entries.value.filter((e) => e.type === "file");
  return candidates.find((e) => String(e.name).toLowerCase() === "master.m3u8") || null;
});

const isHlsManifest = computed(() => {
  if (viewKind.value !== "video") return false;
  const p = String(relPath.value || "").toLowerCase();
  return p.endsWith(".m3u8") || String(contentUrl.value || "").toLowerCase().includes(".m3u8");
});

const videoSrc = computed(() => {
  if (!contentUrl.value) return undefined;
  // For HLS on non-native platforms, we use hls.js which attaches a MediaSource blob URL.
  // Avoid binding `src` in Vue when HLS is active, otherwise Vue can overwrite the blob URL.
  return isHlsManifest.value ? undefined : contentUrl.value;
});

async function ensureHlsStopped(opts: { clearVideoSrc?: boolean } = {}) {
  try {
    if (hlsInstance && typeof hlsInstance.destroy === "function") hlsInstance.destroy();
  } catch {
    // ignore
  }
  hlsInstance = null;
  hlsError.value = "";
  const clearVideoSrc = !!opts.clearVideoSrc;
  const video = videoEl.value;
  if (!video) return;

  // Never clear the src for normal videos (e.g. mp4) because Vue controls it via `:src`.
  // Only clear when explicitly requested or when hls.js previously attached a blob URL.
  const current = String((video as any).currentSrc || video.src || "");
  const isBlob =
    current.startsWith("blob:") ||
    current.startsWith("mediasource:") ||
    current.startsWith("ms-stream:");
  if (!clearVideoSrc && !isBlob) return;

  try {
    video.pause?.();
  } catch {
    // ignore
  }
  try {
    video.removeAttribute("src");
    video.load?.();
  } catch {
    try {
      (video as any).src = "";
    } catch {
      // ignore
    }
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
        await ensureHlsStopped({ clearVideoSrc: true });
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
    // Last resort: try direct <video src> (may fail on Windows).
    await ensureHlsStopped();
    video.src = url;
    return;
  }

  const sanitizeHlsUrl = (u: string): string =>
    String(u || "").replace(/%(?![0-9A-Fa-f]{2})/g, "%25");

  await ensureHlsStopped({ clearVideoSrc: true });
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

function safeInjectIntoHead(html: string, inject: string): string {
  const src = String(html || "");
  const m = src.match(/<head\b[^>]*>/i);
  if (m && m.index != null) {
    const idx = m.index + m[0].length;
    return src.slice(0, idx) + inject + src.slice(idx);
  }
  return inject + src;
}

function buildIpfsSiteSrcdoc(params: {
  html: string;
  proto: "ipfs" | "ipns";
  cid: string;
  relEncoded: string;
  suffix: string;
  baseHref: string;
}): string {
  const cid = String(params.cid || "").trim();
  const proto = params.proto === "ipns" ? "ipns" : "ipfs";
  const relEncoded = String(params.relEncoded || "").replace(/^\/+/, "");
  const suffix = String(params.suffix || "");
  const baseHref = String(params.baseHref || "");

  const lumenPath = `lumen://${proto}/${cid}${relEncoded ? `/${relEncoded}` : ""}`;
  const pseudoPath = `/${proto}/${cid}${relEncoded ? `/${relEncoded}` : ""}`;

  const escapedBaseHref = baseHref.replace(/"/g, "&quot;");
  const inject = `
<base href="${escapedBaseHref}" />
<script>
(function(){
  const LUMEN_PATH = ${JSON.stringify(lumenPath)};
  const PSEUDO_PATH = ${JSON.stringify(pseudoPath)};
  const BASE_HREF = ${JSON.stringify(baseHref)};

  function post(msg){
    try{ parent.postMessage(Object.assign({ __lumen_ipfs_site: true }, msg), '*') }catch{}
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
    try{
      const raw = String(href || '').trim();
      if (raw && raw[0] === '#') return LUMEN_PATH + (location.search || '') + raw;
      const u = new URL(String(href || ''), BASE_HREF);
      const m = u.pathname.match(/\\/(ipfs|ipns)\\/([^\\/]+)(\\/.*)?$/);
      if (!m) return null;
      const nextProto = m[1] || 'ipfs';
      const nextCid = m[2] || '';
      const rest = m[3] || '';
      return 'lumen://' + nextProto + '/' + nextCid + rest + (u.search || '') + (u.hash || '');
    }catch{
      return null;
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
      if (/^(javascript:|mailto:|tel:)/i.test(href)) return;

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
      if (!d || d.__lumen_ipfs_parent !== true) return;
      if (d.type === 'setSuffix') {
        const suf = typeof d.suffix === 'string' ? d.suffix : '';
        applySuffix(suf);
      }
    }catch{}
  });

  // If JS changes the hash, keep the address bar in sync (without reloading).
  window.addEventListener('hashchange', function(){
    try{ post({ type: 'sync', url: LUMEN_PATH + (location.search || '') + (location.hash || '') }) }catch{}
  });
})();
${"</scr" + "ipt>"}
`.trim();

  return safeInjectIntoHead(params.html, `\n${inject}\n`);
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

function joinStableLinkTargetPath(basePath: string | undefined, rel: string): string {
  const base = String(basePath || "").trim().replace(/^\/+|\/+$/g, "");
  const rest = String(rel || "").trim().replace(/^\/+|\/+$/g, "");
  const parts = [base, rest].filter(Boolean);
  return parts.length ? `/${parts.join("/")}` : "";
}

function buildStableDisplayUrl(parsed: ReturnType<typeof parseIpfsUrl>): string {
  const rel = String(parsed.rel || "").replace(/^\/+/, "");
  const path = rel ? `/${encodePath(rel)}` : (parsed.dir ? "/" : "");
  return `lumen://ipns/${parsed.cid}${path}${parsed.suffix || ""}`;
}

function isResolvedStableTargetUrl(input: string): boolean {
  if (!stableDisplayUrl.value) return false;
  const parsed = parseIpfsUrl(input);
  return !!parsed.cid && parsed.proto === rootProto.value && parsed.cid === rootCid.value;
}

function onSiteMessage(evt: MessageEvent) {
  const d: any = (evt as any)?.data;
  if (!d || d.__lumen_ipfs_site !== true) return;
  const next = typeof d.url === "string" ? d.url : "";
  if (!next) return;
  if (d.type === "newtab") {
    openInNewTab?.(next);
    return;
  }
  if (d.type === "sync") {
    if (isResolvedStableTargetUrl(next)) return;
    navigate?.(next, { push: false });
    return;
  }
  if (d.type === "navigate") {
    if (isResolvedStableTargetUrl(next)) return;
    navigate?.(next);
  }
}

function toLumenFromWebHref(raw: string): string | null {
  const href = String(raw || "").trim();
  if (!href) return null;

  const normalizeDirRest = (rest: string): string => {
    const r = String(rest || "");
    if (!r || r === "/") return "";
    return r.endsWith("/") ? r.slice(0, -1) : r;
  };

  try {
    const u = new URL(href);
    const pathname = String(u.pathname || "");
    const hostname = String(u.hostname || "").trim();

    // Subdomain gateway support: http://<cid>.ipfs.localhost:8080/...
    if (hostname) {
      const h = hostname.toLowerCase();
      const mHost = h.match(/^([a-z0-9]+)\.(ipfs|ipns)\./i);
      if (mHost && mHost[1] && mHost[2]) {
        const id = mHost[1] || "";
        const kind = String(mHost[2] || "").toLowerCase();
        const rest = normalizeDirRest(pathname || "/");
        if (kind === "ipfs") return `lumen://ipfs/${id}${rest}${u.search || ""}${u.hash || ""}`;
        if (kind === "ipns") return `lumen://ipns/${id}${rest}${u.search || ""}${u.hash || ""}`;
      }
    }
    let m = pathname.match(/^\/ipfs\/([^/]+)(\/.*)?$/i);
    if (m) {
      const cid = m[1] || "";
      const rest = normalizeDirRest(m[2] || "");
      return `lumen://ipfs/${cid}${rest}${u.search || ""}${u.hash || ""}`;
    }
    m = pathname.match(/^\/ipns\/([^/]+)(\/.*)?$/i);
    if (m) {
      const name = m[1] || "";
      const rest = normalizeDirRest(m[2] || "");
      return `lumen://ipns/${name}${rest}${u.search || ""}${u.hash || ""}`;
    }
    return null;
  } catch {
    return null;
  }
}

function syncNavFromWebview(rawUrl: string, opts: { push?: boolean } = {}) {
  if (!pageActive.value) return;
  if (!navigate) return;
  const next = toLumenFromWebHref(rawUrl);
  if (!next) return;
  if (isResolvedStableTargetUrl(next)) return;
  const cur = String(currentTabUrl?.value || "").trim();
  if (cur && cur === next) return;
  navigate(next, { push: opts.push ?? true });
}

function onWebviewWillNavigate(ev: any) {
  if (!pageActive.value) return;
  const href = String(ev?.url || "");
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
    // Only allow webview to navigate inside /ipfs or /ipns.
    if (!toLumenFromWebHref(href)) {
      ev.preventDefault?.();
    }
  } catch {
    ev.preventDefault?.();
  }
}

function onWebviewDidNavigate(ev: any) {
  syncNavFromWebview(String(ev?.url || ""), { push: true });
}

function onWebviewDidNavigateInPage(ev: any) {
  syncNavFromWebview(String(ev?.url || ""), { push: true });
}

function onWebviewNewWindow(ev: any) {
  if (!pageActive.value) return;
  ev.preventDefault?.();
  const href = String(ev?.url || "");
  const lumen = toLumenFromWebHref(href);
  if (lumen) openInNewTab?.(lumen);
  else if (/^\s*https?:\/\//i.test(href)) openInNewTab?.(href.trim());
}

function onWebviewIpcMessage(ev: any) {
  if (!pageActive.value) return;
  const channel = String(ev?.channel || "").trim();
  if (channel === "extensions:installFromStore") {
    const payload = Array.isArray(ev?.args) ? ev.args[0] : null;
    const input =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object"
          ? String((payload as any).id || (payload as any).url || "").trim()
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
      console.warn("[ipfs-webview][extensions] install from store failed:", result?.error || "unknown_error");
    }
  } catch (error: any) {
    console.warn("[ipfs-webview][extensions] install from store failed:", error?.message || error || "unknown_error");
  }
}

function isHtmlLikePath(pathValue: string): boolean {
  const p = String(pathValue || "").toLowerCase();
  return p.endsWith(".html") || p.endsWith(".htm") || p.endsWith(".xhtml");
}

async function precheckHtmlDocument(url: string): Promise<boolean> {
  const target = String(url || "").trim();
  if (!target) return false;
  try {
    const httpHead = useInternalLumen()?.httpHead;
    let status = 0;
    let ct = "";

      const res = await httpHead(target, { timeout: 8000 }).catch(() => null);
      status = Number(res?.status || 0);
      const headers =
        res && res.headers && typeof res.headers === "object" ? res.headers : {};
      const headerKey = Object.keys(headers).find(
        (k) => String(k || "").toLowerCase() === "content-type",
      );
      ct = headerKey ? String(headers[headerKey] || "") : "";

    if (status !== 200 && status !== 206) return false;
    const lower = String(ct || "").toLowerCase();
    return lower.includes("text/html") || lower.includes("application/xhtml+xml");
  } catch {
    return false;
  }
}

async function load() {
  const url = String(currentTabUrl?.value || window.location.href || "");
  const parsed = parseIpfsUrl(url);
  const visibleParsed = { ...parsed };
  stableDisplayUrl.value = "";

  if (parsed.proto === "ipns" && parsed.cid) {
    const target = await resolveStableLinkTarget(parsed.cid).catch(() => null);
    if (target) {
      stableDisplayUrl.value = buildStableDisplayUrl(visibleParsed);
      const path = joinStableLinkTargetPath(target.basePath, parsed.rel);
      parsed.proto = target.proto;
      parsed.cid = target.id;
      parsed.rel = path.replace(/^\/+/, "");
      parsed.dir = path.endsWith("/");
      if (target.suffix) parsed.suffix = target.suffix;
    }
  }

  // Auto-convert CIDv0 (Qm...) to CIDv1 base32 (bafy...) so localhost subdomain gateways work.
  if (parsed.proto === "ipfs" && /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(parsed.cid)) {
    const api: any = useInternalLumen();
    if (api && typeof api.ipfsCidToBase32 === "function") {
      const res = await api.ipfsCidToBase32(parsed.cid).catch(() => null);
      const next = String(res?.cid || "").trim();
      if (next && next !== parsed.cid) {
        const raw = String(url || "").trim();
        const withoutScheme = /^lumen:\/\//i.test(raw) ? raw.slice("lumen://".length) : raw;
        const isIpfs = withoutScheme.toLowerCase().startsWith("ipfs/");
        if (navigate && isIpfs) {
          const rest = withoutScheme.slice("ipfs/".length);
          const idx = rest.search(/[/?#]/);
          const tail = idx >= 0 ? rest.slice(idx) : "";
          const rewritten = `lumen://ipfs/${next}${tail}`;
          if (rewritten !== raw) navigate(rewritten, { push: false });
        }
        parsed.cid = next;
      }
    }
  }

  if (
    rootCid.value &&
    viewKind.value === "html" &&
    rootProto.value === parsed.proto &&
    rootCid.value === parsed.cid &&
    relPath.value === parsed.rel &&
    isOnlyHashChange(suffix.value, parsed.suffix)
  ) {
    suffix.value = parsed.suffix;
    return;
  }

  rootProto.value = parsed.proto;
  rootCid.value = parsed.cid;
  relPath.value = parsed.rel;
  wantsDir.value = parsed.dir;
  suffix.value = parsed.suffix;

  loading.value = true;
  error.value = "";
  entries.value = [];
  isDir.value = false;
  viewKind.value = "unknown";
  isBareHtmlView.value = false;
  await ensureHlsStopped();
  textContent.value = "";
  docxContent.value = "";
  mediaErrored.value = false;
  htmlSrcdoc.value = "";
  clearHtmlFrame();
  resolvedGatewayBase.value = "";
  saved.value = false;
  savedCid.value = "";

  if (!rootCid.value) {
    // Show welcome page when no CID is provided
    isDir.value = true;
    loading.value = false;
    return;
  }

  try {
    const target = relPath.value
      ? `/${rootProto.value}/${rootCid.value}/${relPath.value}`
      : `/${rootProto.value}/${rootCid.value}`;
    const res = await useInternalLumen()?.ipfsLs?.(target).catch(() => null);
    const list = Array.isArray(res?.entries) ? res.entries : [];
    const mapped: Entry[] = list
      .filter((it: any) => it && it.name && it.cid)
      .map((it: any) => ({
        key: `${it.cid}:${it.name}`,
        name: String(it.name),
        cid: String(it.cid),
        type: String(it.type) === "dir" ? "dir" : "file",
        size: typeof it.size === "number" ? it.size : null,
        relPath: relPath.value
          ? `${relPath.value}/${String(it.name)}`
          : String(it.name),
      }));
    mapped.sort((a, b) =>
      a.type === b.type
        ? a.name.localeCompare(b.name)
        : a.type === "dir"
          ? -1
          : 1,
    );
    entries.value = mapped;
    isDir.value = wantsDir.value || mapped.length > 0;

    // Web-like behavior: if navigating to a directory path without an explicit trailing slash,
    // auto-open `index.html` / `index.htm` when present.
    if (!wantsDir.value && isDir.value && navigate) {
      // If the current path already looks like an explicit HTML file, do not treat it as a "directory route"
      // and append another `/index.html` (avoids `/index.html/index.html` in weird DAGs).
      const allowAutoIndex = !(relPath.value && isHtmlLikePath(relPath.value));
      if (allowAutoIndex) {
        const idx =
          mapped.find(
            (e) => e.type === "file" && String(e.name).toLowerCase() === "index.html",
          ) ||
          mapped.find(
            (e) => e.type === "file" && String(e.name).toLowerCase() === "index.htm",
          ) ||
          null;

        if (idx) {
          const next = `lumen://${rootProto.value}/${rootCid.value}/${encodePath(idx.relPath)}${suffix.value || ""}`;
          const cur = String(currentTabUrl?.value || "").trim();
          if (cur !== next) {
            navigate(next, { push: false });
            return;
          }
        }
      }
    }

    if (!isDir.value) {
      resolvedGatewayBase.value = await pickGatewayBaseForCurrentTarget();
      viewKind.value = guessViewKind(relPath.value || rootCid.value);
      if (viewKind.value === "unknown") {
        const sniffed = await sniffViewKindFromHead(contentUrl.value);
        if (sniffed !== "unknown") {
          viewKind.value = sniffed;
        } else {
          // Fallback: try magic bytes detection for images
          const magicKind = await detectViaMagicBytes(target);
          if (magicKind !== "unknown") viewKind.value = magicKind;
        }
      }
      if (viewKind.value === "text" || viewKind.value === "markdown") {
        const gateways = await loadWhitelistedGatewayBases().catch(() => []);
        const got = await useInternalLumen()
          ?.ipfsGet?.(target, { gateways })
          .catch(() => null);
        if (got?.ok && Array.isArray(got.data)) {
          const bytes = new Uint8Array(got.data);
          const magicKind = detectMagicKindFromBytes(bytes);
          if (magicKind !== "unknown" && magicKind !== "text") {
            // Content-type can be wrong for extension-less CIDs. Avoid showing raw PDF binaries as text.
            viewKind.value = magicKind;
            textContent.value = "";
          } else if (bytes.byteLength > 2_000_000) {
            viewKind.value = "unknown";
          } else {
            const decoded = new TextDecoder("utf-8", {
              fatal: false,
            }).decode(bytes);
            textContent.value = decoded;
            if (
              viewKind.value === "text" &&
              looksLikeMarkdown(decoded, relPath.value || rootCid.value)
            ) {
              viewKind.value = "markdown";
            }
          }
        } else {
          viewKind.value = "unknown";
        }
      }

      if (viewKind.value === "docx") {
        const gateways = await loadWhitelistedGatewayBases().catch(() => []);
        const got = await useInternalLumen()
          ?.ipfsGet?.(target, { gateways, timeoutMs: 20000 })
          .catch(() => null);
        if (got?.ok && Array.isArray(got.data)) {
          const bytes = new Uint8Array(got.data);
          if (bytes.byteLength > 20_000_000) {
            viewKind.value = "unknown";
          } else {
            try {
              const text = await extractDocxTextFromBytes(bytes);
              const trimmed = String(text || "").trim();
              if (!trimmed) {
                viewKind.value = "unknown";
              } else {
                docxContent.value = trimmed.slice(0, 200_000);
              }
            } catch {
              viewKind.value = "unknown";
            }
          }
        } else {
          viewKind.value = "unknown";
        }
      }

      if (viewKind.value === "html") {
        // If this is a real HTML file, render it full-bleed (like domain sites) instead
        // of inside the framed IPFS viewer.
        if (!wantsDir.value && relPath.value && isHtmlLikePath(relPath.value)) {
          const ok = await precheckHtmlDocument(contentUrl.value);
          if (ok) isBareHtmlView.value = true;
        }

        const gateways = await loadWhitelistedGatewayBases().catch(() => []);
        const got = await useInternalLumen()
          ?.ipfsGet?.(target, { gateways })
          .catch(() => null);
        if (got?.ok && Array.isArray(got.data)) {
          const bytes = new Uint8Array(got.data);
          if (bytes.byteLength > 2_000_000) {
            viewKind.value = "unknown";
          } else {
            const html = new TextDecoder("utf-8", { fatal: false }).decode(
              bytes,
            );
            const relEncoded = relPath.value ? encodePath(relPath.value) : "";
            const baseHref = relEncoded
              ? `${localIpfsGatewayBase()}/${rootProto.value}/${rootCid.value}/${relEncoded}`
              : `${localIpfsGatewayBase()}/${rootProto.value}/${rootCid.value}/`;
            htmlSrcdoc.value = buildIpfsSiteSrcdoc({
              html,
              proto: rootProto.value,
              cid: rootCid.value,
              relEncoded,
              suffix: suffix.value,
              baseHref,
            });
            setHtmlFrameFromSrcdoc(htmlSrcdoc.value);
          }
        } else {
          viewKind.value = "unknown";
        }
      }
    }
  } catch (e: any) {
    error.value = String(e?.message || e);
  } finally {
    loading.value = false;
    void refreshSavedState();
  }
}

function openIndexHtml() {
  const entry = indexHtmlEntry.value;
  if (!entry || !navigate) return;
  navigate(`lumen://${rootProto.value}/${rootCid.value}/${encodePath(entry.relPath)}`);
}

function openMasterHls() {
  const entry = masterM3u8Entry.value;
  if (!entry || !navigate) return;
  navigate(`lumen://${rootProto.value}/${rootCid.value}/${encodePath(entry.relPath)}`);
}

function openEntry(it: Entry) {
  if (!navigate) return;
  const dirSuffix = it.type === "dir" ? "/" : "";
  navigate(
    `lumen://${rootProto.value}/${rootCid.value}/${encodePath(it.relPath)}${dirSuffix}`,
  );
}

function openDirRoot() {
  if (!navigate) return;
  navigate(`lumen://${rootProto.value}/${rootCid.value}/`);
}

function openDirCrumb(idx: number) {
  if (!navigate) return;
  const c = crumbs.value[idx];
  if (!c) return;
  navigate(`lumen://${rootProto.value}/${rootCid.value}/${encodePath(c.path)}/`);
}

async function copyText(v: string) {
  await copyToClipboardShared(v);
}

async function copyLink() {
  await copyText(displayLumenUrl.value);
}

async function copyLinkFor(it: Entry) {
  const dirSuffix = it.type === "dir" ? "/" : "";
  await copyText(
    `lumen://${rootProto.value}/${rootCid.value}/${encodePath(it.relPath)}${dirSuffix}`,
  );
}

function upsertDriveSavedFile(cid: string, name: string) {
  const key = String(cid || "").trim();
  const nextName = String(name || "").trim();
  if (!key || !nextName) return;

  const pid = activeDriveProfileId();
  const storageKey = driveFilesStorageKey(pid);
  try {
    const stored = localStorage.getItem(storageKey);
    const parsed = stored ? JSON.parse(stored) : [];
    const base = Array.isArray(parsed) ? (parsed as any[]) : [];
    const filtered = base.filter((f) => String(f?.cid || "").trim() !== key);
    const next: DriveSavedFile = {
      cid: key,
      name: nextName,
      size: 0,
      uploadedAt: Date.now(),
    };
    const out = [next, ...filtered].slice(0, 500);
    localStorage.setItem(storageKey, JSON.stringify(out));
    nextDriveBackupSeq(pid);
  } catch {
    // ignore
  }
}

function setDriveSavedName(cid: string, name: string) {
  const key = String(cid || "").trim();
  const nextName = String(name || "").trim();
  if (!key || !nextName) return;
  const pid = activeDriveProfileId();
  const storageKey = driveLocalNamesStorageKey(pid);
  try {
    const stored = localStorage.getItem(storageKey);
    const parsed = stored ? JSON.parse(stored) : {};
    const base = parsed && typeof parsed === "object" ? parsed : {};
    const next = { ...base, [key]: nextName };
    localStorage.setItem(storageKey, JSON.stringify(next));
    nextDriveBackupSeq(pid);
  } catch {
    // ignore
  }
}

function inferDefaultName(): string {
  const p = String(relPath.value || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!p) return "";
  const seg = p.split("/").filter(Boolean).slice(-1)[0] || "";
  return seg;
}

async function resolveCurrentItemCid(): Promise<string> {
  if (!rootCid.value) throw new Error("Missing CID.");
  const p = String(relPath.value || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!p) return rootCid.value;

  const parts = p.split("/").filter(Boolean);
  const name = parts[parts.length - 1] || "";
  const parent = parts.slice(0, -1).join("/");
  const parentTarget = parent ? `${rootCid.value}/${parent}` : rootCid.value;

  const res = await useInternalLumen()
    ?.ipfsLs?.(parentTarget)
    .catch(() => null);
  const list = Array.isArray(res?.entries) ? res.entries : [];
  const hit = list.find((it: any) => String(it?.name || "") === name);
  const cid = String(hit?.cid || "").trim();
  return cid || rootCid.value;
}

async function resolveSaveTargetCid(): Promise<string> {
  if (!rootCid.value) throw new Error("Missing CID.");
  // For HLS, pin the root directory CID so all playlists + segments stay available.
  if (isHlsManifest.value) return rootCid.value;
  return resolveCurrentItemCid();
}

async function openSaveModal() {
  if (!rootCid.value || saving.value || saved.value) return;
  showSaveModal.value = true;
  saveModalError.value = "";
  saveTargetCid.value = "";
  saveNameDraft.value = inferDefaultName();
  clearSavePinJobState();

  savePreparing.value = true;
  try {
    const cid = await resolveSaveTargetCid();
    saveTargetCid.value = cid;
  } catch (e: any) {
    saveModalError.value = String(e?.message || e || "Unable to prepare save.");
  } finally {
    savePreparing.value = false;
  }
}

function closeSaveModal() {
  if (savePinIsRunning.value) return;
  showSaveModal.value = false;
  savePreparing.value = false;
  saveTargetCid.value = "";
  saveModalError.value = "";
}

async function waitForSavePinCompletion(jobId: string, cid: string, name: string) {
  const api: any = useInternalLumen();
  const id = String(jobId || "").trim();
  if (!id || savePinWaitJobId.value === id) return;
  savePinWaitJobId.value = id;
  try {
    const res = await api?.ipfsPinWait?.(id, { timeoutMs: 0 });
    if (savePinWaitJobId.value !== id) return;
    if (res?.job) applySavePinJobSnapshot(res.job);

    if (res?.ok) {
      upsertDriveSavedFile(cid, name);
      setDriveSavedName(cid, name);
      savedCid.value = cid;
      saved.value = true;
      showSaveModal.value = false;
      return;
    }

    if (res?.cancelled || String(res?.error || "").trim().toLowerCase() === "user_cancelled") {
      saveModalError.value = "Save cancelled.";
      saving.value = false;
      return;
    }

    error.value = String(res?.error || "save_failed");
    saveModalError.value = error.value;
    saving.value = false;
  } catch (e: any) {
    error.value = String(e?.message || e);
    saveModalError.value = error.value;
    saving.value = false;
  } finally {
    if (savePinWaitJobId.value === id) savePinWaitJobId.value = "";
  }
}

async function confirmSaveToDrive() {
  if (!rootCid.value || savePinIsRunning.value) return;
  const name = String(saveNameDraft.value || "").trim();
  if (!name) {
    saveModalError.value = "Please enter a name.";
    return;
  }

  saving.value = true;
  try {
    const cid = saveTargetCid.value || (await resolveSaveTargetCid());
    const api: any = useInternalLumen();
    const started = await api?.ipfsPinStart?.({ cidOrPath: cid, name }).catch(() => null);
    if (!started?.ok || !started?.job?.id) {
      throw new Error(String(started?.error || "save_failed"));
    }
    applySavePinJobSnapshot(started.job);
    void waitForSavePinCompletion(String(started.job.id || ""), cid, name);
  } catch (e: any) {
    error.value = String(e?.message || e);
    saveModalError.value = error.value;
    saving.value = false;
  }
}

async function pauseSavePinJob() {
  const api: any = useInternalLumen();
  if (!savePinJobId.value || !api?.ipfsPinPause) return;
  const res = await api.ipfsPinPause(savePinJobId.value).catch(() => null);
  if (res?.job) applySavePinJobSnapshot(res.job);
}

async function resumeSavePinJob() {
  const api: any = useInternalLumen();
  if (!savePinJobId.value || !api?.ipfsPinResume) return;
  saveModalError.value = "";
  const res = await api.ipfsPinResume(savePinJobId.value).catch(() => null);
  if (res?.job) {
    applySavePinJobSnapshot(res.job);
    const cid = saveTargetCid.value || (await resolveSaveTargetCid().catch(() => ""));
    const name = String(saveNameDraft.value || "").trim();
    if (cid && name) void waitForSavePinCompletion(String(res.job.id || ""), cid, name);
    return;
  }
  if (res?.error) saveModalError.value = String(res.error);
}

async function cancelSavePinJob() {
  const api: any = useInternalLumen();
  if (!savePinJobId.value || !api?.ipfsPinCancel) return;
  const res = await api.ipfsPinCancel(savePinJobId.value).catch(() => null);
  if (res?.job) applySavePinJobSnapshot(res.job);
}

async function refreshSavedState() {
  try {
    saved.value = false;
    savedCid.value = "";
    if (rootProto.value !== "ipfs") return;
    if (!rootCid.value) return;
    const cid = await resolveSaveTargetCid();
    savedCid.value = cid;
    const res = await useInternalLumen()?.ipfsPinList?.().catch(() => null);
    const pins =
      res?.ok && Array.isArray(res.pins)
        ? res.pins.map((x: any) => String(x))
        : [];
    saved.value = pins.includes(cid);
  } catch {
    saved.value = false;
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

async function download() {
  if (!canDownload.value) return;
  const rel = String(relPath.value || "").replace(/^\/+/, "");
  const isHlsMaster =
    isHlsManifest.value && rel.toLowerCase().endsWith("master.m3u8");

  // For folders (and for HLS masters), downloading a single file isn't useful.
  // Use the gateway `?format=tar` so the browser streams a full archive.
  if (isDir.value || isHlsMaster) {
    const base = String(resolvedGatewayBase.value || localIpfsGatewayBase())
      .replace(/\/+$/, "")
      .trim();
    if (!base) return;

    const dirRel = isHlsMaster ? "" : rel;
    const p = dirRel ? `/${encodePath(dirRel)}` : "";
    const tarUrl = `${base}/${rootProto.value}/${rootCid.value}${p}?format=tar`;

    const a = document.createElement("a");
    a.href = tarUrl;
    a.rel = "noopener";
    a.click();
    return;
  }

  const target = rel ? `/${rootProto.value}/${rootCid.value}/${rel}` : `/${rootProto.value}/${rootCid.value}`;
  const gateways = await loadWhitelistedGatewayBases().catch(() => []);
  const got = await useInternalLumen()?.ipfsGet?.(target, { gateways }).catch(() => null);
  if (!got?.ok || !Array.isArray(got.data)) return;
  const bytes = new Uint8Array(got.data);
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = rel ? rel.split("/").pop() || rootCid.value : rootCid.value;
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function onMediaError() {
  mediaErrored.value = true;
  if (!isHlsManifest.value) viewKind.value = "unknown";
}

function openInNewWindow() {
  if (!contentUrl.value) return;
  window.open(contentUrl.value, "_blank");
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

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    load();
  }
);

onMounted(() => {
  pageActive.value = true;
  attachSiteMsgListener();
  startUrlWatch();
  void nextTick(() => registerFindTargetWithRetry());
  try {
    const api: any = useInternalLumen();
    if (api?.ipfsOnPinProgress) {
      stopPinProgressListener = api.ipfsOnPinProgress((payload: any) => {
        const job = payload?.job || null;
        if (!job || String(job.id || "") !== String(savePinJobId.value || "")) return;
        applySavePinJobSnapshot(job);
      });
    }
  } catch {
    // ignore
  }
});
onActivated(() => {
  pageActive.value = true;
  attachSiteMsgListener();
  startUrlWatch();
  void nextTick(() => registerFindTargetWithRetry());
});
onDeactivated(() => {
  pageActive.value = false;
  webviewLoading.value = false;
  detachSiteMsgListener();
  stopUrlWatch();
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
  detachSiteMsgListener();
  stopUrlWatch();
  clearHtmlFrame();
  void ensureHlsStopped();
  try {
    const tabId = String(currentTabId?.value || "").trim();
    if (tabId && typeof registerFindTarget === "function") registerFindTarget(tabId, null);
  } catch {
    // ignore
  }
  try {
    stopPinProgressListener?.();
  } catch {
    // ignore
  }
  stopPinProgressListener = null;
});

watch(
  () => [viewKind.value, contentUrl.value, isHlsManifest.value, !!videoEl.value],
  async ([k, url, isHls, hasVideo]) => {
    if (k === "video" && isHls && url && hasVideo) {
      await ensureHlsPlaying(String(url));
    } else {
      await ensureHlsStopped();
    }
  },
  { flush: "post", immediate: true },
);

watch(
  () => [viewKind.value, contentUrl.value],
  async ([k, url]) => {
    const tabId = String(currentTabId?.value || "").trim();
    if (!tabId || typeof registerFindTarget !== "function") return;

    if (k !== "html" || !url) {
      webviewLoading.value = false;
      try {
        registerFindTarget(tabId, null);
      } catch {
        // ignore
      }
      return;
    }

    await nextTick();
    registerFindTargetWithRetry();
  },
  { flush: "post", immediate: true },
);

let stopUrlWatchHandle: (() => void) | null = null;
function startUrlWatch() {
  if (stopUrlWatchHandle) return;
  stopUrlWatchHandle = watch(
    () => currentTabUrl?.value,
    () => load(),
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
      load();
    }
  }
);

</script>
