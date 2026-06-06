<template>
  <div class="catalog-page internal-page">
    <InternalSidebar title="Catalog" :icon="TableProperties" activeKey="create-catalog">
      <div class="sidebar-panel">
        <label class="sidebar-label" for="catalog-name">Catalog name</label>
        <input
          id="catalog-name"
          v-model="catalogName"
          class="sidebar-input"
          type="text"
          placeholder="My catalog"
        />
      </div>

      <div class="sidebar-panel">
        <div class="sidebar-row">
          <span class="sidebar-label">Preset</span>
          <span class="pill">Generic Lumen</span>
        </div>
        <button class="sidebar-action" type="button" @click="applyGenericPreset">
          <RefreshCw :size="14" />
          <span>Reset columns</span>
        </button>
      </div>

      <div class="sidebar-panel">
        <div class="sidebar-row">
          <span class="sidebar-label">Column</span>
          <span class="sidebar-count">{{ metadataColumns.length }}</span>
        </div>
        <input
          v-model="newColumnLabel"
          class="sidebar-input"
          type="text"
          placeholder="metadata_key"
          @keydown.enter.prevent="addColumn"
        />
        <select v-model="newColumnType" class="sidebar-input">
          <option value="text">Text</option>
          <option value="tags">Tags</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="date">Date</option>
          <option value="json">JSON</option>
        </select>
        <button class="sidebar-action primary" type="button" @click="addColumn">
          <Plus :size="14" />
          <span>Add column</span>
        </button>
      </div>

      <div class="sidebar-panel stats-panel">
        <div>
          <span class="stat-value">{{ rows.length }}</span>
          <span class="stat-label">entries</span>
        </div>
        <div>
          <span class="stat-value">{{ uniqueCidCount }}</span>
          <span class="stat-label">unique CIDs</span>
        </div>
      </div>
    </InternalSidebar>

    <main class="main-content">
      <header class="content-header">
        <div>
          <h1>Create catalog</h1>
          <p>Content references stay immutable; metadata stays local and editable.</p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" type="button" @click="openCatalogImport">
            <FileInput :size="16" />
            <span>Import JSON</span>
          </button>
          <button class="btn-secondary" type="button" @click="newCatalog">
            <FilePlus2 :size="16" />
            <span>New</span>
          </button>
          <button class="btn-primary" type="button" :disabled="!rows.length" @click="exportCatalog">
            <Download :size="16" />
            <span>Export JSON</span>
          </button>
        </div>
      </header>

      <input
        ref="folderInput"
        class="hidden-input"
        type="file"
        multiple
        webkitdirectory
        directory
        @change="handleFolderInput"
      />
      <input
        ref="catalogInput"
        class="hidden-input"
        type="file"
        accept="application/json,.json"
        @change="handleCatalogInput"
      />

      <section
        class="drop-zone"
        :class="{ active: dragActive, compact: rows.length > 0 }"
        @dragenter.prevent="dragActive = true"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <div class="drop-copy">
          <div class="drop-icon">
            <FolderUp :size="22" />
          </div>
          <div>
            <strong>{{ rows.length ? "Add a folder" : "Select or drop a folder" }}</strong>
            <span>{{ uploadStatusText }}</span>
          </div>
        </div>
        <button class="btn-primary" type="button" :disabled="uploading" @click="openFolderPicker">
          <UploadCloud :size="16" />
          <span>{{ uploading ? "Importing..." : "Choose folder" }}</span>
        </button>
      </section>

      <div v-if="uploading" class="progress-card">
        <div class="progress-row">
          <UiSpinner size="sm" />
          <span>{{ uploadStatusText }}</span>
          <strong v-if="uploadPercent != null">{{ uploadPercent }}%</strong>
        </div>
        <div v-if="uploadPercent != null" class="progress-bar">
          <div class="progress-fill" :style="{ width: `${uploadPercent}%` }"></div>
        </div>
      </div>

      <section class="toolbar">
        <div class="search-box">
          <Search :size="15" />
          <input v-model="searchQuery" type="text" placeholder="Search catalog..." />
        </div>
        <div class="toolbar-status">
          <span>{{ filteredRows.length }} shown</span>
          <span>{{ columns.length }} columns</span>
        </div>
      </section>

      <section v-if="rows.length" class="table-shell">
        <table class="catalog-table">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key" :class="{ core: isCoreColumn(column.key) }">
                <div class="column-head">
                  <input
                    v-if="!isCoreColumn(column.key)"
                    :value="column.label"
                    class="column-name"
                    type="text"
                    @change="renameColumn(column, ($event.target as HTMLInputElement).value)"
                  />
                  <span v-else class="column-title">{{ column.label }}</span>
                  <div v-if="!isCoreColumn(column.key)" class="column-tools">
                    <select
                      :value="column.type"
                      class="column-type"
                      @change="setColumnType(column.key, ($event.target as HTMLSelectElement).value as ColumnType)"
                    >
                      <option value="text">Text</option>
                      <option value="tags">Tags</option>
                      <option value="number">Number</option>
                      <option value="boolean">Bool</option>
                      <option value="date">Date</option>
                      <option value="json">JSON</option>
                    </select>
                    <button class="icon-btn" type="button" title="Delete column" @click="deleteColumn(column.key)">
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </div>
              </th>
              <th class="row-actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.id">
              <td v-for="column in columns" :key="`${row.id}-${column.key}`" :class="{ mono: column.key === 'cid' }">
                <input
                  v-if="column.type !== 'boolean'"
                  class="cell-input"
                  :class="{ mono: column.key === 'cid' }"
                  :type="column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'"
                  :value="displayCell(row, column)"
                  @input="updateCell(row, column, ($event.target as HTMLInputElement).value)"
                />
                <label v-else class="cell-check">
                  <input
                    type="checkbox"
                    :checked="Boolean(readCell(row, column.key))"
                    @change="updateCell(row, column, ($event.target as HTMLInputElement).checked)"
                  />
                  <span></span>
                </label>
              </td>
              <td class="row-actions">
                <button class="icon-btn" type="button" title="Remove entry" @click="removeRow(row.id)">
                  <X :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-else class="empty-state">
        <TableProperties :size="48" stroke-width="1.4" />
        <h3>No catalog entries yet</h3>
        <p>Import a folder to create one row per file, or import an existing catalog JSON.</p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  Download,
  FileInput,
  FilePlus2,
  FolderUp,
  Plus,
  RefreshCw,
  Search,
  TableProperties,
  Trash2,
  UploadCloud,
  X,
} from "lucide-vue-next";
import InternalSidebar from "../../components/InternalSidebar.vue";
import UiSpinner from "../../ui/UiSpinner.vue";
import { useToast } from "../../composables/useToast";

