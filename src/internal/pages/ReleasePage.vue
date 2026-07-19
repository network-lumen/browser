<template>
  <div class="release-page internal-page">
    <InternalSidebar title="Releases" :icon="Rocket" activeKey="release">
      <nav class="lsb-nav flex flex-column gap-75">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Manage</span>
          <button type="button" class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015" :class="{ active: true }">
            <Rocket :size="18" />
            <span>Publisher</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <main class="relpage-main flex-1 min-w-0 flex flex-column overflow-hidden bg-secondary padding-200-250">
      <header class="relpage-content-header flex-align-start flex-justify-space-between gap-100 flex-wrap-wrap margin-bottom-100">
        <div class="relpage-header-left">
          <h1 class="margin-0 txt-weight-strong color-text-primary relpage-header-left-h1 fs-175rem">Releases</h1>
          <p class="relpage-header-left-p color-text-secondary fs-14px" v-if="allowed">Publisher access enabled for the active profile.</p>
          <p class="relpage-header-left-p color-text-secondary fs-14px" v-else-if="loading">Checking publisher permissions…</p>
          <p class="relpage-header-left-p color-text-secondary fs-14px" v-else>Publisher access required.</p>
          <p v-if="pendingTtlSeconds" class="relpage-header-meta color-text-tertiary fs-13px relpage-header-left-p color-text-secondary fs-14px">
            Pending TTL: {{ formatDuration(pendingTtlSeconds) }}
          </p>
        </div>
        <div class="relpage-header-actions flex-inline-align-center gap-75 flex-wrap-wrap flex-0-0-auto">
          <button type="button" class="relpage-btn-secondary flex-inline-align-center gap-50 border-radius-10px cursor-pointer color-text-secondary border-1 bg-primary fs-14px fw-650 padding-75-100" :disabled="loading" @click="refreshAll">
            <RefreshCw :size="18" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
          <button type="button" class="relpage-btn-primary flex-inline-align-center gap-50 border-radius-10px cursor-pointer border-none color-white bg-gradient-primary shadow-primary fs-14px fw-650 padding-75-100" :disabled="loading || !allowed" @click="openPublishModal">
            <Plus :size="18" />
            <span>Publish release</span>
          </button>
        </div>
      </header>

      <section class="relpage-toolbar flex flex-wrap-wrap margin-bottom-100 flex-align-end gap-90-100" aria-label="Filters">
        <div class="relpage-filter flex flex-column gap-35">
          <label class="relpage-filter-label txt-weight-strong color-text-tertiary text-uppercase fs-12px">Channel</label>
          <select v-model="channelFilter" class="relpage-form-input w-full fs-085rem color-text-primary border-radius-12px border-1 bg-primary padding-62-75" :disabled="loading">
            <option value="all">All</option>
            <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="relpage-filter grow flex flex-column gap-35">
          <label class="relpage-filter-label txt-weight-strong color-text-tertiary text-uppercase fs-12px">Search</label>
          <input
            v-model.trim="searchTerm"
            class="relpage-form-input w-full fs-085rem color-text-primary border-radius-12px border-1 bg-primary padding-62-75"
            placeholder="Version, publisher, ID…"
            :disabled="loading"
          />
        </div>

        <div v-if="testMode.enabled" class="relpage-test-tools flex-align-center gap-75 flex-wrap-wrap border-radius-14px border-1 bg-primary padding-50-75" aria-label="Update test tools">
          <span class="relpage-test-label txt-weight-strong color-text-tertiary text-uppercase fs-12px">Update test</span>
          <label class="relpage-test-check flex-inline-align-center color-text-secondary gap-35 fs-13px">
            <input type="checkbox" v-model="testMode.forcePrompt" @change="applyTestMode" :disabled="loading" />
            <span>Force prompt</span>
          </label>
          <label class="relpage-test-check flex-inline-align-center color-text-secondary gap-35 fs-13px">
            <input type="checkbox" v-model="testMode.allowUnvalidatedStable" @change="applyTestMode" :disabled="loading" />
            <span>Allow pending (stable)</span>
          </label>
          <button type="button" class="relpage-btn-secondary flex-inline-align-center gap-50 border-radius-10px cursor-pointer color-text-secondary border-1 bg-primary fs-14px fw-650 padding-75-100" @click="pollNow" :disabled="loading">Re-check</button>
        </div>
      </section>

      <section v-if="!allowed && !loading" class="relpage-no-access">
        <p>Redirecting…</p>
      </section>

      <section v-else class="relpage-grid flex-1 overflow-hidden gap-100 grid min-h-0">
        <article class="relpage-panel overflow-auto bg-primary border-1 border-radius-16px shadow-primary padding-75 min-h-0">
          <div class="relpage-panel-title flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-75">
            <span>Releases</span>
            <span class="relpage-muted color-text-tertiary fw-500">{{ filteredReleases.length }} total</span>
          </div>

          <div v-if="loading" class="relpage-panel-loading flex-align-justify-center gap-50 color-text-secondary">
            <UiSpinner size="sm" />
            <span>Loading releases…</span>
          </div>

          <div v-else-if="!filteredReleases.length" class="relpage-panel-empty flex-align-justify-center gap-50 color-text-secondary">No releases found.</div>

          <button
            v-for="r in filteredReleases"
            :key="r.id"
            type="button"
            class="relpage-row w-full text-left flex-align-center flex-justify-space-between cursor-pointer border-radius-12px gap-100 border-1-transparent bg-transparent padding-62-75"
            :class="{ active: selectedRelease?.id === r.id }"
            @click="selectedRelease = r"
          >
            <div class="relpage-row-main">
              <div class="relpage-row-top flex-align-center gap-50">
                <span class="relpage-row-id color-text-tertiary fs-085rem">#{{ r.id }}</span>
                <span class="relpage-row-version txt-weight-medium color-text-primary">{{ r.version }}</span>
                <span class="relpage-chip border-radius-full fs-12px border-1-light bg-secondary" :class="statusClass(r)">{{ r.status }}</span>
              </div>
              <div class="relpage-row-sub relpage-muted flex-align-center gap-50 color-text-tertiary fw-500 fs-13px margin-top-25">
                <span>{{ r.channel }}</span>
                <span>•</span>
                <span>{{ formatDate(r.createdAt) }}</span>
                <span v-if="r.publisher">•</span>
                <span v-if="r.publisher">{{ shortAddr(r.publisher) }}</span>
              </div>
            </div>
            <div class="relpage-row-right relpage-muted color-text-tertiary fw-500 fs-13px nowrap">{{ artifactSummary(r) }}</div>
          </button>
        </article>

        <article class="relpage-panel overflow-auto bg-primary border-1 border-radius-16px shadow-primary padding-75 min-h-0" v-if="selectedRelease">
          <div class="relpage-panel-title flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-75">
            <span>Release #{{ selectedRelease.id }}</span>
            <span class="relpage-muted color-text-tertiary fw-500">{{ selectedRelease.version }} · {{ selectedRelease.channel }}</span>
          </div>

          <div v-if="selectedRelease.status === 'PENDING'" class="relpage-detail-actions flex flex-wrap-wrap gap-75">
            <button type="button" class="relpage-btn-primary flex-inline-align-center gap-50 border-radius-10px cursor-pointer border-none color-white bg-gradient-primary shadow-primary fs-14px fw-650 padding-75-100" :disabled="submittingDao" @click="openDaoModal('validate')">
              Send to DAO (validate)
            </button>
            <button type="button" class="relpage-btn-secondary flex-inline-align-center gap-50 border-radius-10px cursor-pointer color-text-secondary border-1 bg-primary fs-14px fw-650 padding-75-100" :disabled="submittingDao" @click="openDaoModal('reject')">
              Send to DAO (reject)
            </button>
          </div>

          <div class="relpage-detail-grid gap-75 margin-bottom-100 grid">
            <div class="relpage-kv">
              <div class="relpage-k fs-075rem color-text-tertiary">Status</div>
              <div class="relpage-v color-text-primary fs-14px margin-top-25">
                <span class="relpage-chip border-radius-full fs-12px border-1-light bg-secondary" :class="statusClass(selectedRelease)">{{ selectedRelease.status }}</span>
              </div>
            </div>
            <div class="relpage-kv">
              <div class="relpage-k fs-075rem color-text-tertiary">Publisher</div>
              <div class="relpage-v mono color-text-primary fs-14px margin-top-25">{{ selectedRelease.publisher || '-' }}</div>
            </div>
            <div class="relpage-kv">
              <div class="relpage-k fs-075rem color-text-tertiary">Created</div>
              <div class="relpage-v color-text-primary fs-14px margin-top-25">{{ formatDate(selectedRelease.createdAt) }}</div>
            </div>
            <div class="relpage-kv" v-if="selectedRelease.supersedes.length">
              <div class="relpage-k fs-075rem color-text-tertiary">Supersedes</div>
              <div class="relpage-v mono color-text-primary fs-14px margin-top-25">{{ selectedRelease.supersedes.join(', ') }}</div>
            </div>
          </div>

          <div class="relpage-notes padding-top-75 margin-top-75 border-top-1-light" v-if="selectedRelease.notes">
            <div class="relpage-notes-title txt-weight-medium color-text-primary margin-bottom-50">Release notes</div>
            <div class="relpage-notes-body color-text-secondary pre-wrap">{{ selectedRelease.notes }}</div>
          </div>

          <div class="relpage-artifacts">
            <div class="relpage-notes-title txt-weight-medium color-text-primary margin-bottom-50">Artifacts ({{ selectedRelease.artifacts.length }})</div>
            <div v-for="(a, idx) in selectedRelease.artifacts" :key="`${a.platform}-${a.kind}-${idx}`" class="relpage-artifact-card border-radius-12px border-1-light padding-75 margin-top-75 bg-secondary">
              <div class="relpage-artifact-head flex-align-baseline flex-justify-space-between gap-75">
                <div class="relpage-artifact-title txt-weight-medium color-text-primary">{{ a.platform }} · {{ a.kind }}</div>
                <div class="relpage-muted color-text-tertiary fw-500">{{ formatBytes(a.size) }}</div>
              </div>
              <div class="relpage-artifact-meta">
                <div class="relpage-kv">
                  <div class="relpage-k fs-075rem color-text-tertiary">SHA-256</div>
                  <div class="relpage-v mono break-word color-text-primary fs-14px margin-top-25">{{ a.sha256Hex || '-' }}</div>
                </div>
                <div class="relpage-kv" v-if="a.cid">
                  <div class="relpage-k fs-075rem color-text-tertiary">CID</div>
                  <div class="relpage-v mono break-word color-text-primary fs-14px margin-top-25">{{ a.cid }}</div>
                </div>
                <div class="relpage-kv" v-if="a.urls.length">
                  <div class="relpage-k fs-075rem color-text-tertiary">URLs</div>
                  <div class="relpage-v color-text-primary fs-14px margin-top-25">
                    <div v-for="(u, uIdx) in a.urls" :key="uIdx" class="mono break-word">{{ u }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article class="relpage-panel overflow-auto bg-primary border-1 border-radius-16px shadow-primary padding-75 min-h-0" v-else>
          <div class="relpage-panel-title flex-align-baseline flex-justify-space-between txt-weight-medium color-text-primary gap-75">
            <span>Details</span>
            <span class="relpage-muted color-text-tertiary fw-500">Select a release</span>
          </div>
          <div class="relpage-panel-empty flex-align-justify-center gap-50 color-text-secondary">Pick a release from the list.</div>
        </article>
      </section>
    </main>

    <div v-if="daoModalOpen" class="overlay-scrim relpage-modal-overlay padding-100 bg-black-a35" @click.self="closeDaoModal">
      <div class="relpage-modal overflow-auto border-radius-18px padding-125 bg-primary border-1 shadow-primary-lg">
        <div class="relpage-modal-head flex-align-center flex-justify-space-between gap-100 padding-bottom-75 border-bottom-1-light">
          <h2 class="relpage-modal-head-h2 margin-0 fs-19px">Send to DAO</h2>
          <button type="button" class="relpage-modal-close cursor-pointer color-text-secondary border-radius-10px border-1-light bg-transparent fs-125rem w-34px" @click="closeDaoModal">×</button>
        </div>

        <div class="relpage-modal-body flex flex-column gap-75">
          <div class="relpage-form-grid gap-75 grid">
            <label class="relpage-field flex flex-column gap-35">
              <span class="relpage-label fs-075rem color-text-tertiary">Action</span>
              <select v-model="daoForm.kind" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62">
                <option value="validate">Validate release</option>
                <option value="reject">Reject release</option>
              </select>
            </label>
            <label class="relpage-field flex flex-column gap-35">
              <span class="relpage-label fs-075rem color-text-tertiary">Deposit (LMN)</span>
              <input v-model.trim="daoForm.depositLmn" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" placeholder="0" />
            </label>
          </div>

          <label class="relpage-field flex flex-column gap-35">
            <span class="relpage-label fs-075rem color-text-tertiary">Title</span>
            <input v-model.trim="daoForm.title" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" />
          </label>

          <label class="relpage-field flex flex-column gap-35">
            <span class="relpage-label fs-075rem color-text-tertiary">Summary</span>
            <textarea v-model="daoForm.summary" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" rows="3" />
          </label>

          <label v-if="daoForm.kind === 'reject'" class="relpage-field flex flex-column gap-35">
            <span class="relpage-label fs-075rem color-text-tertiary">Reason (optional)</span>
            <textarea v-model="daoForm.reason" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" rows="3" placeholder="Why should this release be rejected?" />
          </label>
        </div>

        <div class="relpage-modal-foot flex flex-justify-end gap-75 padding-top-75 border-top-1-light">
          <button type="button" class="relpage-btn-secondary flex-inline-align-center gap-50 border-radius-10px cursor-pointer color-text-secondary border-1 bg-primary fs-14px fw-650 padding-75-100" @click="closeDaoModal" :disabled="submittingDao">Cancel</button>
          <button type="button" class="relpage-btn-primary flex-inline-align-center gap-50 border-radius-10px cursor-pointer border-none color-white bg-gradient-primary shadow-primary fs-14px fw-650 padding-75-100" @click="submitDaoProposal" :disabled="submittingDao">
            <span v-if="submittingDao" class="flex-inline-align-center gap-50"><UiSpinner size="sm" /> Sending…</span>
            <span v-else>Broadcast proposal</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="publishModalOpen" class="overlay-scrim relpage-modal-overlay padding-100 bg-black-a35" @click.self="closePublishModal">
      <div class="relpage-modal overflow-auto border-radius-18px padding-125 bg-primary border-1 shadow-primary-lg">
        <div class="relpage-modal-head flex-align-center flex-justify-space-between gap-100 padding-bottom-75 border-bottom-1-light">
          <h2 class="relpage-modal-head-h2 margin-0 fs-19px">Publish release</h2>
          <button type="button" class="relpage-modal-close cursor-pointer color-text-secondary border-radius-10px border-1-light bg-transparent fs-125rem w-34px" @click="closePublishModal">×</button>
        </div>

        <div class="relpage-modal-body flex flex-column gap-75">
          <div class="relpage-import-box margin-bottom-100 border-radius-16px border-1 bg-primary">
            <div class="relpage-builder-head flex-align-center flex-justify-space-between margin-top-50">
              <h3>Import from GitHub release</h3>
              <button
                type="button"
                class="relpage-btn-secondary relpage-btn-sm flex-inline-align-center gap-50 border-radius-10px cursor-pointer color-text-secondary border-1 bg-primary fs-13px fs-14px fw-650 padding-75-100 padding-50-75"
                :disabled="importingGithub || !githubReleaseUrl.trim()"
                @click="importFromGithubRelease"
              >
                <span v-if="importingGithub" class="flex-inline-align-center gap-50"><UiSpinner size="sm" /> Importing…</span>
                <span v-else>Auto-fill</span>
              </button>
            </div>

            <label class="relpage-field flex flex-column gap-35">
              <span class="relpage-label fs-075rem color-text-tertiary">GitHub release URL</span>
              <input
                v-model.trim="githubReleaseUrl"
                class="relpage-input mono w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62"
                placeholder="https://github.com/network-lumen/browser/releases/tag/v0.2.8"
              />
              <span class="relpage-muted fs-075rem color-text-tertiary fw-500">Imports version, notes, and artifacts (URL/SHA/size) from GitHub + SHA256SUMS.txt.</span>
            </label>
          </div>

          <div class="relpage-form-grid gap-75 grid">
            <label class="relpage-field flex flex-column gap-35">
              <span class="relpage-label fs-075rem color-text-tertiary">Version</span>
              <input v-model.trim="draft.version" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" placeholder="0.1.9" />
            </label>
            <label class="relpage-field flex flex-column gap-35">
              <span class="relpage-label fs-075rem color-text-tertiary">Channel</span>
              <select v-model="draft.channel" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62">
                <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="relpage-field flex flex-column gap-35">
              <span class="relpage-label fs-075rem color-text-tertiary">Supersedes (IDs)</span>
              <input v-model.trim="draft.supersedes" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" placeholder="12, 13" />
            </label>
            <label class="relpage-field flex flex-column gap-35">
              <span class="relpage-label fs-075rem color-text-tertiary">Emergency flag</span>
              <label class="relpage-checkbox-row flex-align-center color-text-secondary gap-50 fs-085rem">
                <input type="checkbox" v-model="draft.emergencyOk" />
                <span>Allow emergency rollout</span>
              </label>
            </label>
          </div>

          <label class="relpage-field flex flex-column gap-35">
            <span class="relpage-label fs-075rem color-text-tertiary">Release notes</span>
            <textarea v-model="draft.notes" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" rows="4" placeholder="Changelog, highlights, etc." />
            <span class="relpage-muted fs-075rem color-text-tertiary fw-500">{{ draft.notes.length }} / {{ params?.maxNotesLen || '∞' }}</span>
          </label>

          <div class="relpage-artifacts-builder">
            <div class="relpage-builder-head flex-align-center flex-justify-space-between margin-top-50">
              <h3>Artifacts</h3>
              <button type="button" class="relpage-btn-secondary relpage-btn-sm flex-inline-align-center gap-50 border-radius-10px cursor-pointer color-text-secondary border-1 bg-primary fs-13px fs-14px fw-650 padding-75-100 padding-50-75" @click="addArtifact">Add artifact</button>
            </div>

            <div v-for="(a, idx) in draft.artifacts" :key="a.id" class="relpage-artifact-draft border-radius-12px border-1-light padding-75 margin-top-75 bg-primary">
              <div class="relpage-artifact-draft-head flex-align-center flex-justify-space-between margin-bottom-50">
                <div class="relpage-muted color-text-tertiary fw-500">Artifact #{{ idx + 1 }}</div>
                <button
                  v-if="draft.artifacts.length > 1"
                  type="button"
                  class="relpage-btn-secondary relpage-btn-sm flex-inline-align-center gap-50 border-radius-10px cursor-pointer color-text-secondary border-1 bg-primary fs-13px fs-14px fw-650 padding-75-100 padding-50-75"
                  @click="removeArtifact(idx)"
                >
                  Remove
                </button>
              </div>

              <div class="relpage-form-grid gap-75 grid">
                <label class="relpage-field flex flex-column gap-35">
                  <span class="relpage-label fs-075rem color-text-tertiary">Platform</span>
                  <input v-model.trim="a.platform" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" placeholder="windows-amd64" />
                </label>
                <label class="relpage-field flex flex-column gap-35">
                  <span class="relpage-label fs-075rem color-text-tertiary">Kind</span>
                  <input v-model.trim="a.kind" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" placeholder="browser" />
                </label>
              </div>

              <div class="relpage-form-grid gap-75 grid">
                <label class="relpage-field flex flex-column gap-35">
                  <span class="relpage-label fs-075rem color-text-tertiary">CID</span>
                  <input v-model.trim="a.cid" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" placeholder="Optional" />
                </label>
                <label class="relpage-field flex flex-column gap-35">
                  <span class="relpage-label fs-075rem color-text-tertiary">SHA-256</span>
                  <input v-model.trim="a.sha256Hex" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" placeholder="64 hex chars" />
                </label>
                <label class="relpage-field flex flex-column gap-35">
                  <span class="relpage-label fs-075rem color-text-tertiary">Size (bytes)</span>
                  <input v-model.trim="a.size" class="relpage-input w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" placeholder="123456" />
                </label>
              </div>

              <label class="relpage-field flex flex-column gap-35">
                <span class="relpage-label fs-075rem color-text-tertiary">URLs (one per line)</span>
                <textarea v-model="a.urlsText" class="relpage-input mono w-full border-radius-md color-text-primary txt-md border-1 bg-secondary padding-50-62" rows="3" placeholder="https://example.com/file.exe" />
              </label>
            </div>
          </div>
        </div>

        <div class="relpage-modal-foot flex flex-justify-end gap-75 padding-top-75 border-top-1-light">
          <button type="button" class="relpage-btn-secondary flex-inline-align-center gap-50 border-radius-10px cursor-pointer color-text-secondary border-1 bg-primary fs-14px fw-650 padding-75-100" @click="closePublishModal" :disabled="submitting">Cancel</button>
          <button type="button" class="relpage-btn-primary flex-inline-align-center gap-50 border-radius-10px cursor-pointer border-none color-white bg-gradient-primary shadow-primary fs-14px fw-650 padding-75-100" @click="submitRelease" :disabled="submitting">
            <span v-if="submitting" class="flex-inline-align-center gap-50"><UiSpinner size="sm" /> Publishing…</span>
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
