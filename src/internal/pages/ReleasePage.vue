<template>
  <div class="release-page internal-page">
    <InternalSidebar title="Releases" :icon="Rocket" activeKey="release">
      <nav class="lsb-nav flex flex-column gap-12px">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em mb-4px py-8px px-10px">Manage</span>
          <button type="button" class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-10px border-radius-sm w-full text-13px fw-500 text-left py-8px px-10px transition-all-015" :class="{ 'active bg-gradient-primary color-white shadow-primary': true }">
            <Rocket :size="18" />
            <span>Publisher</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <main class="relpage-main flex-1 min-w-0 flex flex-column overflow-hidden bg-secondary py-32px px-40px">
      <UiPageHeader title="Releases" title-weight="strong">
        <p class="color-text-secondary text-14px m-0px mt-6px" v-if="allowed">Publisher access enabled for the active profile.</p>
        <p class="color-text-secondary text-14px m-0px mt-6px" v-else-if="loading">Checking publisher permissions…</p>
        <p class="color-text-secondary text-14px m-0px mt-6px" v-else>Publisher access required.</p>
        <p v-if="pendingTtlSeconds" class="color-text-tertiary text-13px m-0px mt-6px">
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

      <section class="relpage-toolbar flex flex-wrap-wrap mb-16px flex-align-end gap-y-14px gap-x-16px" aria-label="Filters">
        <div class="relpage-filter flex flex-column gap-6px min-w-220px">
          <label class="relpage-filter-label txt-weight-strong color-text-tertiary text-uppercase text-12px letter-spacing-006em">Channel</label>
          <select v-model="channelFilter" class="relpage-form-input w-full text-14px color-text-primary border-radius-12px border-1 bg-primary py-10px px-12px focus-outline-none focus-border-accent focus-ring focus-shadow" :disabled="loading">
            <option value="all">All</option>
            <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="relpage-filter grow flex flex-column gap-6px relpage-filter-grow min-w-260px min-w-220px">
          <label class="relpage-filter-label txt-weight-strong color-text-tertiary text-uppercase text-12px letter-spacing-006em">Search</label>
          <UiInput radius-class="border-radius-12px" font-size-class="text-14px" :focus-ring="false" v-model.trim="searchTerm"
           
            placeholder="Version, publisher, ID…"
            :disabled="loading" class="relpage-form-input focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
        </div>

        <div v-if="testMode.enabled" class="relpage-test-tools flex-align-center gap-12px flex-wrap-wrap border-radius-14px border-1 bg-primary py-8px px-12px" aria-label="Update test tools">
          <span class="relpage-test-label txt-weight-strong color-text-tertiary text-uppercase text-12px letter-spacing-006em">Update test</span>
          <UiCheckbox v-model="testMode.forcePrompt" :disabled="loading" @update:modelValue="applyTestMode">Force prompt</UiCheckbox>
          <UiCheckbox v-model="testMode.allowUnvalidatedStable" :disabled="loading" @update:modelValue="applyTestMode">Allow pending (stable)</UiCheckbox>
          <UiButton variant="secondary" type="button" @click="pollNow" :disabled="loading">Re-check</UiButton>
        </div>
      </section>

      <section v-if="!allowed && !loading" class="relpage-no-access">
        <p>Redirecting…</p>
      </section>

      <section v-else class="relpage-grid flex-1 overflow-hidden gap-16px grid min-h-0">
        <article class="relpage-panel overflow-auto bg-primary border-1 border-radius-16px shadow-primary p-12px min-h-0">
          <div class="relpage-panel-title flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-12px pt-4px pr-4px pb-12px pl-4px">
            <span>Releases</span>
            <span class="relpage-muted color-text-tertiary fw-500">{{ filteredReleases.length }} total</span>
          </div>

          <div v-if="loading" class="relpage-panel-loading flex-align-justify-center gap-8px color-text-secondary py-24px px-8px">
            <UiSpinner size="sm" />
            <span>Loading releases…</span>
          </div>

          <div v-else-if="!filteredReleases.length" class="relpage-panel-empty flex-align-justify-center gap-8px color-text-secondary py-24px px-8px">No releases found.</div>

          <button
            v-for="r in filteredReleases"
            :key="r.id"
            type="button"
            class="relpage-row w-full text-left flex-align-center flex-justify-space-between cursor-pointer border-radius-12px gap-16px border-1-transparent bg-transparent py-10px px-12px"
            :class="{ active: selectedRelease?.id === r.id }"
            @click="selectedRelease = r"
          >
            <div class="relpage-row-main">
              <div class="relpage-row-top flex-align-center gap-8px">
                <span class="relpage-row-id color-text-tertiary text-14px">#{{ r.id }}</span>
                <span class="relpage-row-version txt-weight-medium color-text-primary">{{ r.version }}</span>
                <span class="bg-transparent border-radius-full txt-weight-strong text-12px border-1-light py-4px px-6px" :class="statusClass(r)">{{ r.status }}</span>
              </div>
              <div class="relpage-row-sub relpage-muted flex-align-center gap-8px color-text-tertiary fw-500 text-13px mt-4px">
                <span>{{ r.channel }}</span>
                <span>•</span>
                <span>{{ formatDate(r.createdAt) }}</span>
                <span v-if="r.publisher">•</span>
                <span v-if="r.publisher">{{ shortAddr(r.publisher) }}</span>
              </div>
            </div>
            <div class="relpage-row-right relpage-muted color-text-tertiary fw-500 text-13px nowrap">{{ artifactSummary(r) }}</div>
          </button>
        </article>

        <article class="relpage-panel overflow-auto bg-primary border-1 border-radius-16px shadow-primary p-12px min-h-0" v-if="selectedRelease">
          <div class="relpage-panel-title flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-12px pt-4px pr-4px pb-12px pl-4px">
            <span>Release #{{ selectedRelease.id }}</span>
            <span class="relpage-muted color-text-tertiary fw-500">{{ selectedRelease.version }} · {{ selectedRelease.channel }}</span>
          </div>

          <div v-if="selectedRelease.status === 'PENDING'" class="relpage-detail-actions flex flex-wrap-wrap gap-12px m-0px mt-8px mb-16px">
            <UiButton variant="primary" type="button" :disabled="submittingDao" @click="openDaoModal('validate')">
              Send to DAO (validate)
            </UiButton>
            <UiButton variant="secondary" type="button" :disabled="submittingDao" @click="openDaoModal('reject')">
              Send to DAO (reject)
            </UiButton>
          </div>

          <div class="relpage-detail-grid gap-12px mb-16px grid grid-cols-1fr-1fr">
            <div class="relpage-kv">
              <div class="relpage-k text-12px color-text-tertiary">Status</div>
              <div class="relpage-v color-text-primary text-14px mt-4px">
                <span class="bg-transparent border-radius-full txt-weight-strong text-12px border-1-light py-4px px-6px" :class="statusClass(selectedRelease)">{{ selectedRelease.status }}</span>
              </div>
            </div>
            <div class="relpage-kv">
              <div class="relpage-k text-12px color-text-tertiary">Publisher</div>
              <div class="relpage-v mono color-text-primary text-14px mt-4px">{{ selectedRelease.publisher || '-' }}</div>
            </div>
            <div class="relpage-kv">
              <div class="relpage-k text-12px color-text-tertiary">Created</div>
              <div class="relpage-v color-text-primary text-14px mt-4px">{{ formatDate(selectedRelease.createdAt) }}</div>
            </div>
            <div class="relpage-kv" v-if="selectedRelease.supersedes.length">
              <div class="relpage-k text-12px color-text-tertiary">Supersedes</div>
              <div class="relpage-v mono color-text-primary text-14px mt-4px">{{ selectedRelease.supersedes.join(', ') }}</div>
            </div>
          </div>

          <div class="relpage-notes pt-12px mt-12px border-top-1-light" v-if="selectedRelease.notes">
            <div class="relpage-notes-title txt-weight-medium color-text-primary mb-8px">Release notes</div>
            <div class="relpage-notes-body color-text-secondary pre-wrap">{{ selectedRelease.notes }}</div>
          </div>

          <div class="relpage-artifacts">
            <div class="relpage-notes-title txt-weight-medium color-text-primary mb-8px">Artifacts ({{ selectedRelease.artifacts.length }})</div>
            <div v-for="(a, idx) in selectedRelease.artifacts" :key="`${a.platform}-${a.kind}-${idx}`" class="relpage-artifact-card border-radius-12px border-1-light p-12px mt-12px bg-secondary">
              <div class="relpage-artifact-head flex-align-baseline flex-justify-space-between gap-12px">
                <div class="relpage-artifact-title txt-weight-medium color-text-primary">{{ a.platform }} · {{ a.kind }}</div>
                <div class="relpage-muted color-text-tertiary fw-500">{{ formatBytes(a.size) }}</div>
              </div>
              <div class="relpage-artifact-meta">
                <div class="relpage-kv">
                  <div class="relpage-k text-12px color-text-tertiary">SHA-256</div>
                  <div class="relpage-v mono break-word color-text-primary text-14px mt-4px">{{ a.sha256Hex || '-' }}</div>
                </div>
                <div class="relpage-kv" v-if="a.cid">
                  <div class="relpage-k text-12px color-text-tertiary">CID</div>
                  <div class="relpage-v mono break-word color-text-primary text-14px mt-4px">{{ a.cid }}</div>
                </div>
                <div class="relpage-kv" v-if="a.urls.length">
                  <div class="relpage-k text-12px color-text-tertiary">URLs</div>
                  <div class="relpage-v color-text-primary text-14px mt-4px">
                    <div v-for="(u, uIdx) in a.urls" :key="uIdx" class="mono break-word">{{ u }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article class="relpage-panel overflow-auto bg-primary border-1 border-radius-16px shadow-primary p-12px min-h-0" v-else>
          <div class="relpage-panel-title flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-12px pt-4px pr-4px pb-12px pl-4px">
            <span>Details</span>
            <span class="relpage-muted color-text-tertiary fw-500">Select a release</span>
          </div>
          <div class="relpage-panel-empty flex-align-justify-center gap-8px color-text-secondary py-24px px-8px">Pick a release from the list.</div>
        </article>
      </section>
    </main>

    <UiModal :model-value="daoModalOpen" title="Send to DAO" panel-class="w-min-900px-96vw" @update:model-value="closeDaoModal">
        <div class="relpage-modal-body flex flex-column gap-12px">
          <div class="relpage-form-grid gap-12px grid">
            <label class="relpage-field flex flex-column gap-6px">
              <span class="relpage-label text-12px color-text-tertiary">Action</span>
              <select v-model="daoForm.kind" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary py-8px px-10px focus-outline-none focus-border-accent focus-ring focus-shadow">
                <option value="validate">Validate release</option>
                <option value="reject">Reject release</option>
              </select>
            </label>
            <label class="relpage-field flex flex-column gap-6px">
              <span class="relpage-label text-12px color-text-tertiary">Deposit (LMN)</span>
              <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="daoForm.depositLmn" placeholder="0" class="relpage-input focus-outline-none focus-ring focus-shadow" />
            </label>
          </div>

          <label class="relpage-field flex flex-column gap-6px">
            <span class="relpage-label text-12px color-text-tertiary">Title</span>
            <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="daoForm.title" class="relpage-input focus-outline-none focus-ring focus-shadow" />
          </label>

          <label class="relpage-field flex flex-column gap-6px">
            <span class="relpage-label text-12px color-text-tertiary">Summary</span>
            <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model="daoForm.summary" rows="3" class="relpage-input focus-outline-none focus-ring focus-shadow" />
          </label>

          <label v-if="daoForm.kind === 'reject'" class="relpage-field flex flex-column gap-6px">
            <span class="relpage-label text-12px color-text-tertiary">Reason (optional)</span>
            <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model="daoForm.reason" rows="3" placeholder="Why should this release be rejected?" class="relpage-input focus-outline-none focus-ring focus-shadow" />
          </label>
        </div>

        <template #footer>
          <UiButton variant="secondary" type="button" @click="closeDaoModal" :disabled="submittingDao">Cancel</UiButton>
          <UiButton variant="primary" type="button" @click="submitDaoProposal" :disabled="submittingDao">
            <span v-if="submittingDao" class="flex-inline-align-center gap-8px"><UiSpinner size="sm" /> Sending…</span>
            <span v-else>Broadcast proposal</span>
          </UiButton>
        </template>
    </UiModal>

    <UiModal :model-value="publishModalOpen" title="Publish release" panel-class="w-min-900px-96vw" @update:model-value="closePublishModal">
        <div class="relpage-modal-body flex flex-column gap-12px">
          <div class="relpage-import-box mb-16px border-radius-16px border-1 bg-primary pt-14px pr-14px pb-4px pl-14px">
            <div class="relpage-builder-head flex-align-center flex-justify-space-between mt-8px">
              <h3>Import from GitHub release</h3>
              <UiButton variant="secondary" size="sm" type="button"
                :disabled="importingGithub || !githubReleaseUrl.trim()"
                @click="importFromGithubRelease">
                <span v-if="importingGithub" class="flex-inline-align-center gap-8px"><UiSpinner size="sm" /> Importing…</span>
                <span v-else>Auto-fill</span>
              </UiButton>
            </div>

            <label class="relpage-field flex flex-column gap-6px">
              <span class="relpage-label text-12px color-text-tertiary">GitHub release URL</span>
              <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="githubReleaseUrl"
               
                placeholder="https://github.com/network-lumen/browser/releases/tag/v0.2.8" class="relpage-input mono focus-outline-none focus-ring focus-shadow" />
              <span class="relpage-muted text-12px color-text-tertiary fw-500">Imports version, notes, and artifacts (URL/SHA/size) from GitHub + SHA256SUMS.txt.</span>
            </label>
          </div>

          <div class="relpage-form-grid gap-12px grid">
            <label class="relpage-field flex flex-column gap-6px">
              <span class="relpage-label text-12px color-text-tertiary">Version</span>
              <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="draft.version" placeholder="0.1.9" class="relpage-input focus-outline-none focus-ring focus-shadow" />
            </label>
            <label class="relpage-field flex flex-column gap-6px">
              <span class="relpage-label text-12px color-text-tertiary">Channel</span>
              <select v-model="draft.channel" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary py-8px px-10px focus-outline-none focus-border-accent focus-ring focus-shadow">
                <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="relpage-field flex flex-column gap-6px">
              <span class="relpage-label text-12px color-text-tertiary">Supersedes (IDs)</span>
              <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="draft.supersedes" placeholder="12, 13" class="relpage-input focus-outline-none focus-ring focus-shadow" />
            </label>
            <label class="relpage-field flex flex-column gap-6px">
              <span class="relpage-label text-12px color-text-tertiary">Emergency flag</span>
              <UiCheckbox v-model="draft.emergencyOk">Allow emergency rollout</UiCheckbox>
            </label>
          </div>

          <label class="relpage-field flex flex-column gap-6px">
            <span class="relpage-label text-12px color-text-tertiary">Release notes</span>
            <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model="draft.notes" rows="4" placeholder="Changelog, highlights, etc." class="relpage-input focus-outline-none focus-ring focus-shadow" />
            <span class="relpage-muted text-12px color-text-tertiary fw-500">{{ draft.notes.length }} / {{ params?.maxNotesLen || '∞' }}</span>
          </label>

          <div class="relpage-artifacts-builder">
            <div class="relpage-builder-head flex-align-center flex-justify-space-between mt-8px">
              <h3>Artifacts</h3>
              <UiButton variant="secondary" size="sm" type="button" @click="addArtifact">Add artifact</UiButton>
            </div>

            <div v-for="(a, idx) in draft.artifacts" :key="a.id" class="relpage-artifact-draft border-radius-12px border-1-light p-12px mt-12px bg-primary">
              <div class="relpage-artifact-draft-head flex-align-center flex-justify-space-between mb-8px">
                <div class="relpage-muted color-text-tertiary fw-500">Artifact #{{ idx + 1 }}</div>
                <UiButton
                  v-if="draft.artifacts.length > 1"
                  variant="secondary"
                  size="sm"
                  type="button"
                  @click="removeArtifact(idx)"
                >
                  Remove
                </UiButton>
              </div>

              <div class="relpage-form-grid gap-12px grid">
                <label class="relpage-field flex flex-column gap-6px">
                  <span class="relpage-label text-12px color-text-tertiary">Platform</span>
                  <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.platform" placeholder="windows-amd64" class="relpage-input focus-outline-none focus-ring focus-shadow" />
                </label>
                <label class="relpage-field flex flex-column gap-6px">
                  <span class="relpage-label text-12px color-text-tertiary">Kind</span>
                  <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.kind" placeholder="browser" class="relpage-input focus-outline-none focus-ring focus-shadow" />
                </label>
              </div>

              <div class="relpage-form-grid gap-12px grid">
                <label class="relpage-field flex flex-column gap-6px">
                  <span class="relpage-label text-12px color-text-tertiary">CID</span>
                  <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.cid" placeholder="Optional" class="relpage-input focus-outline-none focus-ring focus-shadow" />
                </label>
                <label class="relpage-field flex flex-column gap-6px">
                  <span class="relpage-label text-12px color-text-tertiary">SHA-256</span>
                  <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.sha256Hex" placeholder="64 hex chars" class="relpage-input focus-outline-none focus-ring focus-shadow" />
                </label>
                <label class="relpage-field flex flex-column gap-6px">
                  <span class="relpage-label text-12px color-text-tertiary">Size (bytes)</span>
                  <UiInput bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.size" placeholder="123456" class="relpage-input focus-outline-none focus-ring focus-shadow" />
                </label>
              </div>

              <label class="relpage-field flex flex-column gap-6px">
                <span class="relpage-label text-12px color-text-tertiary">URLs (one per line)</span>
                <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-md" font-size-class="txt-md" padding-class="py-8px px-10px" :focus-ring="false" v-model="a.urlsText" rows="3" placeholder="https://example.com/file.exe" class="relpage-input mono focus-outline-none focus-ring focus-shadow" />
              </label>
            </div>
          </div>
        </div>

        <template #footer>
          <UiButton variant="secondary" type="button" @click="closePublishModal" :disabled="submitting">Cancel</UiButton>
          <UiButton variant="primary" type="button" @click="submitRelease" :disabled="submitting">
            <span v-if="submitting" class="flex-inline-align-center gap-8px"><UiSpinner size="sm" /> Publishing…</span>
            <span v-else>Publish</span>
          </UiButton>
        </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';
import UiModal from '../../ui/UiModal.vue';
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import { Plus, RefreshCw, Rocket } from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiCheckbox from '../../ui/UiCheckbox.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import { addToast } from '../../stores/toastStore';
import { getActiveProfile } from '../profilesStore';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';

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
const currentTabRefresh = inject<any>('currentTabRefresh', null);

const loading = ref(true);
const params = ref<ReleaseParams | null>(null);
const releases = ref<ReleaseRecord[]>([]);
const selectedRelease = ref<ReleaseRecord | null>(null);

useTabLoadingSync(loading);

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

function safeString(v: any, maxLen = 4096) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
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
  } catch (e: any) {
    addToast('error', String(e?.message || e || 'Import failed'));
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
  } catch (e: any) {
    addToast('error', String(e?.message || e));
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
  } catch (e: any) {
    addToast('error', String(e?.message || e || 'Publish failed'));
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
  } catch (e: any) {
    addToast('error', String(e?.message || e || 'Unable to apply test options'));
  }
}

async function pollNow() {
  try {
    const api = useInternalLumen()?.release?.pollNow;
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
  if (r.yanked) return 'badge-error color-error';
  if (status.includes('REJECT') || status.includes('EXPIRE')) return 'badge-warning color-warning';
  if (status.includes('VALID')) return 'badge-success color-success';
  return 'badge-info color-primary';
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
