<template>
  <div class="ipfs-page">
    <main class="main-content">
      <header class="content-header">
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
            class="plans-btn"
            type="button"
            @click="saveToDrive"
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
        <span class="txt-xs color-gray-blue">Loading...</span>
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

        <div v-else class="viewer">
          <img
            v-if="viewKind === 'image'"
            :src="contentUrl"
            class="media img"
            alt=""
            @error="onMediaError"
          />

          <video
            v-else-if="viewKind === 'video'"
            :src="contentUrl"
            class="media"
            controls
            playsinline
          ></video>

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
            partition="persist:lumen"
            :webpreferences="webprefs"
            @will-navigate="onWebviewWillNavigate"
            @did-navigate="onWebviewDidNavigate"
            @did-navigate-in-page="onWebviewDidNavigateInPage"
            @new-window="onWebviewNewWindow"
          ></webview>

          <iframe
            v-else-if="viewKind === 'pdf'"
            :src="contentUrl"
            class="embed"
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
import { Check, Copy, Download, File, Folder, Save } from "lucide-vue-next";
import UiSpinner from "../../ui/UiSpinner.vue";
import {
  LOCAL_IPFS_GATEWAY_BASE,
  loadWhitelistedGatewayBases,
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
  "image" | "video" | "audio" | "html" | "pdf" | "text" | "unknown"
>("unknown");
const textContent = ref("");
const mediaErrored = ref(false);
const htmlSrcdoc = ref("");
const htmlFrameUrl = ref("");
const siteFrame = ref<HTMLIFrameElement | null>(null);
const siteWebview = ref<any>(null);
const webprefs =
  "contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no";
const pageActive = ref(false);

const rootCid = ref("");
const relPath = ref("");
const wantsDir = ref(false);
const suffix = ref("");
const saving = ref(false);
const saved = ref(false);
const savedCid = ref("");

const LOCAL_NAMES_KEY = "lumen_drive_saved_names";

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
  return `${LOCAL_IPFS_GATEWAY_BASE}/ipfs/${rootCid.value}${p}${suffix.value || ""}`;
});

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

const canDownload = computed(
  () => !!rootCid.value && !isDir.value && !loading.value,
);

function guessViewKind(nameOrPath: string): typeof viewKind.value {
  const s = String(nameOrPath || "").toLowerCase();
  const ext = s.split(".").pop() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return "image";
  if (["mp4", "webm", "mov", "mkv", "avi"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["pdf"].includes(ext)) return "pdf";
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
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(target, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return "unknown";

    const ct = String(res.headers.get("content-type") || "").toLowerCase();
    console.log("[ipfs-page] sniffed content-type:", ct, "for", url);
    if (!ct) return "unknown";
    if (ct.startsWith("image/")) return "image";
    if (ct.startsWith("video/")) return "video";
    if (ct.startsWith("audio/")) return "audio";
    if (ct.includes("text/html")) return "html";
    if (ct.includes("application/pdf")) return "pdf";
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
  } catch (err) {
    console.warn("[ipfs-page] magic bytes detection failed:", err);
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
  try {
    const u = new URL(href);
    const pathname = String(u.pathname || "");
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
}

async function load() {
  const url = String(currentTabUrl?.value || window.location.href || "");
  const parsed = parseIpfsUrl(url);
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
  textContent.value = "";
  mediaErrored.value = false;
  htmlSrcdoc.value = "";
  clearHtmlFrame();
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

    if (!isDir.value) {
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
          if (bytes.byteLength > 2_000_000) {
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
              ? `${LOCAL_IPFS_GATEWAY_BASE}/ipfs/${rootCid.value}/${relEncoded}`
              : `${LOCAL_IPFS_GATEWAY_BASE}/ipfs/${rootCid.value}/`;
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

async function saveToDrive() {
  if (!rootCid.value || saving.value) return;
  saving.value = true;
  try {
    const cid = await resolveCurrentItemCid();
    const ok = await (window as any).lumen?.ipfsPinAdd?.(cid).catch(() => null);
    if (!ok?.ok) throw new Error(String(ok?.error || "save_failed"));
    const name = inferDefaultName();
    if (name) setDriveSavedName(cid, name);
    savedCid.value = cid;
    saved.value = true;
  } catch (e: any) {
    error.value = String(e?.message || e);
  } finally {
    saving.value = false;
  }
}

async function refreshSavedState() {
  try {
    saved.value = false;
    savedCid.value = "";
    if (!rootCid.value) return;
    const cid = await resolveCurrentItemCid();
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
  const target = relPath.value
    ? `${rootCid.value}/${relPath.value}`
    : rootCid.value;
  const gateways = await loadWhitelistedGatewayBases().catch(() => []);
  const got = await (window as any).lumen
    ?.ipfsGet?.(target, { gateways })
    .catch(() => null);
  if (!got?.ok || !Array.isArray(got.data)) return;
  const bytes = new Uint8Array(got.data);
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = relPath.value
    ? relPath.value.split("/").pop() || rootCid.value
    : rootCid.value;
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function onMediaError() {
  mediaErrored.value = true;
  viewKind.value = "unknown";
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
});

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
</script>

<style scoped>
.ipfs-page {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
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
  display: flex;
  align-items: center;
  justify-content: center;
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