type ColumnType = "text" | "number" | "boolean" | "tags" | "date" | "json";

type CatalogColumn = {
  key: string;
  label: string;
  type: ColumnType;
};

type CatalogEntry = {
  id: string;
  cid: string;
  filename: string;
  path: string;
  size: number;
  type: string;
  rootCid?: string;
  rootName?: string;
  meta: Record<string, any>;
};

type PickedFile = {
  path: string;
  file: File;
};

const CORE_COLUMNS: CatalogColumn[] = [
  { key: "cid", label: "CID", type: "text" },
  { key: "filename", label: "Filename", type: "text" },
  { key: "path", label: "Path", type: "text" },
  { key: "size", label: "Size", type: "number" },
  { key: "type", label: "Type", type: "text" },
];

const GENERIC_METADATA_COLUMNS: CatalogColumn[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "description", label: "Description", type: "text" },
  { key: "tags", label: "Tags", type: "tags" },
  { key: "createdAt", label: "Created At", type: "date" },
];

const { success, error, warning } = useToast();

const catalogName = ref("Untitled catalog");
const columns = ref<CatalogColumn[]>([...CORE_COLUMNS, ...GENERIC_METADATA_COLUMNS]);
const rows = ref<CatalogEntry[]>([]);
const folderInput = ref<HTMLInputElement | null>(null);
const catalogInput = ref<HTMLInputElement | null>(null);
const newColumnLabel = ref("");
const newColumnType = ref<ColumnType>("text");
const searchQuery = ref("");
const dragActive = ref(false);
const uploading = ref(false);
const uploadStage = ref<"idle" | "checking" | "adding" | "merging">("idle");
const uploadPercent = ref<number | null>(null);

let progressUnsub: (() => void) | null = null;

const metadataColumns = computed(() => columns.value.filter((c) => !isCoreColumn(c.key)));
const uniqueCidCount = computed(() => new Set(rows.value.map((r) => r.cid).filter(Boolean)).size);

