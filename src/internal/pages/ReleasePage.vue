<template>
  <div class="release-page internal-page">
    <InternalSidebar title="Releases" :icon="Rocket" activeKey="release">
      <nav class="lsb-nav">
        <div class="lsb-section">
          <span class="lsb-label">Publisher</span>
          <button type="button" class="lsb-item" :disabled="loading" @click="refreshAll">
            <RefreshCw :size="18" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
          <button type="button" class="lsb-item" :disabled="loading || !allowed" @click="openPublishModal">
            <Plus :size="18" />
            <span>Publish release</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <main class="main-content">
      <header class="content-header">
        <div class="header-left">
          <h1>Publisher workspace</h1>
          <p v-if="allowed">You are on the release allowlist. Publish releases from this app.</p>
          <p v-else>Checking publisher permissions…</p>
        </div>
        <div class="header-right">
          <div v-if="testMode.enabled" class="pill">
            <span class="pill-label">Update test</span>
            <label class="pill-check">
              <input type="checkbox" v-model="testMode.forcePrompt" @change="applyTestMode" :disabled="loading" />
              <span class="pill-check-label">Force prompt</span>
            </label>
            <label class="pill-check">
              <input type="checkbox" v-model="testMode.allowUnvalidatedStable" @change="applyTestMode" :disabled="loading" />
              <span class="pill-check-label">Allow pending (stable)</span>
            </label>
            <UiButton variant="ghost" size="sm" @click="pollNow" :disabled="loading">Re-check</UiButton>
          </div>
          <div class="pill">
            <span class="pill-label">Channel</span>
            <select v-model="channelFilter" class="pill-input" :disabled="loading">
              <option value="all">All</option>
              <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="pill">
            <span class="pill-label">Search</span>
            <input
              v-model.trim="searchTerm"
              class="pill-input"
              placeholder="Version, publisher, ID…"
              :disabled="loading"
            />
          </div>
        </div>
      </header>

      <section v-if="!allowed && !loading" class="no-access">
        <p>Redirecting…</p>
      </section>

      <section v-else class="grid">
        <article class="panel list-panel">
          <div class="panel-title">
            <span>Releases</span>
            <span class="muted">{{ filteredReleases.length }} total</span>
          </div>

          <div v-if="loading" class="panel-loading">
            <UiSpinner size="sm" />
            <span>Loading releases…</span>
          </div>

          <div v-else-if="!filteredReleases.length" class="panel-empty">No releases found.</div>

          <button
            v-for="r in filteredReleases"
            :key="r.id"
            type="button"
            class="row"
            :class="{ active: selectedRelease?.id === r.id }"
            @click="selectedRelease = r"
          >
            <div class="row-main">
              <div class="row-top">
                <span class="row-id">#{{ r.id }}</span>
                <span class="row-version">{{ r.version }}</span>
                <span class="chip" :class="statusClass(r)">{{ r.status }}</span>
              </div>
              <div class="row-sub muted">
                <span>{{ r.channel }}</span>
                <span>•</span>
                <span>{{ formatDate(r.createdAt) }}</span>
                <span v-if="r.publisher">•</span>
                <span v-if="r.publisher">{{ shortAddr(r.publisher) }}</span>
              </div>
            </div>
            <div class="row-right muted">{{ artifactSummary(r) }}</div>
          </button>
        </article>

        <article class="panel detail-panel" v-if="selectedRelease">
          <div class="panel-title">
            <span>Release #{{ selectedRelease.id }}</span>
            <span class="muted">{{ selectedRelease.version }} · {{ selectedRelease.channel }}</span>
          </div>

          <div class="detail-grid">
            <div class="kv">
              <div class="k">Status</div>
              <div class="v">
                <span class="chip" :class="statusClass(selectedRelease)">{{ selectedRelease.status }}</span>
              </div>
            </div>
            <div class="kv">
              <div class="k">Publisher</div>
              <div class="v mono">{{ selectedRelease.publisher || '-' }}</div>
            </div>
            <div class="kv">
              <div class="k">Created</div>
              <div class="v">{{ formatDate(selectedRelease.createdAt) }}</div>
            </div>
            <div class="kv" v-if="selectedRelease.supersedes.length">
              <div class="k">Supersedes</div>
              <div class="v mono">{{ selectedRelease.supersedes.join(', ') }}</div>
            </div>
          </div>

          <div class="notes" v-if="selectedRelease.notes">
            <div class="notes-title">Release notes</div>
            <div class="notes-body">{{ selectedRelease.notes }}</div>
          </div>

          <div class="artifacts">
            <div class="notes-title">Artifacts ({{ selectedRelease.artifacts.length }})</div>
            <div v-for="(a, idx) in selectedRelease.artifacts" :key="`${a.platform}-${a.kind}-${idx}`" class="artifact-card">
              <div class="artifact-head">
                <div class="artifact-title">{{ a.platform }} · {{ a.kind }}</div>
                <div class="muted">{{ formatBytes(a.size) }}</div>
              </div>
              <div class="artifact-meta">
                <div class="kv">
                  <div class="k">SHA-256</div>
                  <div class="v mono break">{{ a.sha256Hex || '-' }}</div>
                </div>
                <div class="kv" v-if="a.cid">
                  <div class="k">CID</div>
                  <div class="v mono break">{{ a.cid }}</div>
                </div>
                <div class="kv" v-if="a.urls.length">
                  <div class="k">URLs</div>
                  <div class="v">
                    <div v-for="(u, uIdx) in a.urls" :key="uIdx" class="mono break">{{ u }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article class="panel detail-panel" v-else>
          <div class="panel-title">
            <span>Details</span>
            <span class="muted">Select a release</span>
          </div>
          <div class="panel-empty">Pick a release from the list.</div>
        </article>
      </section>
    </main>

    <div v-if="publishModalOpen" class="modal-overlay" @click.self="closePublishModal">
      <div class="modal">
        <div class="modal-head">
          <h2>Publish release</h2>
          <button type="button" class="modal-close" @click="closePublishModal">×</button>
        </div>

        <div class="modal-body">
          <div class="form-grid">
            <label class="field">
              <span class="label">Version</span>
              <input v-model.trim="draft.version" class="input" placeholder="0.1.9" />
            </label>
            <label class="field">
              <span class="label">Channel</span>
              <select v-model="draft.channel" class="input">
                <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="field">
              <span class="label">Supersedes (IDs)</span>
              <input v-model.trim="draft.supersedes" class="input" placeholder="12, 13" />
            </label>
            <label class="field checkbox-field">
              <span class="label">Emergency flag</span>
              <label class="checkbox-row">
                <input type="checkbox" v-model="draft.emergencyOk" />
                <span>Allow emergency rollout</span>
              </label>
            </label>
          </div>

          <label class="field">
            <span class="label">Release notes</span>
            <textarea v-model="draft.notes" class="input" rows="4" placeholder="Changelog, highlights, etc." />
            <span class="muted small">{{ draft.notes.length }} / {{ params?.maxNotesLen || '∞' }}</span>
          </label>

          <div class="artifacts-builder">
            <div class="builder-head">
              <h3>Artifacts</h3>
              <UiButton variant="ghost" size="sm" @click="addArtifact">Add artifact</UiButton>
            </div>

            <div v-for="(a, idx) in draft.artifacts" :key="a.id" class="artifact-draft">
              <div class="artifact-draft-head">
                <div class="muted">Artifact #{{ idx + 1 }}</div>
                <UiButton v-if="draft.artifacts.length > 1" variant="ghost" size="sm" @click="removeArtifact(idx)">Remove</UiButton>
              </div>

              <div class="form-grid">
                <label class="field">
                  <span class="label">Platform</span>
                  <input v-model.trim="a.platform" class="input" placeholder="windows-amd64" />
                </label>
                <label class="field">
                  <span class="label">Kind</span>
                  <input v-model.trim="a.kind" class="input" placeholder="browser" />
                </label>
              </div>

              <div class="form-grid">
                <label class="field">
                  <span class="label">CID</span>
                  <input v-model.trim="a.cid" class="input" placeholder="Optional" />
                </label>
                <label class="field">
                  <span class="label">SHA-256</span>
                  <input v-model.trim="a.sha256Hex" class="input" placeholder="64 hex chars" />
                </label>
                <label class="field">
                  <span class="label">Size (bytes)</span>
                  <input v-model.trim="a.size" class="input" placeholder="123456" />
                </label>
              </div>

              <label class="field">
                <span class="label">URLs (one per line)</span>
                <textarea v-model="a.urlsText" class="input mono" rows="3" placeholder="https://example.com/file.exe" />
              </label>
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <UiButton variant="ghost" @click="closePublishModal" :disabled="submitting">Cancel</UiButton>
          <UiButton variant="primary" @click="submitRelease" :disabled="submitting">
            <template v-if="submitting"><UiSpinner size="sm" /> Publishing…</template>
            <template v-else>Publish</template>
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import { Plus, RefreshCw, Rocket } from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import UiButton from '../../ui/UiButton.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import { addToast } from '../../stores/toastStore';
import { getActiveProfile } from '../profilesStore';

type ReleaseParams = {
  allowedPublishers: string[];
  daoPublishers: string[];
  channels: string[];
  maxArtifacts: number;
  maxUrlsPerArt: number;
  maxSigsPerArt: number;
  maxNotesLen: number;
  publishFeeUlmn: string;
};

type ArtifactRecord = {
  platform: string;
  kind: string;
  sha256Hex: string;
  size: number;
  cid?: string;
  urls: string[];
};

type ReleaseRecord = {
  id: number;
  version: string;
  channel: string;
  notes: string;
  publisher: string;
  createdAt: number;
  yanked: boolean;
  status: string;
  artifacts: ArtifactRecord[];
  supersedes: number[];
  emergencyOk: boolean;
};

type ArtifactDraft = {
  id: string;
  platform: string;
  kind: string;
  cid: string;
  sha256Hex: string;
  size: string;
  urlsText: string;
};

const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);

