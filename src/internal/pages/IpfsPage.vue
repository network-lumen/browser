<template>
  <div class="ipfs-page" :class="{ 'ipfs-page--bare': isBareHtmlView }">
    <main class="main-content">
      <header v-if="!isBareHtmlView" class="content-header">
        <div class="header-actions">
          <button
            v-if="isDir && indexHtmlEntry"
            class="plans-btn"
            type="button"
            @click="openIndexHtml"
            :disabled="!navigate"
          >
            <span>Open website</span>
          </button>
          <button
            v-if="isDir && masterM3u8Entry"
            class="plans-btn"
            type="button"
            @click="openMasterHls"
            :disabled="!navigate"
            title="Play HLS video"
          >
            <Play :size="16" />
            <span>Play video</span>
          </button>
          <button
            class="plans-btn"
            type="button"
            @click="openSaveModal"
            :class="{ 'save-active': saved }"
            :disabled="!rootCid || loading || saving || saved"
            :title="
              saved ? 'Saved to Drive' : saving ? 'Saving...' : 'Save to Drive'
            "
          >
            <Check v-if="saved" :size="16" />
            <Save v-else :size="16" />
            <span>{{ saved ? "Saved" : saving ? "Saving..." : "Save" }}</span>
          </button>
          <button
            class="plans-btn"
            type="button"
            @click="copyLink"
            :disabled="!rootCid"
          >
            <Copy :size="16" />
            <span>Copy link</span>
          </button>
          <button
            class="plans-btn"
            type="button"
            @click="download"
            :disabled="!canDownload"
          >
            <Download :size="16" />
            <span>Download</span>
          </button>
        </div>
      </header>

      <div v-if="loading" class="loading-wrap">
        <UiSpinner size="md" />
      </div>

      <div v-else-if="error" class="error-wrap">
        {{ error }}
      </div>

      <template v-else>
        <div v-if="!rootCid" class="welcome-wrap">
          <div class="welcome-content">
            <h2>IPFS Content Viewer</h2>
            <p>View and download content from IPFS using CIDs.</p>
            <div class="welcome-example">
              <p class="example-label">Example:</p>
              <code
                >lumen://ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco</code
              >
            </div>
            <p class="welcome-hint">
              Enter an IPFS CID in the address bar to view content.
            </p>
          </div>
        </div>

        <div v-else-if="isDir" class="dir-wrap">
          <div class="breadcrumb">
            <button
              class="crumb"
              type="button"
              @click="openDirRoot"
              :disabled="!navigate"
            >
              /
            </button>
            <template v-for="(c, idx) in crumbs" :key="c.path">
              <span v-if="idx > 0" class="sep">/</span>
              <button
                class="crumb"
                type="button"
                @click="openDirCrumb(idx)"
                :disabled="!navigate"
              >
                {{ c.label }}
              </button>
            </template>
          </div>

          <div v-if="!entries.length" class="empty-dir">Empty folder.</div>

          <div v-else class="dir-table">
            <div
              v-for="it in entries"
              :key="it.key"
              class="dir-row"
              @dblclick="openEntry(it)"
            >
              <div class="dir-name" @click="openEntry(it)">
                <Folder v-if="it.type === 'dir'" :size="16" class="ico" />
                <BookOpen v-else-if="isEpubName(it.name)" :size="16" class="ico" />
                <File v-else :size="16" class="ico" />
                <span class="txt-overflow-ellipsis nowrap overflow-hidden">{{
                  it.name
                }}</span>
              </div>
              <div class="dir-size mono">
                {{ it.size != null ? formatSize(it.size) : "-" }}
              </div>
              <div class="dir-actions">
                <button
                  class="btn-ghost"
                  type="button"
                  @click.stop="copyLinkFor(it)"
                >
                  Copy link
                </button>
                <button
                  class="btn-ghost"
                  type="button"
                  @click.stop="openEntry(it)"
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="viewer" :class="{ 'viewer--bare': isBareHtmlView }">
          <img
            v-if="viewKind === 'image'"
            :src="contentUrl"
            class="media img"
            alt=""
            @error="onMediaError"
          />

          <template v-else-if="viewKind === 'video'">
            <video
              ref="videoEl"
              :src="videoSrc"
              class="media"
              controls
              playsinline
            ></video>
            <div v-if="hlsError" class="hls-error">
              {{ hlsError }}
            </div>
          </template>

          <audio
            v-else-if="viewKind === 'audio'"
            :src="contentUrl"
            controls
            class="audio"
          ></audio>

          <webview
            v-else-if="viewKind === 'html'"
            ref="siteWebview"
            :src="contentUrl"
            class="embed"
            :class="{ 'embed--bare': isBareHtmlView }"
            partition="persist:lumen"
            allowpopups
            :webpreferences="webprefs"
            @will-navigate="onWebviewWillNavigate"
            @did-navigate="onWebviewDidNavigate"
            @did-navigate-in-page="onWebviewDidNavigateInPage"
            @new-window="onWebviewNewWindow"
            @ipc-message="onWebviewIpcMessage"
          ></webview>

          <iframe
            v-else-if="viewKind === 'pdf'"
            :src="contentUrl"
            class="embed"
          ></iframe>

          <iframe
            v-else-if="viewKind === 'epub'"
            :src="epubReaderUrl"
            class="embed"
            allow="fullscreen"
          ></iframe>

          <pre v-else-if="viewKind === 'text'" class="text">{{
            textContent
          }}</pre>

          <div v-else class="unsupported">
            <div class="unsupported-content">
              <h3>Preview not available</h3>
              <p>This content type cannot be previewed directly.</p>
              <div class="unsupported-actions">
                <button class="btn-download" @click="download">
                  <Download :size="16" />
                  <span>Download file</span>
                </button>
                <button class="btn-secondary" @click="openInNewWindow">
                  <span>Open in new window</span>
                </button>
              </div>
              <p class="unsupported-hint">
                <strong>CID:</strong> {{ rootCid }}<br />
                <strong>Path:</strong> {{ relPath || "/" }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </main>

    <Transition name="fade">
      <div
        v-if="showSaveModal"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        @click="closeSaveModal"
      >
        <div class="modal" @click.stop>
          <header class="modal-header">
            <h3>Save to Drive</h3>
            <button class="modal-close" type="button" @click="closeSaveModal">
              <span>×</span>
            </button>
          </header>

          <div class="modal-body">
            <label class="modal-label" for="save-name">Name</label>
            <input
              id="save-name"
              v-model="saveNameDraft"
              class="modal-input"
              type="text"
              :placeholder="saveNamePlaceholder"
              :disabled="savePreparing || saving"
              @keydown.enter.prevent="confirmSaveToDrive"
            />

            <div v-if="saveModalError" class="modal-error">
              {{ saveModalError }}
            </div>
          </div>

          <footer class="modal-actions">
            <button class="btn-secondary" type="button" @click="closeSaveModal">
              Cancel
            </button>
            <button
              class="btn-primary"
              type="button"
              :disabled="savePreparing || saving"
              @click="confirmSaveToDrive"
            >
              {{ saving ? "Saving..." : "Save" }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { BookOpen, Check, Copy, Download, File, Folder, Play, Save } from "lucide-vue-next";
import UiSpinner from "../../ui/UiSpinner.vue";
import {
  localIpfsGatewayBase,
  loadWhitelistedGatewayBases,
  probeUrl,
} from "../services/contentResolver";

type Entry = {
  key: string;
  name: string;
  cid: string;
  type: "dir" | "file";
  size: number | null;
  relPath: string;
};

const currentTabUrl = inject<any>("currentTabUrl", null);
const currentTabRefresh = inject<any>("currentTabRefresh", null);
const openInNewTab = inject<((url: string) => void) | null>(
  "openInNewTab",
  null,
);
const navigate = inject<
  ((url: string, opts?: { push?: boolean }) => void) | null
>("navigate", null);

const loading = ref(false);
const error = ref("");
const entries = ref<Entry[]>([]);
const isDir = ref(false);
const viewKind = ref<
  "image" | "video" | "audio" | "html" | "pdf" | "epub" | "text" | "unknown"
>("unknown");
const textContent = ref("");
const mediaErrored = ref(false);
const hlsError = ref("");
const htmlSrcdoc = ref("");
const htmlFrameUrl = ref("");
const siteFrame = ref<HTMLIFrameElement | null>(null);
const siteWebview = ref<any>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
let hlsInstance: any = null;
const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";
const pageActive = ref(false);
const isBareHtmlView = ref(false);

const rootCid = ref("");
const relPath = ref("");
const wantsDir = ref(false);
const suffix = ref("");
const resolvedGatewayBase = ref("");
const saving = ref(false);
const saved = ref(false);
const savedCid = ref("");
const showSaveModal = ref(false);
const saveNameDraft = ref("");
const saveModalError = ref("");
const savePreparing = ref(false);
const saveTargetCid = ref("");

const saveNamePlaceholder = computed(() => {
  const name = inferDefaultName();
  return name || "Enter a name";
});

const LOCAL_NAMES_KEY = "lumen_drive_saved_names";

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

const epubReaderUrl = computed(() => {
  const book = String(contentUrl.value || "").trim();
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
  cid: string;
  rel: string;
  dir: boolean;
  suffix: string;
} {
  const s = String(raw || "").trim();
  if (!s) return { cid: "", rel: "", dir: false, suffix: "" };

  const withoutScheme = /^lumen:\/\//i.test(s) ? s.slice("lumen://".length) : s;
  const afterHost = withoutScheme.replace(/^ipfs\/?/i, "");
  const split = splitPathSuffix(afterHost);
  const hasTrailingSlash = /\/$/.test(split.path);
  const cleaned = split.path.replace(/^\/+/, "").replace(/\/+$/, "");

  const segs = cleaned.split("/").filter(Boolean).map(decodeSafe);
  const cid = segs[0] || "";
  const rel = segs.slice(1).join("/");
  return { cid, rel, dir: hasTrailingSlash, suffix: split.suffix };
}

const displayLumenUrl = computed(() => {
  if (!rootCid.value) return "lumen://ipfs/";
  const p = relPath.value
    ? `/${encodePath(relPath.value)}`
    : wantsDir.value || isDir.value
      ? "/"
      : "";
  return `lumen://ipfs/${rootCid.value}${p}${suffix.value || ""}`;
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
    const isCidV1B32 = /^bafy[a-z0-9]{20,}$/i.test(rootCid.value);
    if (isLocal && isCidV1B32) {
      const port = u.port ? `:${u.port}` : "";
      const proto = u.protocol || "http:";
      const idLower = String(rootCid.value).toLowerCase();
      const siteHost = `${idLower}.ipfs.localhost`;
      return `${proto}//${siteHost}${port}${p || "/"}${suf}`;
    }
  } catch {}

  return `${b}/ipfs/${rootCid.value}${p}${suf}`;
});

async function pickGatewayBaseForCurrentTarget(): Promise<string> {
  const cid = String(rootCid.value || "").trim();
  if (!cid) return localIpfsGatewayBase();

  const relEncoded = relPath.value ? encodePath(relPath.value) : "";
  const suffixStr = String(suffix.value || "");
  const makeUrl = (base: string) => {
    const b = String(base || "").replace(/\/+$/, "");
    if (!b) return "";
    const rel = relEncoded ? `/${relEncoded}` : "";
    return `${b}/ipfs/${cid}${rel}${suffixStr}`;
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

  const publicBases = ["https://ipfs.io", "https://dweb.link", "https://cloudflare-ipfs.com"];
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

function guessViewKind(nameOrPath: string): typeof viewKind.value {
  const s = String(nameOrPath || "").toLowerCase();
  const ext = s.split(".").pop() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return "image";
  if (["mp4", "webm", "mov", "mkv", "avi", "m3u8"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["pdf"].includes(ext)) return "pdf";
  if (["epub"].includes(ext)) return "epub";
  if (["html", "htm"].includes(ext)) return "html";
  if (["txt", "md", "json", "xml", "csv", "log"].includes(ext)) return "text";
  return "unknown";
}

async function sniffViewKindFromHead(
  url: string,
): Promise<typeof viewKind.value> {
  const target = String(url || "").trim();
  if (!target) return "unknown";

  try {
    const anyWin: any = window as any;
    const httpHead = anyWin?.lumen?.httpHead;
    let ct = "";

    // Prefer the Electron http bridge to avoid CORS issues with local gateways.
    if (typeof httpHead === "function") {
      const res = await httpHead(target, { timeout: 8000 }).catch(() => null);
      const headers =
        res && res.headers && typeof res.headers === "object" ? res.headers : {};
      const headerKey = Object.keys(headers).find(
        (k) => String(k || "").toLowerCase() === "content-type",
      );
      ct = headerKey ? String(headers[headerKey] || "") : "";
    } else {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(target, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(t);
      ct = String(res.headers.get("content-type") || "");
    }

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
    if (ct.startsWith("text/")) return "text";
    if (ct.includes("application/json") || ct.includes("application/xml"))
      return "text";
    return "unknown";
  } catch (err) {
    console.warn("[ipfs-page] sniff failed:", err);
    return "unknown";
  }
}

async function detectViaMagicBytes(
  target: string,
): Promise<typeof viewKind.value> {
  try {
    const got = await (window as any).lumen
      ?.ipfsGet?.(target)
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

    // EPUB: ZIP container that contains a `mimetype` entry with content "application/epub+zip".
    // When the `mimetype` entry is stored uncompressed, that string typically appears very early.
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      try {
        const needle = new TextEncoder().encode("application/epub+zip");
        const sample = bytes.subarray(0, Math.min(bytes.length, 2048));
        outer: for (let i = 0; i <= sample.length - needle.length; i++) {
          for (let j = 0; j < needle.length; j++) {
            if (sample[i + j] !== needle[j]) continue outer;
          }
          return "epub";
        }
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
  cid: string;
  relEncoded: string;
  suffix: string;
  baseHref: string;
}): string {
  const cid = String(params.cid || "").trim();
  const relEncoded = String(params.relEncoded || "").replace(/^\/+/, "");
  const suffix = String(params.suffix || "");
  const baseHref = String(params.baseHref || "");

  const lumenPath = `lumen://ipfs/${cid}${relEncoded ? `/${relEncoded}` : ""}`;
  const pseudoPath = `/ipfs/${cid}${relEncoded ? `/${relEncoded}` : ""}`;

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
      const m = u.pathname.match(/\\/ipfs\\/([^\\/]+)(\\/.*)?$/);
      if (!m) return null;
      const nextCid = m[1] || '';
      const rest = m[2] || '';
      return 'lumen://ipfs/' + nextCid + rest + (u.search || '') + (u.hash || '');
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
    navigate?.(next, { push: false });
    return;
  }
  if (d.type === "navigate") {
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

function isHtmlLikePath(pathValue: string): boolean {
  const p = String(pathValue || "").toLowerCase();
  return p.endsWith(".html") || p.endsWith(".htm") || p.endsWith(".xhtml");
}

async function precheckHtmlDocument(url: string): Promise<boolean> {
  const target = String(url || "").trim();
  if (!target) return false;
  try {
    const anyWin: any = window as any;
    const httpHead = anyWin?.lumen?.httpHead;
    let status = 0;
    let ct = "";

    if (typeof httpHead === "function") {
      const res = await httpHead(target, { timeout: 8000 }).catch(() => null);
      status = Number(res?.status || 0);
      const headers =
        res && res.headers && typeof res.headers === "object" ? res.headers : {};
      const headerKey = Object.keys(headers).find(
        (k) => String(k || "").toLowerCase() === "content-type",
      );
      ct = headerKey ? String(headers[headerKey] || "") : "";
    } else {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(target, { method: "HEAD", signal: controller.signal });
      clearTimeout(t);
      status = Number(res.status || 0);
      ct = String(res.headers.get("content-type") || "");
    }

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

  // Auto-convert CIDv0 (Qm...) to CIDv1 base32 (bafy...) so localhost subdomain gateways work.
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(parsed.cid)) {
    const api: any = (window as any).lumen;
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
    rootCid.value === parsed.cid &&
    relPath.value === parsed.rel &&
    isOnlyHashChange(suffix.value, parsed.suffix)
  ) {
    suffix.value = parsed.suffix;
    return;
  }

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
      ? `${rootCid.value}/${relPath.value}`
      : rootCid.value;
    const res = await (window as any).lumen?.ipfsLs?.(target).catch(() => null);
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
          const next = `lumen://ipfs/${rootCid.value}/${encodePath(idx.relPath)}${suffix.value || ""}`;
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
      if (viewKind.value === "text") {
        const gateways = await loadWhitelistedGatewayBases().catch(() => []);
        const got = await (window as any).lumen
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
            textContent.value = new TextDecoder("utf-8", {
              fatal: false,
            }).decode(bytes);
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
        const got = await (window as any).lumen
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
              ? `${localIpfsGatewayBase()}/ipfs/${rootCid.value}/${relEncoded}`
              : `${localIpfsGatewayBase()}/ipfs/${rootCid.value}/`;
            htmlSrcdoc.value = buildIpfsSiteSrcdoc({
              html,
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
  navigate(`lumen://ipfs/${rootCid.value}/${encodePath(entry.relPath)}`);
}

function openMasterHls() {
  const entry = masterM3u8Entry.value;
  if (!entry || !navigate) return;
  navigate(`lumen://ipfs/${rootCid.value}/${encodePath(entry.relPath)}`);
}

function openEntry(it: Entry) {
  if (!navigate) return;
  const dirSuffix = it.type === "dir" ? "/" : "";
  navigate(
    `lumen://ipfs/${rootCid.value}/${encodePath(it.relPath)}${dirSuffix}`,
  );
}

function openDirRoot() {
  if (!navigate) return;
  navigate(`lumen://ipfs/${rootCid.value}/`);
}

function openDirCrumb(idx: number) {
  if (!navigate) return;
  const c = crumbs.value[idx];
  if (!c) return;
  navigate(`lumen://ipfs/${rootCid.value}/${encodePath(c.path)}/`);
}

async function copyText(v: string) {
  try {
    await navigator.clipboard.writeText(v);
  } catch {
    // ignore
  }
}

async function copyLink() {
  await copyText(displayLumenUrl.value);
}

async function copyLinkFor(it: Entry) {
  const dirSuffix = it.type === "dir" ? "/" : "";
  await copyText(
    `lumen://ipfs/${rootCid.value}/${encodePath(it.relPath)}${dirSuffix}`,
  );
}

function setDriveSavedName(cid: string, name: string) {
  const key = String(cid || "").trim();
  const nextName = String(name || "").trim();
  if (!key || !nextName) return;
  try {
    const stored = localStorage.getItem(LOCAL_NAMES_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    const base = parsed && typeof parsed === "object" ? parsed : {};
    const next = { ...base, [key]: nextName };
    localStorage.setItem(LOCAL_NAMES_KEY, JSON.stringify(next));
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

  const res = await (window as any).lumen
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
  if (saving.value) return;
  showSaveModal.value = false;
  savePreparing.value = false;
  saveTargetCid.value = "";
  saveModalError.value = "";
}

async function confirmSaveToDrive() {
  if (!rootCid.value || saving.value) return;
  const name = String(saveNameDraft.value || "").trim();
  if (!name) {
    saveModalError.value = "Please enter a name.";
    return;
  }

  saving.value = true;
  try {
    const cid = saveTargetCid.value || (await resolveSaveTargetCid());
    const ok = await (window as any).lumen?.ipfsPinAdd?.(cid).catch(() => null);
    if (!ok?.ok) throw new Error(String(ok?.error || "save_failed"));
    setDriveSavedName(cid, name);
    savedCid.value = cid;
    saved.value = true;
    showSaveModal.value = false;
  } catch (e: any) {
    error.value = String(e?.message || e);
    saveModalError.value = error.value;
  } finally {
    saving.value = false;
  }
}

async function refreshSavedState() {
  try {
    saved.value = false;
    savedCid.value = "";
    if (!rootCid.value) return;
    const cid = await resolveSaveTargetCid();
    savedCid.value = cid;
    const res = await (window as any).lumen?.ipfsPinList?.().catch(() => null);
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
    const tarUrl = `${base}/ipfs/${rootCid.value}${p}?format=tar`;

    const a = document.createElement("a");
    a.href = tarUrl;
    a.rel = "noopener";
    a.click();
    return;
  }

  const target = rel ? `${rootCid.value}/${rel}` : rootCid.value;
  const gateways = await loadWhitelistedGatewayBases().catch(() => []);
  const got = await (window as any).lumen?.ipfsGet?.(target, { gateways }).catch(() => null);
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
});
onActivated(() => {
  pageActive.value = true;
  attachSiteMsgListener();
  startUrlWatch();
});
onDeactivated(() => {
  pageActive.value = false;
  detachSiteMsgListener();
  stopUrlWatch();
});
onBeforeUnmount(() => {
  pageActive.value = false;
  detachSiteMsgListener();
  stopUrlWatch();
  clearHtmlFrame();
  void ensureHlsStopped();
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

<style scoped>
.ipfs-page {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
}

.ipfs-page--bare {
  background: var(--bg-tertiary);
}

.ipfs-page--bare .main-content {
  padding: 0;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1.25rem;
}

.modal {
  width: min(520px, 100%);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.25);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  color: var(--text-primary);
}

.modal-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.25rem;
  line-height: 1;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}

.modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modal-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-input {
  width: 100%;
  padding: 0.7rem 0.8rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}

.modal-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a15);
}

.modal-error {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: var(--ios-red);
}

.modal-actions {
  padding: 0.9rem 1rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  border-top: 1px solid var(--border-color);
}

.btn-secondary,
.btn-primary {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 0.65rem 0.9rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--hover-bg, var(--bg-secondary));
  color: var(--text-primary);
}

.btn-primary {
  background: var(--gradient-primary);
  border-color: transparent;
  color: white;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow: auto;
}

.content-header {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
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
  font-size: 0.85rem;
  cursor: pointer;
  transition: all var(--transition-smooth);
}

.plans-btn:hover:not(:disabled) {
  background: var(--bg-primary);
  border-color: var(--accent-primary);
}

.plans-btn.save-active {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.38);
  color: var(--ios-green);
}

.plans-btn.save-active:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.16);
  border-color: rgba(34, 197, 94, 0.5);
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
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
}

.error-wrap {
  padding: 1rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid #fecaca;
  background: var(--fill-error);
  color: var(--ios-red);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0;
  flex-wrap: wrap;
}

.crumb {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.85rem;
}

.crumb:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sep {
  color: var(--text-secondary);
}

.dir-table {
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
}

.dir-row {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) 140px 180px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.dir-row:last-child {
  border-bottom: none;
}

.dir-row:hover {
  background: var(--bg-secondary);
}

.dir-name {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  min-width: 0;
}

.ico {
  color: var(--text-secondary);
}

.dir-size {
  text-align: right;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.dir-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-ghost {
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  padding: 0.4rem 0.6rem;
  border-radius: var(--border-radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-ghost:hover {
  background: var(--bg-primary);
  border-color: var(--accent-primary);
}

.empty-dir {
  padding: 1rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
}

.welcome-wrap {
  padding: 3rem 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-content {
  max-width: 600px;
  text-align: center;
}

.welcome-content h2 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.welcome-content > p {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 2rem;
}

.welcome-example {
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.example-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.welcome-example code {
  display: block;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: "Courier New", monospace;
  font-size: 0.875rem;
  color: var(--accent-primary);
  word-break: break-all;
}

.welcome-hint {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.viewer {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  padding: 1rem;
  min-height: 360px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer--bare {
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 0;
  min-height: 0;
  flex: 1 1 auto;
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

.media {
  max-width: 100%;
  max-height: 75vh;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.audio {
  width: 100%;
}

.embed {
  width: 100%;
  height: 75vh;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.embed--bare {
  height: 100%;
  border: none;
  border-radius: 0;
}

.text {
  width: 100%;
  max-height: 75vh;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.unsupported {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.unsupported-content {
  text-align: center;
  max-width: 500px;
  padding: 2rem;
}

.unsupported-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.unsupported-content > p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.unsupported-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.btn-download,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-download {
  background: var(--gradient-primary);
  color: white;
  border: none;
  box-shadow: var(--shadow-primary);
}

.btn-download:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-a30);
}

.btn-secondary {
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-primary);
  border-color: var(--accent-primary);
}

.unsupported-hint {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  text-align: left;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-md);
  padding: 1rem;
  font-family: "Courier New", monospace;
  word-break: break-all;
}
</style>