const filteredRows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((row) => {
    const haystack = [
      row.cid,
      row.filename,
      row.path,
      row.type,
      JSON.stringify(row.meta || {}),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
});

const uploadStatusText = computed(() => {
  if (uploadStage.value === "checking") return "Checking local IPFS...";
  if (uploadStage.value === "adding") return "Adding folder to IPFS (streaming from disk)...";
  if (uploadStage.value === "merging") return "Merging entries by CID...";
  if (rows.value.length) return "Merge keeps existing metadata when possible.";
  return "Generic Lumen columns are ready and editable.";
});

onMounted(() => {
  const api: any = (window as any).lumen;
  if (typeof api?.ipfsOnAddProgress === "function") {
    progressUnsub = api.ipfsOnAddProgress((payload: any) => {
      if (!uploading.value) return;
      uploadStage.value = "adding";
      const pct = Number(payload?.percent);
      uploadPercent.value = Number.isFinite(pct)
        ? Math.max(0, Math.min(100, Math.round(pct)))
        : null;
    });
  }
});

onBeforeUnmount(() => {
  progressUnsub?.();
  progressUnsub = null;
});

function isCoreColumn(key: string) {
  return CORE_COLUMNS.some((c) => c.key === key);
}

function applyGenericPreset() {
  const existingMetaKeys = new Set(rows.value.flatMap((row) => Object.keys(row.meta || {})));
  const genericKeys = new Set(GENERIC_METADATA_COLUMNS.map((c) => c.key));
  const extra = Array.from(existingMetaKeys)
    .filter((key) => !genericKeys.has(key))
    .map((key) => inferColumnFromKey(key));
  columns.value = [...CORE_COLUMNS, ...GENERIC_METADATA_COLUMNS, ...extra];
  success("Generic Lumen preset applied.");
}

function addColumn() {
  const label = newColumnLabel.value.trim();
  if (!label) return;
  const key = makeUniqueKey(makeColumnKey(label));
  columns.value.push({ key, label, type: newColumnType.value });
  for (const row of rows.value) {
    if (!(key in row.meta)) row.meta[key] = defaultValueForType(newColumnType.value);
  }
  newColumnLabel.value = "";
}

function renameColumn(column: CatalogColumn, rawLabel: string) {
  const label = String(rawLabel || "").trim();
  if (!label || isCoreColumn(column.key)) return;
  const oldKey = column.key;
  const nextKey = makeUniqueKey(makeColumnKey(label), oldKey);
  column.label = label;
  if (nextKey === oldKey) return;
  column.key = nextKey;
  for (const row of rows.value) {
    if (oldKey in row.meta) {
      row.meta[nextKey] = row.meta[oldKey];
      delete row.meta[oldKey];
    }
  }
}

function setColumnType(key: string, type: ColumnType) {
  const column = columns.value.find((c) => c.key === key);
  if (!column || isCoreColumn(key)) return;
  column.type = type;
}

function deleteColumn(key: string) {
  if (isCoreColumn(key)) return;
  columns.value = columns.value.filter((c) => c.key !== key);
  for (const row of rows.value) {
    delete row.meta[key];
  }
}

function newCatalog() {
  rows.value = [];
  catalogName.value = "Untitled catalog";
  columns.value = [...CORE_COLUMNS, ...GENERIC_METADATA_COLUMNS];
  searchQuery.value = "";
}

function openFolderPicker() {
  if (uploading.value) return;
  try {
    if (folderInput.value) folderInput.value.value = "";
  } catch {}
  folderInput.value?.click();
}

function openCatalogImport() {
  try {
    if (catalogInput.value) catalogInput.value.value = "";
  } catch {}
  catalogInput.value?.click();
}

async function handleFolderInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = Array.from(input.files || []);
  try {
    input.value = "";
  } catch {}
  if (!selected.length) return;

  console.log(
    "[CreateCatalog] handleFolderInput selected",
    selected.length,
    JSON.stringify(
      selected.slice(0, 10).map((file) => ({
        name: file.name,
        webkitRelativePath: String((file as any).webkitRelativePath || ""),
        path: String((file as any).path || ""),
        size: file.size,
      })),
      null,
      2,
    ),
  );

  const picked = selected.map((file) => ({
    file,
    path: normalizePath(String((file as any).webkitRelativePath || file.name)),
  }));
  await importPickedFiles(picked);
}

async function handleDrop(event: DragEvent) {
  dragActive.value = false;
  const picked = await pickedFilesFromDrop(event);
  if (!picked.length) {
    warning("No files found in this drop.");
    return;
  }
  await importPickedFiles(picked);
}

function handleDragLeave(event: DragEvent) {
  const target = event.currentTarget as HTMLElement;
  const related = event.relatedTarget as Node | null;
  if (related && target.contains(related)) return;
  dragActive.value = false;
}