const loading = ref(true);
const params = ref<ReleaseParams | null>(null);
const releases = ref<ReleaseRecord[]>([]);
const selectedRelease = ref<ReleaseRecord | null>(null);

const searchTerm = ref('');
const channelFilter = ref<'all' | string>('all');

const publishModalOpen = ref(false);
const submitting = ref(false);

const testMode = reactive({
  enabled: false,
  forcePrompt: false,
  allowUnvalidatedStable: false
});

const draft = reactive({
  version: '',
  channel: '',
  notes: '',
  supersedes: '',
  emergencyOk: false,
  artifacts: [] as ArtifactDraft[]
});

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeArtifactDraft(): ArtifactDraft {
  return { id: randomId(), platform: '', kind: '', cid: '', sha256Hex: '', size: '', urlsText: '' };
}

function parseUrls(value: string) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSupersedes(value: string) {
  return String(value || '')
    .split(/[,\s]+/)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.trunc(n));
}

function normalizeStatus(value: any): string {
  if (typeof value === 'string' && value) return value.replace('RELEASE_STATUS_', '');
  if (typeof value === 'number') {
    const map: Record<number, string> = { 0: 'PENDING', 1: 'VALIDATED', 2: 'REJECTED', 3: 'EXPIRED' };
    return map[value] || `STATUS_${value}`;
  }
  return 'PENDING';
}

