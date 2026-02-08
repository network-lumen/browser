<template>
  <div class="release-page internal-page">
    <InternalSidebar title="Releases" :icon="Rocket" activeKey="release">
      <nav class="lsb-nav">
        <div class="lsb-section">
          <span class="lsb-label">Manage</span>
          <button type="button" class="lsb-item" :class="{ active: true }">
            <Rocket :size="18" />
            <span>Publisher</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <main class="main-content">
      <header class="content-header">
        <div class="header-left">
          <h1>Releases</h1>
          <p v-if="allowed">Publisher access enabled for the active profile.</p>
          <p v-else-if="loading">Checking publisher permissions…</p>
          <p v-else>Publisher access required.</p>
          <p v-if="pendingTtlSeconds" class="header-meta">
            Pending TTL: {{ formatDuration(pendingTtlSeconds) }}
          </p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-secondary" :disabled="loading" @click="refreshAll">
            <RefreshCw :size="18" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
          <button type="button" class="btn-primary" :disabled="loading || !allowed" @click="openPublishModal">
            <Plus :size="18" />
            <span>Publish release</span>
          </button>
        </div>
      </header>

      <section class="toolbar" aria-label="Filters">
        <div class="filter">
          <label class="filter-label">Channel</label>
          <select v-model="channelFilter" class="form-input" :disabled="loading">
            <option value="all">All</option>
            <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="filter grow">
          <label class="filter-label">Search</label>
          <input
            v-model.trim="searchTerm"
            class="form-input"
            placeholder="Version, publisher, ID…"
            :disabled="loading"
          />
        </div>

        <div v-if="testMode.enabled" class="test-tools" aria-label="Update test tools">
          <span class="test-label">Update test</span>
          <label class="test-check">
            <input type="checkbox" v-model="testMode.forcePrompt" @change="applyTestMode" :disabled="loading" />
            <span>Force prompt</span>
          </label>
          <label class="test-check">
            <input type="checkbox" v-model="testMode.allowUnvalidatedStable" @change="applyTestMode" :disabled="loading" />
            <span>Allow pending (stable)</span>
          </label>
          <button type="button" class="btn-secondary" @click="pollNow" :disabled="loading">Re-check</button>
        </div>
      </section>

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

          <div v-if="selectedRelease.status === 'PENDING'" class="detail-actions">
            <button type="button" class="btn-primary" :disabled="submittingDao" @click="openDaoModal('validate')">
              Send to DAO (validate)
            </button>
            <button type="button" class="btn-secondary" :disabled="submittingDao" @click="openDaoModal('reject')">
              Send to DAO (reject)
            </button>
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

    <div v-if="daoModalOpen" class="modal-overlay" @click.self="closeDaoModal">
      <div class="modal">
        <div class="modal-head">
          <h2>Send to DAO</h2>
          <button type="button" class="modal-close" @click="closeDaoModal">×</button>
        </div>

        <div class="modal-body">
          <div class="form-grid">
            <label class="field">
              <span class="label">Action</span>
              <select v-model="daoForm.kind" class="input">
                <option value="validate">Validate release</option>
                <option value="reject">Reject release</option>
              </select>
            </label>
            <label class="field">
              <span class="label">Deposit (LMN)</span>
              <input v-model.trim="daoForm.depositLmn" class="input" placeholder="0" />
            </label>
          </div>

          <label class="field">
            <span class="label">Title</span>
            <input v-model.trim="daoForm.title" class="input" />
          </label>

          <label class="field">
            <span class="label">Summary</span>
            <textarea v-model="daoForm.summary" class="input" rows="3" />
          </label>

          <label v-if="daoForm.kind === 'reject'" class="field">
            <span class="label">Reason (optional)</span>
            <textarea v-model="daoForm.reason" class="input" rows="3" placeholder="Why should this release be rejected?" />
          </label>
        </div>

        <div class="modal-foot">
          <button type="button" class="btn-secondary" @click="closeDaoModal" :disabled="submittingDao">Cancel</button>
          <button type="button" class="btn-primary" @click="submitDaoProposal" :disabled="submittingDao">
            <span v-if="submittingDao" class="inline-spinner"><UiSpinner size="sm" /> Sending…</span>
            <span v-else>Broadcast proposal</span>
          </button>
        </div>
      </div>
    </div>

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
              <button type="button" class="btn-secondary btn-sm" @click="addArtifact">Add artifact</button>
            </div>

            <div v-for="(a, idx) in draft.artifacts" :key="a.id" class="artifact-draft">
              <div class="artifact-draft-head">
                <div class="muted">Artifact #{{ idx + 1 }}</div>
                <button
                  v-if="draft.artifacts.length > 1"
                  type="button"
                  class="btn-secondary btn-sm"
                  @click="removeArtifact(idx)"
                >
                  Remove
                </button>
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
          <button type="button" class="btn-secondary" @click="closePublishModal" :disabled="submitting">Cancel</button>
          <button type="button" class="btn-primary" @click="submitRelease" :disabled="submitting">
            <span v-if="submitting" class="inline-spinner"><UiSpinner size="sm" /> Publishing…</span>
            <span v-else>Publish</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import { Plus, RefreshCw, Rocket } from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import { addToast } from '../../stores/toastStore';
import { getActiveProfile } from '../profilesStore';