async function importPickedFiles(picked: PickedFile[]) {
  if (uploading.value) return;
  const groups = groupPickedFiles(picked);
  if (!groups.size) return;

  const ok = await ensureIpfsConnected();
  if (!ok) return;

  uploading.value = true;
  uploadStage.value = "adding";
  uploadPercent.value = 0;

  try {
    for (const [rootName, files] of groups.entries()) {
      const fileList = files.map((f) => ({ file: f.file, path: f.path }));
      const result = await uploadCatalogDirectory(rootName, fileList);
      if (!result.ok || !result.cid) {
        continue;
      }
      const rootCid = String(result.cid);

      // Build catalog rows from the uploaded directory
      const importedRows = files.map((item) => {
        const uploadPath = normalizePath(item.path);
        const catalogPath = stripRootPath(uploadPath, rootName);
        const filename = basename(catalogPath) || basename(uploadPath) || item.file.name || "file";
        const inferredType = item.file.type || inferMimeType(filename);
        return {
          id: makeEntryId(rootCid, catalogPath),
          cid: rootCid,
          filename,
          path: catalogPath,
          size: Number(item.file.size || 0),
          type: inferredType,
          rootCid: rootCid || undefined,
          rootName: rootName || undefined,
          meta: {
            title: stripExtension(filename),
            description: "",
            tags: [],
            createdAt: new Date().toISOString().slice(0, 10),
          },
        } satisfies CatalogEntry;
      });

      const stats = mergeEntries(importedRows, []);
      success(`Imported ${stats.added} entries from ${rootName}.`);
    }
  } finally {
    uploading.value = false;
    uploadStage.value = "idle";
    uploadPercent.value = null;
  }
}

function ensureIpfsConnected(): Promise<boolean> {
  const api: any = (window as any).lumen;
  if (typeof api?.ipfsStatus !== "function") {
    error("IPFS API unavailable.");
    return Promise.resolve(false);
  }
  return api.ipfsStatus()
    .then((result: any) => {
      if (result?.ok === true) return true;
      error("Local IPFS is offline.");
      return false;
    })
    .catch((e: any) => {
      error("IPFS status check failed.");
      return false;
    });
}

async function uploadCatalogDirectory(
  rootName: string,
  list: { path: string; file: File }[],
): Promise<{ ok: true; cid: string } | { ok: false }> {
  const name = String(rootName || "").trim() || "folder";
  if (!list.length) return { ok: false };

  const estimatedBytes = list.reduce(
    (acc, it) => acc + (Number(it?.file?.size || 0) || 0),
    0,
  );
  const maxSize = 5 * 1024 * 1024 * 1024; // 5GB limit for catalog
  if (estimatedBytes > maxSize) {
    error(`Folder too large (${(estimatedBytes / 1024 / 1024 / 1024).toFixed(1)}GB). Limit is 5GB.`);
    return { ok: false };
  }

  uploading.value = true;
  uploadStage.value = "preparing";
  uploadPercent.value = 0;

  try {
    const api: any = (window as any).lumen;

    const pathFiles = list.map((it) => {
      const rel = String(it.path || it.file?.name || "file")
        .replace(/^\/+/, "")
        .replace(/\\/g, "/");
      const fp = String((it.file as any)?.path || "").trim();
      return { path: rel, filePath: fp };
    });
    const hasAllPaths = pathFiles.every((f) => !!String(f.filePath || "").trim());
    const addDirPathsFn =
      hasAllPaths && typeof api?.ipfsAddDirectoryPathsWithProgress === "function"
        ? api.ipfsAddDirectoryPathsWithProgress
        : hasAllPaths && typeof api?.ipfsAddDirectoryPaths === "function"
          ? api.ipfsAddDirectoryPaths
          : null;

    const addDirBytesFn =
      typeof api?.ipfsAddDirectoryWithProgress === "function"
        ? api.ipfsAddDirectoryWithProgress
        : typeof api?.ipfsAddDirectory === "function"
          ? api.ipfsAddDirectory
          : null;

    if (!addDirPathsFn && !addDirBytesFn) {
      error("Upload unavailable");
      return { ok: false };
    }

    uploadStage.value = "adding";
    uploadPercent.value = 0;

    let result: any = null;

    if (addDirPathsFn) {
      result = await addDirPathsFn({
        rootName: name,
        files: pathFiles,
      });
    } else {
      const payloadFiles: { path: string; data: Uint8Array }[] = [];
      for (const it of list) {
        const rel = String(it.path || it.file?.name || "file")
          .replace(/^\/+/, "")
          .replace(/\\/g, "/");
        const buf = await it.file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        payloadFiles.push({ path: rel, data: bytes });
      }
      result = await addDirBytesFn?.({
        rootName: name,
        files: payloadFiles,
      });
    }

    if (!result?.ok || !result?.cid) {
      const err = String(result?.error || "");
      if (err.toLowerCase().includes("cancel")) {
        warning("Upload cancelled.");
        return { ok: false };
      }
      error(`Failed to upload folder: ${name}`);
      return { ok: false };
    }

    const cid = String(result.cid);
    success(`Imported folder: ${name}`);
    return { ok: true, cid };
  } catch (err) {
    console.error("Folder upload error:", err);
    error(`Error uploading folder: ${name}`);
    return { ok: false };
  } finally {
    uploading.value = false;
    uploadStage.value = "idle";
    uploadPercent.value = null;
  }
}