function mapArtifact(raw: any): ArtifactRecord {
  return {
    platform: String(raw?.platform || ''),
    kind: String(raw?.kind || ''),
    sha256Hex: String(raw?.sha256_hex ?? raw?.sha256Hex ?? '').toLowerCase(),
    size: Number(raw?.size ?? 0) || 0,
    cid: raw?.cid ? String(raw.cid) : undefined,
    urls: Array.isArray(raw?.urls) ? raw.urls.map((u: any) => String(u || '')).filter(Boolean) : []
  };
}

function mapRelease(raw: any): ReleaseRecord {
  const artifactsRaw = Array.isArray(raw?.artifacts) ? raw.artifacts : [];
  return {
    id: Number(raw?.id ?? raw?.release_id ?? 0) || 0,
    version: String(raw?.version || `#${raw?.id ?? '?'}`),
    channel: String(raw?.channel || 'unknown'),
    notes: String(raw?.notes || ''),
    publisher: String(raw?.publisher || ''),
    createdAt: Number(raw?.created_at ?? raw?.createdAt ?? 0) || 0,
    yanked: Boolean(raw?.yanked),
    status: normalizeStatus(raw?.status),
    artifacts: artifactsRaw.map(mapArtifact),
    supersedes: Array.isArray(raw?.supersedes)
      ? raw.supersedes.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [],
    emergencyOk: Boolean(raw?.emergency_ok ?? raw?.emergencyOk)
  };
}

async function restGet(path: string) {
  const api = (window as any).lumen?.net?.restGet;
  if (typeof api !== 'function') throw new Error('Network API unavailable');
  const res = await api(path);
  if (!res?.ok) throw new Error(String(res?.error || `Request failed (${path})`));
  return res.json ?? null;
}