type ReleaseParams = {
  allowedPublishers: string[];
  channels: string[];
  maxArtifacts: number;
  maxUrlsPerArt: number;
  maxSigsPerArt: number;
  maxNotesLen: number;
  maxPendingTtl: string;
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

type DaoKind = 'validate' | 'reject';

const daoModalOpen = ref(false);
const submittingDao = ref(false);
const daoForm = reactive({
  kind: 'validate' as DaoKind,
  title: '',
  summary: '',
  depositLmn: '0',
  reason: ''
});

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
    channels: Array.isArray(p.channels) ? p.channels : ['stable', 'beta'],
    maxArtifacts: Number(p.max_artifacts ?? p.maxArtifacts ?? 0) || 0,
    maxUrlsPerArt: Number(p.max_urls_per_art ?? p.maxUrlsPerArt ?? 0) || 0,
    maxSigsPerArt: Number(p.max_sigs_per_art ?? p.maxSigsPerArt ?? 0) || 0,
    maxNotesLen: Number(p.max_notes_len ?? p.maxNotesLen ?? 0) || 0,
    maxPendingTtl: String(p.max_pending_ttl ?? p.maxPendingTtl ?? '0'),
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
  return p.allowedPublishers.includes(addr);
});

const channelOptions = computed(() => (params.value?.channels?.length ? params.value.channels : ['stable', 'beta']));
const pendingTtlSeconds = computed(() => {
  const raw = params.value?.maxPendingTtl ?? '0';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
});

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

function openDaoModal(kind: DaoKind) {
  if (!selectedRelease.value) return;
  daoForm.kind = kind;
  daoForm.depositLmn = '0';
  daoForm.reason = '';
  const r = selectedRelease.value;
  const id = Math.trunc(r.id);
  const ver = r.version ? ` · ${r.version}` : '';
  const chan = r.channel ? ` (${r.channel})` : '';
  daoForm.title =
    kind === 'reject' ? `Reject release #${id}${chan}` : `Validate release #${id}${chan}`;
  daoForm.summary =
    kind === 'reject'
      ? `Reject pending release #${id}${ver}${chan}.`
      : `Validate pending release #${id}${ver}${chan}.`;
  daoModalOpen.value = true;
}

function closeDaoModal() {
  if (submittingDao.value) return;
  daoModalOpen.value = false;
}

async function submitDaoProposal() {
  if (submittingDao.value) return;
  const r = selectedRelease.value;
  if (!r) return;

  const active = getActiveProfile() as any;
  const profileId = String(active?.id || '').trim();
  const proposer = activeAddress.value;
  if (!profileId || !proposer) {
    addToast('error', 'Select a profile with a wallet first.');
    return;
  }

  const api = (window as any).lumen?.release?.submitToDao;
  if (typeof api !== 'function') {
    addToast('error', 'DAO submission API unavailable.');
    return;
  }

  submittingDao.value = true;
  try {
    const reason = String(daoForm.reason || '').trim();
    const summary = reason && daoForm.kind === 'reject'
      ? `${daoForm.summary.trim()}\n\nReason: ${reason}`
      : daoForm.summary.trim();

    const res = await api({
      profileId,
      proposer,
      kind: daoForm.kind,
      releaseId: r.id,
      title: daoForm.title.trim(),
      summary,
      depositLmn: daoForm.depositLmn.trim() || '0'
    });
    if (!res?.ok) throw new Error(String(res?.error || 'Broadcast failed'));
    addToast('success', `Proposal broadcasted${res?.txhash ? ` (${res.txhash})` : ''}`);
    daoModalOpen.value = false;
    await fetchReleases();
  } catch (e: any) {
    addToast('error', String(e?.message || e || 'Broadcast failed'));
  } finally {
    submittingDao.value = false;
  }
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

function formatDuration(seconds: number) {
  const s = Math.max(0, Number(seconds) || 0);
  if (!s) return '0s';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return remS ? `${m}m ${remS}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 48) return remM ? `${h}h ${remM}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH ? `${d}d ${remH}h` : `${d}d`;
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
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-secondary);
}

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
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
}
.header-left p {
  margin: 0.35rem 0 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.header-meta {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 650;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease,
    background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.btn-primary {
  border: none;
  color: white;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-primary);
}

.btn-primary:hover:enabled {
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary-lg);
}

.btn-secondary {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
}

.btn-secondary:hover:enabled {
  background: var(--primary-a08);
  border-color: var(--primary-a15);
  color: var(--accent-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-sm {
  padding: 0.55rem 0.85rem;
  font-size: 0.82rem;
  border-radius: 10px;
}

.inline-spinner {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar {
  display: flex;
  align-items: flex-end;
  gap: 0.9rem 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.filter {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 220px;
}

.filter.grow {
  flex: 1 1 320px;
  min-width: 260px;
}

.filter-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.form-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  font-size: 0.85rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--primary-a15);
}

.test-tools {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.55rem 0.75rem;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.test-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.test-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1rem;
  min-height: 0;
  overflow: hidden;
}
.panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-primary);
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
  background: var(--hover-bg);
}
.row.active {
  background: var(--primary-a08);
  border-color: var(--primary-a15);
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
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
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

.detail-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin: 0.5rem 0 1rem;
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
  border-top: 1px solid var(--border-light);
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
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 0.75rem;
  margin-top: 0.75rem;
  background: var(--bg-secondary);
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
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
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
  border-radius: 18px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-primary-lg);
  padding: 1.25rem;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 0.75rem;
}
.modal-head h2 {
  margin: 0;
  font-size: 1.2rem;
}
.modal-close {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: transparent;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.modal-close:hover {
  background: var(--hover-bg);
  border-color: var(--border-color);
  color: var(--text-primary);
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
  border-top: 1px solid var(--border-light);
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
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 0.55rem 0.65rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--primary-a15);
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
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 0.75rem;
  margin-top: 0.75rem;
  background: var(--bg-primary);
}
.artifact-draft-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
@media (max-width: 1000px) {
  .main-content {
    padding: 1.5rem;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