async function handleCatalogInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  try {
    input.value = "";
  } catch {}
  if (!file) return;

  try {
    const raw = JSON.parse(await file.text());
    const parsed = normalizeCatalog(raw);
    if (!parsed.entries.length) {
      warning("Catalog JSON has no entries.");
      return;
    }
    if (!rows.value.length && parsed.name) catalogName.value = parsed.name;
    const stats = mergeEntries(parsed.entries, parsed.columns);
    success(`Merged ${stats.added} new entries and updated ${stats.updated}.`);
  } catch (e: any) {
    error(`Invalid catalog JSON: ${String(e?.message || e)}`);
  }
}

function exportCatalog() {
  const now = new Date().toISOString();
  const payload = {
    type: "lumen.catalog",
    version: 1,
    name: catalogName.value.trim() || "Untitled catalog",
    preset: "Generic Lumen",
    updatedAt: now,
    columns: columns.value.map((column) => ({
      key: column.key,
      label: column.label,
      type: column.type,
      system: isCoreColumn(column.key),
    })),
    entries: rows.value.map((row) => ({
      cid: row.cid,
      filename: row.filename,
      path: stripRootPath(String(row.path || ""), String(row.rootName || "")),
      size: row.size,
      type: row.type,
      ...(row.rootCid ? { rootCid: row.rootCid } : {}),
      ...(row.rootName ? { rootName: row.rootName } : {}),
      meta: cleanMeta(row.meta),
    })),
  };

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${makeColumnKey(payload.name) || "lumen-catalog"}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeCatalog(raw: any): { name: string; columns: CatalogColumn[]; entries: CatalogEntry[] } {
  const sourceColumns = normalizeColumns(raw?.columns, raw?.schema);
  const seenMetaKeys = new Set(sourceColumns.map((c) => c.key).filter((key) => !isCoreColumn(key)));
  const entries = Array.isArray(raw?.entries)
    ? raw.entries.map((entry: any) => normalizeCatalogEntry(entry, seenMetaKeys)).filter(Boolean)
    : [];
  const extraColumns = Array.from(seenMetaKeys).map((key) => sourceColumns.find((c) => c.key === key) || inferColumnFromKey(key));
  return {
    name: String(raw?.name || "").trim(),
    columns: mergeColumnDefs([...CORE_COLUMNS, ...extraColumns]),
    entries: entries as CatalogEntry[],
  };
}

function normalizeCatalogEntry(entry: any, seenMetaKeys: Set<string>): CatalogEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const content = entry.content && typeof entry.content === "object" ? entry.content : entry;
  const cid = String(content.cid || entry.cid || "").trim();
  if (!cid) return null;

  const known = new Set(["id", "cid", "filename", "name", "path", "size", "type", "mime", "rootCid", "rootName", "content", "meta"]);
  const meta: Record<string, any> = entry.meta && typeof entry.meta === "object" && !Array.isArray(entry.meta)
    ? { ...entry.meta }
    : {};
  for (const [key, value] of Object.entries(entry)) {
    if (!known.has(key)) meta[key] = value;
  }
  for (const key of Object.keys(meta)) seenMetaKeys.add(key);

  const filename = String(content.filename || content.name || basename(content.path) || "file");
  const rawPath = normalizePath(String(content.path || filename));
  const path = stripRootPath(rawPath, String(content.rootName || ""));
  return {
    id: makeEntryId(cid, path),
    cid,
    filename,
    path,
    size: Number(content.size || 0),
    type: String(content.type || content.mime || inferMimeType(filename)),
    rootCid: content.rootCid ? String(content.rootCid) : undefined,
    rootName: content.rootName ? String(content.rootName) : undefined,
    meta,
  };
}

