<template>
  <!-- ####### lumen://release RELEASE ####### -->
  <div class="internal-page flex">
    <InternalSidebar title="Releases" :icon="Rocket" activeKey="release">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection title="Manage">
          <UiSidebarNavItem active>
            <Rocket :size="18" />
            <span>Publisher</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <main class="flex-1 min-w-0 flex flex-column overflow-hidden bg-secondary py-32px px-40px">
      <UiPageHeader title="Releases" title-weight="strong">
        <p class="color-text-secondary text-14px m-0px mt-8px" v-if="allowed">Publisher access enabled for the active profile.</p>
        <p class="color-text-secondary text-14px m-0px mt-8px" v-else-if="loading">Checking publisher permissions…</p>
        <p class="color-text-secondary text-14px m-0px mt-8px" v-else>Publisher access required.</p>
        <p v-if="pendingTtlSeconds" class="color-text-tertiary text-13px m-0px mt-8px">
          Pending TTL: {{ formatDuration(pendingTtlSeconds) }}
        </p>
        <template #actions>
          <UiButton variant="secondary" type="button" :disabled="loading" @click="refreshAll">
            <RefreshCw :size="18" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </UiButton>
          <UiButton variant="primary" type="button" :disabled="loading || !allowed" @click="openPublishModal">
            <Plus :size="18" />
            <span>Publish release</span>
          </UiButton>
        </template>
      </UiPageHeader>

      <section class="flex flex-wrap-wrap mb-16px flex-align-end gap-y-14px gap-x-16px" aria-label="Filters">
        <div class="flex flex-column gap-6px min-w-220px">
          <label class="txt-weight-strong color-text-tertiary text-uppercase text-12px letter-spacing-006em">Channel</label>
          <select v-model="channelFilter" class="w-full text-14px color-text-primary border-radius-12px border-1 bg-primary py-10px px-12px focus-outline-none focus-border-primary focus-ring focus-shadow" :disabled="loading">
            <option value="all">All</option>
            <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="flex flex-column gap-6px min-w-260px flex-1-1-320px">
          <label class="txt-weight-strong color-text-tertiary text-uppercase text-12px letter-spacing-006em">Search</label>
          <UiInput radius-class="border-radius-12px" font-size-class="text-14px" :focus-ring="false" v-model.trim="searchTerm"
            placeholder="Version, publisher, ID…"
            :disabled="loading" class="focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
        </div>

        <div v-if="testMode.enabled" class="flex-align-center gap-12px flex-wrap-wrap border-radius-14px border-1 bg-primary py-8px px-12px" aria-label="Update test tools">
          <span class="txt-weight-strong color-text-tertiary text-uppercase text-12px letter-spacing-006em">Update test</span>
          <UiCheckbox v-model="testMode.forcePrompt" :disabled="loading" @update:modelValue="applyTestMode">Force prompt</UiCheckbox>
          <UiCheckbox v-model="testMode.allowUnvalidatedStable" :disabled="loading" @update:modelValue="applyTestMode">Allow pending (stable)</UiCheckbox>
          <UiButton variant="secondary" type="button" @click="pollNow" :disabled="loading">Re-check</UiButton>
        </div>
      </section>

      <section v-if="!allowed && !loading">
        <p>Redirecting…</p>
      </section>

      <section v-else class="flex-1 overflow-hidden gap-16px flex min-h-0">
        <article class="overflow-auto bg-primary border-1 border-radius-16px shadow-primary p-12px min-h-0 flex-11-1-420px">
          <div class="flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-12px pt-4px pr-4px pb-12px pl-4px">
            <span>Releases</span>
            <span class="color-text-tertiary fw-500">{{ filteredReleases.length }} total</span>
          </div>

          <div v-if="loading" class="flex-align-justify-center gap-8px color-text-secondary py-24px px-8px">
            <UiSpinner size="sm" />
            <span>Loading releases…</span>
          </div>

          <div v-else-if="!filteredReleases.length" class="flex-align-justify-center gap-8px color-text-secondary py-24px px-8px">No releases found.</div>

          <button
            v-for="r in filteredReleases"
            :key="r.id"
            type="button"
            class="hover-bg-hover w-full text-left flex-align-center flex-justify-space-between cursor-pointer border-radius-12px gap-16px border-1-transparent bg-transparent py-10px px-12px transition-bg-border-012"
            :class="{ 'row-state-active-primary': selectedRelease?.id === r.id }"
            @click="selectedRelease = r"
          >
            <div>
              <div class="flex-align-center gap-8px">
                <span class="color-text-tertiary text-14px">#{{ r.id }}</span>
                <span class="txt-weight-medium color-text-primary">{{ r.version }}</span>
                <span class="bg-transparent border-radius-full txt-weight-strong text-12px border-1-light py-4px px-6px" :class="statusClass(r)">{{ r.status }}</span>
              </div>
              <div class="flex-align-center gap-8px color-text-tertiary fw-500 text-13px mt-4px">
                <span>{{ r.channel }}</span>
                <span>•</span>
                <span>{{ formatDate(r.createdAt) }}</span>
                <span v-if="r.publisher">•</span>
                <span v-if="r.publisher">{{ shortAddr(r.publisher) }}</span>
              </div>
            </div>
            <div class="color-text-tertiary fw-500 text-13px nowrap">{{ artifactSummary(r) }}</div>
          </button>
        </article>

        <article class="overflow-auto bg-primary border-1 border-radius-16px shadow-primary p-12px min-h-0 flex-1-1-380px" v-if="selectedRelease">
          <div class="flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-12px pt-4px pr-4px pb-12px pl-4px">
            <span>Release #{{ selectedRelease.id }}</span>
            <span class="color-text-tertiary fw-500">{{ selectedRelease.version }} · {{ selectedRelease.channel }}</span>
          </div>

          <div v-if="selectedRelease.status === 'PENDING'" class="flex flex-wrap-wrap gap-12px m-0px mt-8px mb-16px">
            <UiButton variant="primary" type="button" :disabled="submittingDao" @click="openDaoModal('validate')">
              Send to DAO (validate)
            </UiButton>
            <UiButton variant="secondary" type="button" :disabled="submittingDao" @click="openDaoModal('reject')">
              Send to DAO (reject)
            </UiButton>
          </div>

          <div class="gap-12px mb-16px grid grid-cols-1fr-1fr">
            <UiKeyValue label="Status">
              <span class="bg-transparent border-radius-full txt-weight-strong text-12px border-1-light py-4px px-6px" :class="statusClass(selectedRelease)">{{ selectedRelease.status }}</span>
            </UiKeyValue>
            <UiKeyValue label="Publisher" :value="selectedRelease.publisher || '-'" value-class="mono" />
            <UiKeyValue label="Created" :value="formatDate(selectedRelease.createdAt)" />
            <UiKeyValue v-if="selectedRelease.supersedes.length" label="Supersedes" :value="selectedRelease.supersedes.join(', ')" value-class="mono" />
          </div>

          <div class="pt-12px mt-12px border-top-1-light" v-if="selectedRelease.notes">
            <div class="txt-weight-medium color-text-primary mb-8px">Release notes</div>
            <div class="color-text-secondary pre-wrap">{{ selectedRelease.notes }}</div>
          </div>

          <div>
            <div class="txt-weight-medium color-text-primary mb-8px">Artifacts ({{ selectedRelease.artifacts.length }})</div>
            <div v-for="(a, idx) in selectedRelease.artifacts" :key="`${a.platform}-${a.kind}-${idx}`" class="border-radius-12px border-1-light p-12px mt-12px bg-secondary">
              <div class="flex-align-baseline flex-justify-space-between gap-12px">
                <div class="txt-weight-medium color-text-primary">{{ a.platform }} · {{ a.kind }}</div>
                <div class="color-text-tertiary fw-500">{{ formatBytes(a.size) }}</div>
              </div>
              <div>
                <UiKeyValue label="SHA-256" :value="a.sha256Hex || '-'" value-class="mono break-word" />
                <UiKeyValue v-if="a.cid" label="CID" :value="a.cid" value-class="mono break-word" />
                <UiKeyValue v-if="a.urls.length" label="URLs">
                  <div v-for="(u, uIdx) in a.urls" :key="uIdx" class="mono break-word">{{ u }}</div>
                </UiKeyValue>
              </div>
            </div>
          </div>
        </article>

        <article class="overflow-auto bg-primary border-1 border-radius-16px shadow-primary p-12px min-h-0 flex-1-1-380px" v-else>
          <div class="flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-12px pt-4px pr-4px pb-12px pl-4px">
            <span>Details</span>
            <span class="color-text-tertiary fw-500">Select a release</span>
          </div>
          <div class="flex-align-justify-center gap-8px color-text-secondary py-24px px-8px">Pick a release from the list.</div>
        </article>
      </section>
    </main>

    <DaoProposalDialog :model-value="daoModalOpen" :form="daoForm" :busy="submittingDao" @update:model-value="closeDaoModal" @submit="submitDaoProposal" />

    <PublishReleaseDialog :model-value="publishModalOpen" :draft="draft" :github-release-url="githubReleaseUrl" :channel-options="channelOptions" :max-notes-len="params?.maxNotesLen" :importing-github="importingGithub" :submitting="submitting" @update:model-value="closePublishModal" @update:github-release-url="githubReleaseUrl = $event" @submit="submitRelease" @add-artifact="addArtifact" @remove-artifact="removeArtifact" @import-github="importFromGithubRelease" />
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Plus, RefreshCw, Rocket } from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiCheckbox from '../../ui/UiCheckbox.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiKeyValue from '../../ui/UiKeyValue.vue';
import { addToast } from '../../stores/toastStore';
import { getActiveProfile } from '../profilesStore';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { formatBytes as formatBytesValue, formatDateTime } from '../services/format';
import { safeString, errorMessage } from '../services/coerce';
import type { ReleaseParams, ArtifactRecord, ReleaseRecord, ArtifactDraft, DaoKind , DaoProposalForm, ReleaseDraft } from '../../types/releasePage';