async function fetchParams() {
  const data = await restGet('/lumen/release/params');
  const p = data?.params || data || {};
  params.value = {
    allowedPublishers: Array.isArray(p.allowed_publishers ?? p.allowedPublishers) ? (p.allowed_publishers ?? p.allowedPublishers) : [],
    daoPublishers: Array.isArray(p.dao_publishers ?? p.daoPublishers) ? (p.dao_publishers ?? p.daoPublishers) : [],
    channels: Array.isArray(p.channels) ? p.channels : ['stable', 'beta'],
    maxArtifacts: Number(p.max_artifacts ?? p.maxArtifacts ?? 0) || 0,
    maxUrlsPerArt: Number(p.max_urls_per_art ?? p.maxUrlsPerArt ?? 0) || 0,
    maxSigsPerArt: Number(p.max_sigs_per_art ?? p.maxSigsPerArt ?? 0) || 0,
    maxNotesLen: Number(p.max_notes_len ?? p.maxNotesLen ?? 0) || 0,
    publishFeeUlmn: String(p.publish_fee_ulmn ?? p.publishFeeUlmn ?? '0')
  };
}

async function fetchReleases() {
  const data = await restGet('/lumen/release/releases?limit=100');
  const list = Array.isArray(data?.releases) ? data.releases : Array.isArray(data?.data?.releases) ? data.data.releases : [];
  releases.value = list.map(mapRelease).sort((a: ReleaseRecord, b: ReleaseRecord) => b.id - a.id);
  selectedRelease.value = releases.value[0] || null;
}

async function refreshAll() {
  loading.value = true;
  try {
    await Promise.all([fetchParams(), fetchReleases()]);
  } catch (e: any) {
    addToast('error', String(e?.message || e || 'Unable to fetch releases'));
  } finally {
    loading.value = false;
  }
}

const activeAddress = computed(() => {
  const p = getActiveProfile();
  return String(p?.walletAddress || p?.address || '').trim();
});

const allowed = computed(() => {
  const addr = activeAddress.value;
  if (!addr) return false;
  const p = params.value;
  if (!p) return false;
  return p.allowedPublishers.includes(addr) || p.daoPublishers.includes(addr);
});

const channelOptions = computed(() => (params.value?.channels?.length ? params.value.channels : ['stable', 'beta']));

watch(channelOptions, (next) => {
  if (!draft.channel) draft.channel = next[0] || 'beta';
});

const filteredReleases = computed(() => {
  const term = searchTerm.value.toLowerCase();
  const channel = channelFilter.value;
  return releases.value.filter((r) => {
    if (channel !== 'all' && r.channel !== channel) return false;
    if (!term) return true;
    const hay = `${r.version} ${r.publisher} ${r.id}`.toLowerCase();
    return hay.includes(term);
  });
});

watch(filteredReleases, (list) => {
  if (!list.length) {
    selectedRelease.value = null;
    return;
  }
  if (!selectedRelease.value || !list.find((x) => x.id === selectedRelease.value?.id)) {
    selectedRelease.value = list[0];
  }
});

watch(
  () => allowed.value,
  (ok) => {
    if (!loading.value && params.value && !ok) {
      navigate?.('lumen://home', { push: true });
    }
  }
);

function openPublishModal() {
  if (!allowed.value) return;
  publishModalOpen.value = true;
}

function closePublishModal() {
  publishModalOpen.value = false;
  resetDraft();
}

function resetDraft() {
  draft.version = '';
  draft.channel = channelOptions.value[0] || 'beta';
  draft.notes = '';
  draft.supersedes = '';
  draft.emergencyOk = false;
  draft.artifacts.splice(0, draft.artifacts.length, makeArtifactDraft());
}

function addArtifact() {
  draft.artifacts.push(makeArtifactDraft());
}

function removeArtifact(idx: number) {
  if (draft.artifacts.length <= 1) {
    draft.artifacts.splice(0, 1, makeArtifactDraft());
    return;
  }
  draft.artifacts.splice(idx, 1);
}