function normalizeColumns(source: any, schema: any): CatalogColumn[] {
  const out: CatalogColumn[] = [];
  if (Array.isArray(source)) {
    for (const item of source) {
      if (typeof item === "string") out.push(inferColumnFromKey(item));
      else if (item && typeof item === "object") {
        const key = makeColumnKey(String(item.key || item.id || item.name || item.label || ""));
        if (key) {
          out.push({
            key,
            label: String(item.label || item.name || item.id || item.key || key),
            type: normalizeColumnType(item.type),
          });
        }
      }
    }
  }
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    for (const [key, value] of Object.entries(schema)) {
      out.push({ ...inferColumnFromKey(key), type: normalizeColumnType(value) });
    }
  }
  return mergeColumnDefs([...CORE_COLUMNS, ...GENERIC_METADATA_COLUMNS, ...out]);
}

function mergeEntries(incoming: CatalogEntry[], incomingColumns: CatalogColumn[]) {
  columns.value = mergeColumnDefs([...columns.value, ...incomingColumns, ...collectColumnsFromRows(incoming)]);
  const byCid = new Map(rows.value.map((row) => [row.cid, row]));
  let added = 0;
  let updated = 0;

  for (const next of incoming) {
    const current = byCid.get(next.cid);
    if (!current) {
      rows.value.push(next);
      byCid.set(next.cid, next);
      added += 1;
      continue;
    }

    let touched = false;
    for (const key of ["filename", "path", "type"] as const) {
      if (!String(current[key] || "").trim() && String(next[key] || "").trim()) {
        (current as any)[key] = next[key];
        touched = true;
      }
    }
    if (!Number(current.size || 0) && Number(next.size || 0)) {
      current.size = next.size;
      touched = true;
    }
    if (!current.rootCid && next.rootCid) {
      current.rootCid = next.rootCid;
      touched = true;
    }
    if (!current.rootName && next.rootName) {
      current.rootName = next.rootName;
      touched = true;
    }
    for (const [key, value] of Object.entries(next.meta || {})) {
      if (isEmptyValue(current.meta?.[key])) {
        current.meta[key] = cloneValue(value);
        touched = true;
      }
    }
    if (touched) updated += 1;
  }
  return { added, updated };
}

function collectColumnsFromRows(sourceRows: CatalogEntry[]) {
  const keys = new Set<string>();
  for (const row of sourceRows) {
    for (const key of Object.keys(row.meta || {})) keys.add(key);
  }
  return Array.from(keys).map((key) => inferColumnFromKey(key));
}

function mergeColumnDefs(source: CatalogColumn[]) {
  const out: CatalogColumn[] = [];
  const seen = new Set<string>();
  for (const column of source) {
    const key = makeColumnKey(column.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: column.label || key, type: normalizeColumnType(column.type) });
  }
  return out;
}

function readCell(row: CatalogEntry, key: string) {
  if (isCoreColumn(key)) return (row as any)[key];
  return row.meta?.[key];
}