import { useTabNavigation, useTabState } from '../../composables/useTabNavigation';
import DaoProposalDialog from '../../dialogs/DaoProposalDialog.vue';
import PublishReleaseDialog from '../../dialogs/PublishReleaseDialog.vue';
const { navigate } = useTabNavigation();
const { currentTabRefresh } = useTabState();

const loading = ref(true);
const params = ref<ReleaseParams | null>(null);
const releases = ref<ReleaseRecord[]>([]);
const selectedRelease = ref<ReleaseRecord | null>(null);

useTabLoadingSync(loading);

const searchTerm = ref('');
const channelFilter = ref<'all' | string>('all');

const publishModalOpen = ref(false);
const submitting = ref(false);

const daoModalOpen = ref(false);
const submittingDao = ref(false);
const daoForm = reactive<DaoProposalForm>({
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

const draft = reactive<ReleaseDraft>({
  version: '',
  channel: '',
  notes: '',
  supersedes: '',
  emergencyOk: false,
  artifacts: [] as ArtifactDraft[]
});

const githubReleaseUrl = ref('');
const importingGithub = ref(false);

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
  const api = useInternalLumen()?.net?.restGet;
  if (typeof api !== 'function') throw new Error('Network API unavailable');
  const res = await api(path);
  if (!res?.ok) throw new Error(String(res?.error || `Request failed (${path})`));
  return res.json ?? null;
}

async function httpGet(url: string, options: any = {}) {
  const api = useInternalLumen()?.httpGet || useInternalLumen()?.http?.get;
  if (typeof api !== 'function') throw new Error('HTTP API unavailable');
  const res = await api(String(url || ''), options || {});
  if (!res) throw new Error('HTTP request failed');
  if (!res.ok) {
    const status = Number(res.status || 0);
    const msg = safeString(res.error || res.text || '', 256);
    throw new Error(msg ? `HTTP ${status || 0}: ${msg}` : `HTTP ${status || 0}`);
  }
  return res;
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
  } catch (e) {
    addToast('error', errorMessage(e, 'Unable to fetch releases'));
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

watch(
  () => currentTabRefresh?.value,
  () => {
    void refreshAll();
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

  const api = useInternalLumen()?.release?.submitToDao;
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
  } catch (e) {
    addToast('error', errorMessage(e, 'Broadcast failed'));
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
  githubReleaseUrl.value = '';
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

function parseGithubReleaseUrl(input: string): { owner: string; repo: string; tag: string } | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  const host = String(u.hostname || '').toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') return null;

  const parts = String(u.pathname || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  // /<owner>/<repo>/releases/tag/<tag>
  if (parts.length >= 5 && parts[2] === 'releases' && parts[3] === 'tag') {
    const [owner, repo, _releases, _tag, tag] = parts;
    if (!owner || !repo || !tag) return null;
    return { owner, repo, tag };
  }

  // /<owner>/<repo>/releases/download/<tag>/<file>
  if (parts.length >= 5 && parts[2] === 'releases' && parts[3] === 'download') {
    const [owner, repo, _releases, _download, tag] = parts;
    if (!owner || !repo || !tag) return null;
    return { owner, repo, tag };
  }

  return null;
}

function versionFromTag(tag: string): string {
  const t = String(tag || '').trim();
  if (!t) return '';
  const m = t.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
  if (m && m[1]) return m[1];
  return t.startsWith('v') || t.startsWith('V') ? t.slice(1) : t;
}

function inferPlatformFromAssetName(name: string): string | null {
  const lower = String(name || '').toLowerCase();
  if (!lower) return null;

  const has = (s: string) => lower.includes(s);
  const arch = () => {
    if (has('arm64') || has('aarch64')) return 'arm64';
    if (has('ia32') || has('x86') || has('386')) return '386';
    if (has('x64') || has('amd64')) return 'amd64';
    return '';
  };

  if (has('windows') || lower.endsWith('.exe') || lower.endsWith('.msi')) {
    const a = arch();
    return `windows-${a || 'amd64'}`;
  }

  if (has('linux') || lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm')) {
    const a = arch();
    return `linux-${a || 'amd64'}`;
  }

  if (has('darwin') || has('mac') || lower.endsWith('.dmg')) {
    const a = arch();
    if (a === 'arm64') return 'darwin-arm64';
    if (a === '386') return null;
    return 'darwin-amd64';
  }

  return null;
}

function parseSha256Sums(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = String(text || '');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    const m = s.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (!m || !m[1] || !m[2]) continue;
    const hash = m[1].toLowerCase();
    const filename = String(m[2]).trim().replace(/^\.?\/*/, '');
    if (!filename) continue;
    out[filename] = hash;
    const base = filename.split(/[\\/]/).pop() || '';
    if (base) out[base] = hash;
  }
  return out;
}

function sortArtifactsByPlatform(a: ArtifactDraft, b: ArtifactDraft) {
  const order = ['windows-amd64', 'windows-arm64', 'darwin-amd64', 'darwin-arm64', 'linux-amd64', 'linux-arm64'];
  const ai = order.indexOf(a.platform);
  const bi = order.indexOf(b.platform);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return a.platform.localeCompare(b.platform);
}

async function importFromGithubRelease() {
  const parsed = parseGithubReleaseUrl(githubReleaseUrl.value);
  if (!parsed) {
    addToast('error', 'Paste a valid GitHub release URL (…/releases/tag/vX.Y.Z).');
    return;
  }

  importingGithub.value = true;
  try {
    const { owner, repo, tag } = parsed;
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`;
    const res = await httpGet(apiUrl, {
      timeout: 30_000,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'LumenBrowser'
      }
    });

    const release = res.json || null;
    const tagName = safeString(release?.tag_name || tag, 256);
    const version = versionFromTag(tagName);
    if (version) draft.version = version;

    const body = safeString(release?.body || '', 50_000);
    if (body) {
      const maxNotes = params.value?.maxNotesLen || 0;
      if (maxNotes && body.length > maxNotes) {
        draft.notes = body.slice(0, maxNotes);
        addToast('warning', `Notes truncated to ${maxNotes} chars.`);
      } else {
        draft.notes = body;
      }
    }

    const assetsRaw = Array.isArray(release?.assets) ? release.assets : [];
    if (!assetsRaw.length) throw new Error('No assets found on this GitHub release.');

    const shaAsset =
      assetsRaw.find((a: any) => String(a?.name || '').toLowerCase() === 'sha256sums.txt') ||
      assetsRaw.find((a: any) => String(a?.name || '').toLowerCase() === 'sha256sums');

    let shaMap: Record<string, string> = {};
    if (shaAsset?.browser_download_url) {
      const shaRes = await httpGet(String(shaAsset.browser_download_url), { timeout: 30_000 });
      shaMap = parseSha256Sums(String(shaRes.text || ''));
    } else {
      addToast('warning', 'SHA256SUMS.txt not found in assets; SHA fields will be empty.');
    }

    const next: ArtifactDraft[] = [];
    for (const a of assetsRaw) {
      const name = safeString(a?.name || '', 256);
      const url = safeString(a?.browser_download_url || '', 2048);
      const size = Number(a?.size ?? 0) || 0;
      if (!name || !url) continue;

      const lower = name.toLowerCase();
      if (lower === 'sha256sums.txt' || lower === 'sha256sums') continue;

      const platform = inferPlatformFromAssetName(name);
      if (!platform) continue;

      const sha256Hex = shaMap[name] || '';
      next.push({
        id: randomId(),
        platform,
        kind: 'browser',
        cid: '',
        sha256Hex,
        size: size > 0 ? String(size) : '',
        urlsText: url
      });
    }

    if (!next.length) throw new Error('No compatible artifacts found on this release.');

    const missingSha = next
      .filter((a) => !/^[0-9a-f]{64}$/i.test(String(a.sha256Hex || '').trim()))
      .map((a) => a.platform);
    if (missingSha.length) addToast('warning', `Missing SHA-256 for: ${missingSha.join(', ')}.`);

    const missingSize = next
      .filter((a) => !(Number.isFinite(Number(a.size)) && Number(a.size) > 0))
      .map((a) => a.platform);
    if (missingSize.length) addToast('warning', `Missing size for: ${missingSize.join(', ')}.`);

    next.sort(sortArtifactsByPlatform);
    draft.artifacts.splice(0, draft.artifacts.length, ...next);
    addToast('success', `Imported ${next.length} artifact(s) from ${owner}/${repo}@${tagName}.`);
  } catch (e) {
    addToast('error', errorMessage(e, 'Import failed'));
  } finally {
    importingGithub.value = false;
  }
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
  } catch (e) {
    addToast('error', errorMessage(e));
    return;
  }

  const api = useInternalLumen()?.release?.publishRelease;
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
  } catch (e) {
    addToast('error', errorMessage(e, 'Publish failed'));
  } finally {
    submitting.value = false;
  }
}

async function loadTestMode() {
  try {
    const api = useInternalLumen()?.release?.getTestOptions;
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
    const api = useInternalLumen()?.release?.setTestOptions;
    if (typeof api !== 'function') return;
    const res = await api({
      forcePrompt: !!testMode.forcePrompt,
      allowUnvalidatedStable: !!testMode.allowUnvalidatedStable
    });
    if (res && res.ok === false) addToast('error', String(res.error || 'Unable to apply test options'));
  } catch (e) {
    addToast('error', errorMessage(e, 'Unable to apply test options'));
  }
}

async function pollNow() {
  try {
    const api = useInternalLumen()?.release?.pollNow;
    if (typeof api !== 'function') return;
    await api();
    addToast('success', 'Release watcher refreshed');
  } catch (e) {
    addToast('error', errorMessage(e, 'Unable to refresh'));
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
  return formatDateTime(value, { empty: '-' });
}

function formatBytes(bytes: number) {
  return formatBytesValue(bytes, { decimals: 2, empty: '-' });
}

function shortAddr(addr?: string) {
  const a = String(addr || '').trim();
  if (!a) return '-';
  if (a.length <= 12) return a;
  return `${a.slice(0, 10)}…`;
}

function statusClass(r: ReleaseRecord) {
  const status = String(r.status || '').toUpperCase();
  if (r.yanked) return 'bg-fill-error color-error';
  if (status.includes('REJECT') || status.includes('EXPIRE')) return 'bg-warning-a15 color-warning';
  if (status.includes('VALID')) return 'bg-fill-success color-success';
  return 'bg-fill-blue color-primary';
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