function buildReleasePayload() {
  const version = draft.version.trim();
  if (!version) throw new Error('Version is required');
  const channel = draft.channel.trim();
  if (!channel) throw new Error('Channel is required');
  const maxNotes = params.value?.maxNotesLen || 0;
  if (maxNotes && draft.notes.length > maxNotes) throw new Error(`Notes exceed ${maxNotes} characters`);

  const artifacts = draft.artifacts.map((a, idx) => {
    const platform = a.platform.trim();
    const kind = a.kind.trim();
    const sha = a.sha256Hex.trim().toLowerCase();
    const size = Number(a.size);
    if (!platform) throw new Error(`Artifact #${idx + 1}: platform required`);
    if (!kind) throw new Error(`Artifact #${idx + 1}: kind required`);
    if (!/^[0-9a-f]{64}$/i.test(sha)) throw new Error(`Artifact #${idx + 1}: invalid SHA-256`);
    if (!Number.isFinite(size) || size <= 0) throw new Error(`Artifact #${idx + 1}: invalid size`);
    const urls = parseUrls(a.urlsText);
    const maxUrls = params.value?.maxUrlsPerArt || 0;
    if (maxUrls && urls.length > maxUrls) throw new Error(`Artifact #${idx + 1}: maximum ${maxUrls} URLs`);
    return { platform, kind, cid: a.cid.trim(), sha256Hex: sha, size, urls };
  });

  const maxArtifacts = params.value?.maxArtifacts || 0;
  if (maxArtifacts && artifacts.length > maxArtifacts) throw new Error(`Maximum ${maxArtifacts} artifacts allowed`);

  return {
    version,
    channel,
    notes: draft.notes.trim(),
    supersedes: draft.supersedes.trim() ? parseSupersedes(draft.supersedes) : [],
    emergencyOk: !!draft.emergencyOk,
    artifacts
  };
}

async function submitRelease() {
  if (!allowed.value) return;
  const active = getActiveProfile() as any;
  const profileId = String(active?.id || '').trim();
  if (!profileId || !activeAddress.value) {
    addToast('error', 'Select a profile with a wallet first.');
    return;
  }

  let payload: any;
  try {
    payload = buildReleasePayload();
  } catch (e: any) {
    addToast('error', String(e?.message || e));
    return;
  }

  const api = (window as any).lumen?.release?.publishRelease;
  if (typeof api !== 'function') {
    addToast('error', 'Release publishing API unavailable.');
    return;
  }

  submitting.value = true;
  try {
    const res = await api({ profileId, creator: activeAddress.value, release: payload });
    if (!res?.ok) throw new Error(String(res?.error || 'Publish failed'));
    addToast('success', 'Release broadcasted');
    closePublishModal();
    await fetchReleases();
  } catch (e: any) {
    addToast('error', String(e?.message || e || 'Publish failed'));
  } finally {
    submitting.value = false;
  }
}

async function loadTestMode() {
  try {
    const api = (window as any).lumen?.release?.getTestOptions;
    if (typeof api !== 'function') return;
    const res = await api();
    if (!res || !res.enabled) return;
    testMode.enabled = true;
    testMode.forcePrompt = !!res.forcePrompt;
    testMode.allowUnvalidatedStable = !!res.allowUnvalidatedStable;
  } catch {
    // ignore
  }
}

async function applyTestMode() {
  try {
    const api = (window as any).lumen?.release?.setTestOptions;
    if (typeof api !== 'function') return;
    const res = await api({
      forcePrompt: !!testMode.forcePrompt,
      allowUnvalidatedStable: !!testMode.allowUnvalidatedStable
    });
    if (res && res.ok === false) addToast('error', String(res.error || 'Unable to apply test options'));
  } catch (e: any) {
    addToast('error', String(e?.message || e || 'Unable to apply test options'));
  }
}

async function pollNow() {
  try {
    const api = (window as any).lumen?.release?.pollNow;
    if (typeof api !== 'function') return;
    await api();
    addToast('success', 'Release watcher refreshed');
  } catch (e: any) {
    addToast('error', String(e?.message || e || 'Unable to refresh'));
  }
}

function artifactSummary(r: ReleaseRecord) {
  const count = r.artifacts?.length || 0;
  const base = `${count} ${count === 1 ? 'artifact' : 'artifacts'}`;
  if (!count) return base;
  const kinds = Array.from(new Set(r.artifacts.map((a) => String(a.kind || '').trim()).filter(Boolean)));
  return kinds.length ? `${base} · ${kinds.join(', ')}` : base;
}