function displayCell(row: CatalogEntry, column: CatalogColumn) {
  const value = readCell(row, column.key);
  if (column.type === "tags") return Array.isArray(value) ? value.join(", ") : String(value || "");
  if (column.type === "json") {
    if (value == null || value === "") return "";
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value == null ? "" : String(value);
}

function updateCell(row: CatalogEntry, column: CatalogColumn, rawValue: string | boolean) {
  const value = normalizeCellValue(rawValue, column.type);
  if (isCoreColumn(column.key)) {
    (row as any)[column.key] = column.key === "size" ? Number(value || 0) : value;
    if (column.key === "cid") row.id = makeEntryId(String(value || ""), row.path);
    return;
  }
  row.meta[column.key] = value;
}

function removeRow(id: string) {
  rows.value = rows.value.filter((row) => row.id !== id);
}

function normalizeCellValue(value: string | boolean, type: ColumnType) {
  if (type === "boolean") return Boolean(value);
  const asString = String(value ?? "");
  if (type === "number") return asString === "" ? "" : Number(asString);
  if (type === "tags") {
    return asString
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (type === "json") {
    try {
      return asString.trim() ? JSON.parse(asString) : "";
    } catch {
      return asString;
    }
  }
  return asString;
}

async function pickedFilesFromDrop(event: DragEvent): Promise<PickedFile[]> {
  const files = Array.from(event.dataTransfer?.files || []);
  const hasFilePaths = files.some((file: any) => String((file as any)?.path || "").trim());
  const hasRelativePaths = files.some((file: any) => String((file as any)?.webkitRelativePath || "").trim());

  if (files.length && (hasFilePaths || hasRelativePaths)) {
    return files.map((file) => ({
      file,
      path: normalizePath(String((file as any).webkitRelativePath || file.name)),
    }));
  }

  const items = Array.from(event.dataTransfer?.items || []);
  const entries = items
    .map((item: any) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
    .filter(Boolean);
  if (entries.length) {
    const all = await Promise.all(entries.map((entry) => readDroppedEntry(entry, "")));
    return all.flat();
  }

  return files.map((file) => ({
    file,
    path: normalizePath(String((file as any).webkitRelativePath || file.name)),
  }));
}

async function readDroppedEntry(entry: any, prefix: string): Promise<PickedFile[]> {
  if (entry?.isFile) {
    const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
    return [{ file, path: normalizePath(`${prefix}${file.name}`) }];
  }
  if (!entry?.isDirectory) return [];
  const dirPrefix = `${prefix}${entry.name}/`;
  const children = await readAllDirectoryEntries(entry);
  const nested = await Promise.all(children.map((child: any) => readDroppedEntry(child, dirPrefix)));
  return nested.flat();
}

async function readAllDirectoryEntries(directoryEntry: any): Promise<any[]> {
  const reader = directoryEntry.createReader();
  const output: any[] = [];
  while (true) {
    const chunk = await new Promise<any[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!chunk.length) break;
    output.push(...chunk);
  }
  return output;
}

function groupPickedFiles(picked: PickedFile[]) {
  const groups = new Map<string, PickedFile[]>();
  for (const item of picked) {
    const path = normalizePath(item.path || item.file.name);
    const root = path.split("/").filter(Boolean)[0] || "catalog";
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push({ ...item, path });
  }
  return groups;
}

function makeColumnKey(input: string) {
  return String(input || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function makeUniqueKey(base: string, currentKey = "") {
  const clean = base || "field";
  const used = new Set(columns.value.map((c) => c.key).filter((key) => key !== currentKey));
  if (!used.has(clean)) return clean;
  let index = 2;
  while (used.has(`${clean}_${index}`)) index += 1;
  return `${clean}_${index}`;
}

function inferColumnFromKey(key: string): CatalogColumn {
  const clean = makeColumnKey(key);
  return {
    key: clean,
    label: clean
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Field",
    type: clean === "tags" ? "tags" : clean.toLowerCase().includes("date") ? "date" : "text",
  };
}

function normalizeColumnType(input: any): ColumnType {
  const value = String(input || "").toLowerCase();
  if (["number", "boolean", "tags", "date", "json"].includes(value)) return value as ColumnType;
  if (value === "array") return "tags";
  return "text";
}

function defaultValueForType(type: ColumnType) {
  if (type === "tags") return [];
  if (type === "boolean") return false;
  return "";
}

function isEmptyValue(value: any) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

function cloneValue(value: any) {
  if (value == null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

function cleanMeta(meta: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(meta || {})) {
    if (!isEmptyValue(value)) out[key] = value;
  }
  return out;
}

function normalizePath(path: string) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function stripRootPath(path: string, rootName: string) {
  const cleanPath = normalizePath(path);
  const cleanRoot = normalizePath(rootName);
  if (!cleanRoot) return cleanPath;
  if (cleanPath === cleanRoot) return "";
  const prefix = `${cleanRoot}/`;
  return cleanPath.startsWith(prefix) ? cleanPath.slice(prefix.length) : cleanPath;
}

function basename(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function stripExtension(filename: string) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

function makeEntryId(cid: string, path: string) {
  return `${cid || "entry"}:${path || "path"}`;
}

function inferMimeType(filename: string) {
  const ext = String(filename || "").split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    flac: "audio/flac",
    pdf: "application/pdf",
    json: "application/json",
    txt: "text/plain",
    csv: "text/csv",
    epub: "application/epub+zip",
  };
  return map[ext] || "application/octet-stream";
}
</script>

<style scoped>
.catalog-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--bg-secondary);
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.25rem 1.5rem;
  overflow: hidden;
  background: var(--bg-secondary);
}

.content-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.content-header h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0;
}

.content-header p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.header-actions,
.toolbar,
.drop-zone,
.drop-copy,
.sidebar-row,
.progress-row,
.column-head,
.column-tools {
  display: flex;
  align-items: center;
}

.header-actions {
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary,
.sidebar-action,
.icon-btn {
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text-primary);
}

.btn-primary,
.btn-secondary,
.sidebar-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 36px;
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
}

.btn-primary,
.sidebar-action.primary {
  background: var(--gradient-primary);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 12px var(--primary-a20);
}

.btn-secondary,
.sidebar-action {
  background: var(--bg-primary);
}

.btn-primary:hover:not(:disabled),
.sidebar-action.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px var(--primary-a30);
}

.btn-secondary:hover,
.sidebar-action:hover {
  background: var(--hover-bg);
  border-color: var(--primary-a30);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 0.5px solid var(--border-light);
  background: var(--fill-tertiary);
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.sidebar-row {
  justify-content: space-between;
  gap: 0.5rem;
}

.sidebar-label,
.stat-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sidebar-input {
  width: 100%;
  min-height: 34px;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.82rem;
}

.sidebar-input:focus,
.cell-input:focus,
.column-name:focus,
.search-box input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a15);
}

.pill,
.sidebar-count {
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  background: var(--primary-a08);
  color: var(--accent-primary);
  font-size: 0.72rem;
  font-weight: 700;
}

.stats-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary);
}

.drop-zone {
  flex-shrink: 0;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border: 1.5px dashed var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
}

.drop-zone.active {
  border-color: var(--accent-primary);
  background: var(--primary-a08);
}

.drop-zone.compact {
  padding: 0.75rem 1rem;
}

.drop-copy {
  gap: 0.75rem;
  min-width: 0;
}

.drop-copy strong,
.drop-copy span {
  display: block;
}

.drop-copy strong {
  color: var(--text-primary);
  font-size: 0.9rem;
}

.drop-copy span {
  color: var(--text-secondary);
  font-size: 0.78rem;
  margin-top: 0.1rem;
}

.drop-icon {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--primary-a08);
  color: var(--accent-primary);
  flex: 0 0 auto;
}

.progress-card {
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
}

.progress-row {
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.progress-row strong {
  margin-left: auto;
  color: var(--text-primary);
}

.progress-bar {
  height: 5px;
  overflow: hidden;
  margin-top: 0.625rem;
  border-radius: 999px;
  background: var(--hover-bg);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent-primary);
}

.toolbar {
  justify-content: space-between;
  gap: 1rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: min(420px, 100%);
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-tertiary);
}

.search-box input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.84rem;
}

.toolbar-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  white-space: nowrap;
}

.table-shell {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.catalog-table {
  width: 100%;
  min-width: 1120px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 0.82rem;
}

.catalog-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 0.5rem;
  text-align: left;
  vertical-align: top;
}

.catalog-table th.core {
  background: var(--fill-tertiary);
}

.catalog-table td {
  border-bottom: 1px solid var(--border-light);
  padding: 0.35rem;
  color: var(--text-primary);
  vertical-align: middle;
}

.catalog-table tr:nth-child(even) td {
  background: var(--fill-tertiary);
}

.column-head {
  align-items: stretch;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 58px;
}

.column-title {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.column-name,
.column-type,
.cell-input {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
}

.column-name {
  min-height: 30px;
  padding: 0.35rem 0.45rem;
  font-weight: 700;
}

.column-name:hover,
.cell-input:hover {
  border-color: var(--border-color);
  background: var(--bg-primary);
}

.column-tools {
  gap: 0.35rem;
}

.column-type {
  min-height: 26px;
  padding: 0.25rem 0.35rem;
  border-color: var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.72rem;
}

.cell-input {
  min-height: 32px;
  padding: 0.35rem 0.45rem;
  font-size: 0.8rem;
}

.mono,
.cell-input.mono {
  font-family: "SF Mono", Consolas, "Liberation Mono", monospace;
  font-size: 0.72rem;
}

.cell-check {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-check input {
  accent-color: var(--accent-primary);
}

.row-actions {
  width: 44px;
  min-width: 44px;
  text-align: center;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 7px;
  background: var(--bg-primary);
  color: var(--text-tertiary);
}

.icon-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  border-color: var(--primary-a30);
}

.empty-state {
  flex: 1;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-tertiary);
  text-align: center;
  padding: 2rem;
}

.empty-state h3 {
  margin: 0.25rem 0 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.empty-state p {
  margin: 0;
  max-width: 420px;
  color: var(--text-secondary);
  font-size: 0.86rem;
}

.hidden-input {
  display: none;
}

@media (max-width: 900px) {
  .content-header,
  .drop-zone,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .main-content {
    padding: 1rem;
  }
}
</style>