function formatDate(value: number) {
  if (!value) return '-';
  const ms = value < 1e12 ? value * 1000 : value;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let v = bytes;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function shortAddr(addr?: string) {
  const a = String(addr || '').trim();
  if (!a) return '-';
  if (a.length <= 12) return a;
  return `${a.slice(0, 10)}…`;
}

function statusClass(r: ReleaseRecord) {
  const status = String(r.status || '').toUpperCase();
  if (r.yanked) return 'danger';
  if (status.includes('REJECT') || status.includes('EXPIRE')) return 'warning';
  if (status.includes('VALID')) return 'success';
  return 'pending';
}

onMounted(async () => {
  resetDraft();
  await loadTestMode();
  await refreshAll();
  if (!allowed.value) {
    navigate?.('lumen://home', { push: true });
  }
});
</script>

<style scoped>
.content-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.header-left h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}
.header-left p {
  margin: 0.25rem 0 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.header-right {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}
.pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-primary, rgba(0,0,0,0.08));
  background: var(--bg-primary, #fff);
  border-radius: 12px;
  padding: 0.35rem 0.5rem;
}
.pill-label {
  color: var(--text-tertiary);
  font-size: 0.75rem;
}
.pill-input {
  border: none;
  background: transparent;
  outline: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  min-width: 150px;
}
.pill-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.pill-check-label {
  white-space: nowrap;
}
.grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1rem;
  min-height: 0;
}
.panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary, rgba(0,0,0,0.08));
  border-radius: 14px;
  box-shadow: var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.08));
  padding: 0.75rem;
  min-height: 0;
  overflow: auto;
}
.panel-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.25rem 0.25rem 0.75rem 0.25rem;
  font-weight: 700;
  color: var(--text-primary);
}
.muted {
  color: var(--text-tertiary);
  font-weight: 500;
}
.small {
  font-size: 0.75rem;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.break {
  word-break: break-word;
}
.panel-loading,
.panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 0.5rem;
  color: var(--text-secondary);
}
.row {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 12px;
  padding: 0.65rem 0.65rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.row:hover {
  background: var(--bg-secondary, rgba(0,0,0,0.03));
}
.row.active {
  background: rgba(0, 122, 255, 0.08);
  border-color: rgba(0, 122, 255, 0.25);
}
.row-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.row-id {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}
.row-version {
  font-weight: 700;
  color: var(--text-primary);
}
.row-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  margin-top: 0.15rem;
}
.row-right {
  font-size: 0.8rem;
  white-space: nowrap;
}
.chip {
  font-size: 0.72rem;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  border: 1px solid rgba(0,0,0,0.08);
  background: rgba(0,0,0,0.03);
}
.chip.success {
  border-color: rgba(48, 209, 88, 0.25);
  background: rgba(48, 209, 88, 0.12);
  color: rgba(20, 83, 45, 1);
}
.chip.warning {
  border-color: rgba(255, 159, 10, 0.25);
  background: rgba(255, 159, 10, 0.12);
  color: rgba(120, 53, 15, 1);
}
.chip.danger {
  border-color: rgba(255, 69, 58, 0.25);
  background: rgba(255, 69, 58, 0.12);
  color: rgba(127, 29, 29, 1);
}
.chip.pending {
  border-color: rgba(0, 122, 255, 0.25);
  background: rgba(0, 122, 255, 0.12);
  color: rgba(30, 64, 175, 1);
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.kv .k {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
.kv .v {
  color: var(--text-primary);
  font-size: 0.9rem;
  margin-top: 0.2rem;
}
.notes {
  border-top: 1px solid rgba(0,0,0,0.06);
  padding-top: 0.75rem;
  margin-top: 0.75rem;
}
.notes-title {
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}
.notes-body {
  color: var(--text-secondary);
  white-space: pre-wrap;
}
.artifact-card {
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 0.75rem;
  margin-top: 0.75rem;
  background: var(--bg-secondary, rgba(0,0,0,0.02));
}
.artifact-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}
.artifact-title {
  font-weight: 700;
  color: var(--text-primary);
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 2000;
}
.modal {
  width: min(900px, 96vw);
  max-height: 92vh;
  overflow: auto;
  background: var(--bg-primary);
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.10);
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  padding: 1rem;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  padding-bottom: 0.75rem;
}
.modal-head h2 {
  margin: 0;
  font-size: 1.2rem;
}
.modal-close {
  border: none;
  background: transparent;
  font-size: 1.6rem;
  cursor: pointer;
  color: var(--text-tertiary);
}
.modal-body {
  padding: 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid rgba(0,0,0,0.06);
  padding-top: 0.75rem;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.field .label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
.input {
  border: 1px solid rgba(0,0,0,0.10);
  border-radius: 12px;
  padding: 0.55rem 0.65rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}
.checkbox-field .checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
.artifacts-builder .builder-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
}
.artifact-draft {
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 0.75rem;
  margin-top: 0.75rem;
  background: var(--bg-secondary, rgba(0,0,0,0.02));
}
.artifact-draft-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
@media (max-width: 1000px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
