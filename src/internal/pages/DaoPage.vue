<template>
  <div class="dao-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="DAO" :icon="Users" activeKey="dao">
      <nav class="lsb-nav flex flex-column gap-75">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Governance</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'proposals' }"
            @click="currentView = 'proposals'"
          >
            <FileText :size="18" />
            <span>Proposals</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'voting' }"
            @click="currentView = 'voting'"
          >
            <Vote :size="18" />
            <span>Voting</span>
          </button>
        </div>

        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Treasury</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'treasury' }"
            @click="currentView = 'treasury'"
          >
            <Wallet :size="18" />
            <span>Treasury</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'members' }"
            @click="currentView = 'members'"
          >
            <Users :size="18" />
            <span>Members</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="daopage-main flex-1 min-w-0 flex flex-column overflow-hidden bg-secondary margin-0 padding-200-250">
      <!-- Header -->
      <header class="daopage-content-header flex-align-start flex-justify-space-between margin-bottom-150">
        <div>
          <h1 class="txt-weight-medium color-text-primary margin-0 daopage-content-header-h1 fs-175rem">{{ getViewTitle() }}</h1>
          <p class="color-text-secondary daopage-content-header-p fs-14px margin-0 margin-top-25">{{ getViewDescription() }}</p>
        </div>
        <button v-if="currentView === 'proposals'" class="daopage-btn-primary flex-align-center gap-50 border-none color-white cursor-pointer border-radius-10px txt-weight-light padding-75-125 bg-gradient-primary fs-14px transition-all-02 hover-lift-2" @click="openCreateProposalModal">
          <Plus :size="18" />
          New Proposal
        </button>
      </header>

      <!-- Loading State -->
      <div v-if="isLoading" class="daopage-loading-state flex flex-column flex-align-justify-center color-text-secondary padding-400-200">
        <div class="daopage-spinner spinning border-radius-full margin-bottom-100 size-40px border-3"></div>
        <p>Loading governance data...</p>
      </div>

      <template v-else>
        <!-- Stats Grid -->
        <div class="daopage-stats-grid margin-bottom-150 gap-100 grid">
          <div class="daopage-stat-card flex-align-center gap-100 padding-125 border-radius-12px">
            <div class="daopage-stat-icon flex-align-justify-center color-white border-radius-10px bg-gradient-primary w-44px">
              <FileText :size="20" />
            </div>
            <div class="daopage-stat-info flex flex-column">
              <span class="daopage-stat-value txt-weight-medium color-text-primary fs-125rem">{{ activeProposalsCount }}</span>
              <span class="daopage-stat-label text-uppercase color-text-secondary fs-075rem">Active Proposals</span>
            </div>
          </div>
          <div class="daopage-stat-card flex-align-center gap-100 padding-125 border-radius-12px">
            <div class="daopage-stat-icon flex-align-justify-center color-white border-radius-10px bg-gradient-primary w-44px">
              <Users :size="20" />
            </div>
            <div class="daopage-stat-info flex flex-column">
              <span class="daopage-stat-value txt-weight-medium color-text-primary fs-125rem">{{ totalMembers }}</span>
              <span class="daopage-stat-label text-uppercase color-text-secondary fs-075rem">Validators</span>
            </div>
          </div>
          <div class="daopage-stat-card flex-align-center gap-100 padding-125 border-radius-12px">
            <div class="daopage-stat-icon flex-align-justify-center color-white border-radius-10px bg-gradient-primary w-44px">
              <Wallet :size="20" />
            </div>
            <div class="daopage-stat-info flex flex-column">
              <span class="daopage-stat-value txt-weight-medium color-text-primary fs-125rem">{{ treasuryBalance }} LUM</span>
              <span class="daopage-stat-label text-uppercase color-text-secondary fs-075rem">Community Pool</span>
            </div>
          </div>
        </div>

        <!-- Proposals View -->
        <div v-if="currentView === 'proposals'" class="daopage-content-area flex-1 overflow-y-auto">
          <div v-if="proposals.length === 0" class="daopage-empty-state flex flex-column flex-align-justify-center color-text-tertiary text-center padding-400-200">
            <FileText :size="48" />
            <p>No proposals found</p>
          </div>
          <div v-else class="proposals-list flex flex-column gap-100">
            <div class="daopage-proposal-card padding-150 border-radius-12px border-1" v-for="proposal in proposals" :key="proposal.id">
              <div class="daopage-proposal-header flex-align-center flex-justify-space-between margin-bottom-75">
                <span class="daopage-proposal-id color-text-secondary fs-13px">#{{ proposal.id }}</span>
                <span class="daopage-proposal-status border-radius-20px fw-500 fs-075rem padding-25-75" :class="getProposalStatusClass(proposal.status)">
                  {{ getProposalStatusText(proposal.status) }}
                </span>
              </div>
              <h3 class="daopage-proposal-title color-text-primary fs-11rem txt-weight-light margin-0 margin-bottom-50">{{ proposal.title }}</h3>
              <p class="daopage-proposal-desc color-text-secondary fs-14px margin-0 margin-bottom-100">{{ proposal.description.substring(0, 150) }}{{ proposal.description.length > 150 ? '...' : '' }}</p>
              <div class="daopage-proposal-footer flex-align-center flex-justify-space-between">
                <div class="daopage-proposal-votes flex gap-100 fs-13px">
                  <span class="color-success">{{ calculateVotePercentage(proposal, 'yes').toFixed(0) }}% Yes</span>
                  <span class="color-error">{{ calculateVotePercentage(proposal, 'no').toFixed(0) }}% No</span>
                </div>
                <button class="daopage-btn-secondary cursor-pointer color-text-secondary padding-50-100 bg-hover border-1 border-radius-8px fs-13px transition-all-02 hover-color-text-primary" @click="openVoteModal(proposal)">
                  {{ proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD' ? 'Vote' : 'View Details' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Voting View -->
        <div v-else-if="currentView === 'voting'" class="daopage-content-area flex-1 overflow-y-auto">
          <div class="daopage-info-card text-center padding-200 bg-card border-radius-16px">
            <h3 class="txt-weight-light color-text-secondary daopage-info-card-h3 fs-16px margin-0 margin-bottom-50">Active Voting Proposals</h3>
            <p class="daopage-voting-desc color-text-secondary margin-0 fs-14px">Select a proposal from the Proposals tab to vote</p>
          </div>
          <div class="proposals-list flex flex-column gap-100 margin-top-100">
            <div
              class="daopage-proposal-card padding-150 border-radius-12px border-1"
              v-for="proposal in proposals.filter(p => p.status === 'PROPOSAL_STATUS_VOTING_PERIOD')"
              :key="proposal.id"
            >
              <div class="daopage-proposal-header flex-align-center flex-justify-space-between margin-bottom-75">
                <span class="daopage-proposal-id color-text-secondary fs-13px">#{{ proposal.id }}</span>
                <span class="daopage-proposal-status active border-radius-20px fw-500 fs-075rem padding-25-75 color-accent-secondary">Voting</span>
              </div>
              <h3 class="daopage-proposal-title color-text-primary fs-11rem txt-weight-light margin-0 margin-bottom-50">{{ proposal.title }}</h3>
              <div class="daopage-proposal-footer flex-align-center flex-justify-space-between">
                <div class="daopage-vote-progress flex-1 flex flex-column gap-25">
                  <div class="daopage-progress-bar-container overflow-hidden bg-border border-radius-4px">
                    <div class="daopage-progress-yes h-full border-radius-4px transition-width-03" :style="{ width: calculateVotePercentage(proposal, 'yes') + '%' }"></div>
                  </div>
                  <span class="daopage-progress-label color-text-secondary fs-075rem">{{ calculateVotePercentage(proposal, 'yes').toFixed(1) }}% Yes</span>
                </div>
                <button class="daopage-btn-primary flex-align-center gap-50 border-none color-white cursor-pointer border-radius-10px txt-weight-light padding-75-125 bg-gradient-primary fs-14px transition-all-02 hover-lift-2" @click="openVoteModal(proposal)">
                  <Vote :size="16" />
                  Vote Now
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Treasury View -->
        <div v-else-if="currentView === 'treasury'" class="daopage-content-area flex-1 overflow-y-auto">
          <div v-if="treasuryAssets.length === 0" class="daopage-empty-state flex flex-column flex-align-justify-center color-text-tertiary text-center padding-400-200">
            <Wallet :size="48" />
            <p>No treasury assets found</p>
          </div>
          <div v-else class="treasury-list flex flex-column gap-75">
            <div class="daopage-treasury-item flex-align-center flex-justify-space-between padding-125 border-radius-12px border-1" v-for="asset in treasuryAssets" :key="asset.denom">
              <div class="asset-info flex flex-column gap-25">
                <span class="daopage-asset-name color-text-primary txt-weight-light fs-14px">{{ asset.displayName }}</span>
                <span class="daopage-asset-value color-text-secondary fs-13px">{{ formatAmount(asset.amount) }} {{ asset.denom === 'ulumen' ? 'LUM' : asset.denom }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Members View -->
        <div v-else-if="currentView === 'members'" class="daopage-content-area flex-1 overflow-y-auto">
          <div v-if="members.length === 0" class="daopage-empty-state flex flex-column flex-align-justify-center color-text-tertiary text-center padding-400-200">
            <Users :size="48" />
            <p>No validators found</p>
          </div>
          <div v-else class="members-list flex flex-column gap-50">
            <div class="daopage-member-item flex-align-center gap-100 padding-100 border-radius-12px border-1 transition-all-02" v-for="(member, index) in members" :key="member.address">
              <div class="daopage-member-rank flex-align-justify-center color-text-secondary txt-weight-light h-24px bg-tertiary border-radius-6px fs-075rem min-w-24px">{{ index + 1 }}</div>
              <div class="daopage-member-avatar flex-align-justify-center color-white overflow-hidden border-radius-full size-40px txt-weight-light bg-gradient-primary min-w-40px" :class="{ 'has-image': member.avatar }">
                <img v-if="member.avatar" :src="member.avatar" :alt="member.moniker" class="w-full h-full object-fit-cover border-radius-full" />
                <span v-else>{{ member.moniker.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="daopage-member-info flex flex-column flex-1">
                <span class="daopage-member-name color-text-primary txt-weight-light fs-14px">{{ member.moniker }}</span>
                <span class="daopage-member-address color-text-tertiary fs-075rem mono">{{ shortenAddress(member.address) }}</span>
              </div>
              <div class="daopage-member-power txt-weight-light color-primary fs-14px nowrap">{{ formatTokens(member.tokens) }} LUM</div>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- Create Proposal Modal -->
    <Transition name="fade">
      <div v-if="showCreateProposalModal" class="overlay-scrim z-1000 padding-100" @click="closeCreateProposalModal">
        <div class="daopage-modal-content large w-full overflow-y-auto border-radius-16px shadow-modal max-h-90vh max-w-520px max-w-640px" @click.stop>
          <div class="daopage-modal-header flex-align-center flex-justify-space-between padding-150 border-bottom-1">
            <h3 class="margin-0 txt-weight-light color-text-primary daopage-modal-header-h3 fs-125rem">Create Proposal</h3>
            <button class="daopage-modal-close flex-align-justify-center border-none color-text-secondary cursor-pointer size-32px border-radius-8px bg-hover transition-all-02 hover-color-text-primary" @click="closeCreateProposalModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="daopage-modal-body padding-150">
            <p class="daopage-modal-desc color-text-secondary margin-bottom-150 fs-14px">Submit a proposal for DAO governance</p>

            <div class="daopage-form-group margin-bottom-125">
              <label class="txt-weight-light color-text-primary daopage-form-group-label block fs-13px margin-bottom-50">Proposal Title</label>
              <input type="text" class="daopage-form-input w-full padding-87 border-1 border-radius-10px fs-14px color-text-primary transition-all-02 focus-outline-none focus-border-accent focus-ring focus-shadow" v-model="proposalForm.title" placeholder="Enter proposal title..." />
            </div>

            <div class="daopage-form-group margin-bottom-125">
              <label class="txt-weight-light color-text-primary daopage-form-group-label block fs-13px margin-bottom-50">Description</label>
              <textarea class="daopage-form-textarea w-full padding-87 border-1 border-radius-10px fs-14px color-text-primary transition-all-02 font-inherit focus-outline-none focus-border-accent focus-ring focus-shadow" v-model="proposalForm.description" rows="6" placeholder="Describe your proposal in detail..."></textarea>
            </div>

            <div class="daopage-form-group margin-bottom-125">
              <label class="txt-weight-light color-text-primary daopage-form-group-label block fs-13px margin-bottom-50">Category</label>
              <select class="daopage-form-select cursor-pointer w-full padding-87 border-1 border-radius-10px fs-14px color-text-primary transition-all-02 hover-border-color focus-outline-none focus-border-accent focus-ring focus-shadow" v-model="proposalForm.category">
                <option value="governance">Governance</option>
                <option value="treasury">Treasury</option>
                <option value="technical">Technical</option>
                <option value="marketing">Marketing</option>
                <option value="community">Community</option>
              </select>
            </div>

            <div class="daopage-form-group margin-bottom-125">
              <label class="txt-weight-light color-text-primary daopage-form-group-label block fs-13px margin-bottom-50">Voting Duration</label>
              <select class="daopage-form-select cursor-pointer w-full padding-87 border-1 border-radius-10px fs-14px color-text-primary transition-all-02 hover-border-color focus-outline-none focus-border-accent focus-ring focus-shadow" v-model="proposalForm.duration">
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>

            <div class="daopage-proposal-requirements margin-bottom-150 border-radius-10px padding-100 bg-card border-1-ios-blue-a3">
              <div class="daopage-requirement-item flex-align-center gap-75 color-text-secondary fs-13px padding-0 padding-top-50 padding-bottom-50">
                <svg class="daopage-requirement-item-svg flex-shrink-0 color-primary" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM6.4 12L2.4 8L3.52 6.88L6.4 9.76L12.48 3.68L13.6 4.8L6.4 12Z"/>
                </svg>
                <span>Minimum 1000 LMN required to submit</span>
              </div>
              <div class="daopage-requirement-item flex-align-center gap-75 color-text-secondary fs-13px padding-0 padding-top-50 padding-bottom-50">
                <svg class="daopage-requirement-item-svg flex-shrink-0 color-primary" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM6.4 12L2.4 8L3.52 6.88L6.4 9.76L12.48 3.68L13.6 4.8L6.4 12Z"/>
                </svg>
                <span>Proposal fee: 10 LMN</span>
              </div>
            </div>

            <button class="daopage-btn-modal-primary w-full flex-align-justify-center gap-50 border-none color-white cursor-pointer border-radius-10px fw-500 padding-87 bg-gradient-primary fs-15px transition-all-02 hover-lift-1" @click="submitProposal" :disabled="!canSubmitProposal()">
              <Plus :size="18" />
              Submit Proposal
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Vote Modal -->
    <Transition name="fade">
      <div v-if="showVoteModal" class="overlay-scrim z-1000 padding-100" @click="closeVoteModal">
        <div class="daopage-modal-content w-full overflow-y-auto border-radius-16px shadow-modal max-h-90vh max-w-520px" @click.stop>
          <div class="daopage-modal-header flex-align-center flex-justify-space-between padding-150 border-bottom-1">
            <h3 class="margin-0 txt-weight-light color-text-primary daopage-modal-header-h3 fs-125rem">Cast Your Vote</h3>
            <button class="daopage-modal-close flex-align-justify-center border-none color-text-secondary cursor-pointer size-32px border-radius-8px bg-hover transition-all-02 hover-color-text-primary" @click="closeVoteModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="daopage-modal-body padding-150">
            <div class="daopage-proposal-title-card flex-align-center flex-justify-space-between margin-bottom-150 border-radius-12px padding-150 bg-gradient-primary">
              <h4 class="margin-0 txt-weight-light daopage-proposal-title-card-h4 fs-18px color-white">{{ selectedProposal?.title || 'Proposal Title' }}</h4>
              <span class="daopage-proposal-status active border-radius-20px fw-500 fs-075rem padding-25-75 color-accent-secondary">Active</span>
            </div>

            <div class="daopage-vote-options flex flex-column gap-75 margin-bottom-150">
              <label class="daopage-vote-option block cursor-pointer" :class="{ selected: voteChoice === 'for' }">
                <input type="radio" name="vote" value="for" v-model="voteChoice" />
                <div class="daopage-vote-option-content flex-align-center gap-100 padding-100 border-radius-10px border-2 bg-card transition-all-02">
                  <div class="daopage-vote-icon flex-align-justify-center flex-0-0-auto badge-success color-success size-40px border-radius-10px">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="daopage-vote-label color-text-primary txt-weight-light fs-15px margin-bottom-25">Vote For</div>
                    <div class="daopage-vote-desc color-text-secondary fs-13px">Support this proposal</div>
                  </div>
                </div>
              </label>

              <label class="daopage-vote-option block cursor-pointer" :class="{ selected: voteChoice === 'against' }">
                <input type="radio" name="vote" value="against" v-model="voteChoice" />
                <div class="daopage-vote-option-content flex-align-center gap-100 padding-100 border-radius-10px border-2 bg-card transition-all-02">
                  <div class="daopage-vote-icon against flex-align-justify-center flex-0-0-auto size-40px border-radius-10px daopage-vote-icon-against color-error">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM15 13.59L13.59 15L10 11.41L6.41 15L5 13.59L8.59 10L5 6.41L6.41 5L10 8.59L13.59 5L15 6.41L11.41 10L15 13.59Z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="daopage-vote-label color-text-primary txt-weight-light fs-15px margin-bottom-25">Vote Against</div>
                    <div class="daopage-vote-desc color-text-secondary fs-13px">Oppose this proposal</div>
                  </div>
                </div>
              </label>

              <label class="daopage-vote-option block cursor-pointer" :class="{ selected: voteChoice === 'abstain' }">
                <input type="radio" name="vote" value="abstain" v-model="voteChoice" />
                <div class="daopage-vote-option-content flex-align-center gap-100 padding-100 border-radius-10px border-2 bg-card transition-all-02">
                  <div class="daopage-vote-icon abstain flex-align-justify-center flex-0-0-auto size-40px border-radius-10px daopage-vote-icon-abstain color-text-tertiary">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
                      <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </div>
                  <div>
                    <div class="daopage-vote-label color-text-primary txt-weight-light fs-15px margin-bottom-25">Abstain</div>
                    <div class="daopage-vote-desc color-text-secondary fs-13px">No preference</div>
                  </div>
                </div>
              </label>
            </div>

            <div class="daopage-voting-power flex-align-center flex-justify-space-between margin-bottom-150 padding-100 border-radius-10px bg-secondary border-1">
              <span class="daopage-power-label color-text-secondary fs-14px">Your Voting Power:</span>
              <span class="daopage-power-value color-text-primary txt-weight-light fs-15px">9,000 LMN</span>
            </div>

            <button class="daopage-btn-modal-primary w-full flex-align-justify-center gap-50 border-none color-white cursor-pointer border-radius-10px fw-500 padding-87 bg-gradient-primary fs-15px transition-all-02 hover-lift-1" @click="castVote" :disabled="!voteChoice">
              <Vote :size="18" />
              Cast Vote
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject, watch } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
import { 
  Users,
  FileText,
  Vote,
  Wallet,
  Plus,
  X
} from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';

const lumen = useInternalLumen();

const currentView = ref<'proposals' | 'voting' | 'treasury' | 'members'>('proposals');

const showCreateProposalModal = ref(false);
const showVoteModal = ref(false);
const selectedProposal = ref<any>(null);
const voteChoice = ref('');

const proposalForm = ref({
  title: '',
  description: '',
  category: 'governance',
  duration: '7'
});

const isLoading = ref(true);

useTabLoadingSync(isLoading);


const activeProposalsCount = ref(0);
const totalMembers = ref(0);
const treasuryBalance = ref('0');

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: string;
  submitTime: string;
  depositEndTime: string;
  votingStartTime: string;
  votingEndTime: string;
  totalDeposit: string;
  yesVotes: string;
  noVotes: string;
  abstainVotes: string;
  noWithVetoVotes: string;
  proposer: string;
}

const proposals = ref<Proposal[]>([]);

interface Member {
  address: string;
  moniker: string;
  tokens: string;
  avatar?: string;
  keybaseId?: string;
}

const members = ref<Member[]>([]);
const avatarCache = ref<Record<string, string>>({});

interface TreasuryAsset {
  denom: string;
  amount: string;
  displayName: string;
}

const treasuryAssets = ref<TreasuryAsset[]>([]);

function getViewTitle(): string {
  const titles: Record<string, string> = {
    proposals: 'Proposals',
    voting: 'Voting',
    treasury: 'Treasury',
    members: 'Members'
  };
  return titles[currentView.value] || 'DAO';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    proposals: 'View and create governance proposals',
    voting: 'Participate in DAO governance',
    treasury: 'DAO treasury overview',
    members: 'View DAO members'
  };
  return descs[currentView.value] || '';
}

function openCreateProposalModal() {
  showCreateProposalModal.value = true;
}

function closeCreateProposalModal() {
  showCreateProposalModal.value = false;
  proposalForm.value = { title: '', description: '', category: 'governance', duration: '7' };
}

function canSubmitProposal(): boolean {
  return proposalForm.value.title.length > 0 && proposalForm.value.description.length > 0;
}

function submitProposal() {
  console.log('Submitting proposal:', proposalForm.value);
  closeCreateProposalModal();
}

function openVoteModal(proposal: any) {
  selectedProposal.value = proposal || null;
  voteChoice.value = '';
  showVoteModal.value = true;
}

function closeVoteModal() {
  showVoteModal.value = false;
  selectedProposal.value = null;
  voteChoice.value = '';
}

function castVote() {
  console.log('Casting vote:', voteChoice.value);
  closeVoteModal();
}

function formatAmount(amount: string, denom: string = 'ulumen'): string {
  if (!amount) return '0';
  const num = parseInt(amount) / 1e6;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function getProposalStatusClass(status: string): string {
  switch (status) {
    case 'PROPOSAL_STATUS_VOTING_PERIOD': return 'active';
    case 'PROPOSAL_STATUS_PASSED': return 'passed badge-success';
    case 'PROPOSAL_STATUS_REJECTED': return 'rejected badge-error';
    case 'PROPOSAL_STATUS_DEPOSIT_PERIOD': return 'deposit';
    default: return 'unknown';
  }
}

function getProposalStatusText(status: string): string {
  switch (status) {
    case 'PROPOSAL_STATUS_VOTING_PERIOD': return 'Voting';
    case 'PROPOSAL_STATUS_PASSED': return 'Passed';
    case 'PROPOSAL_STATUS_REJECTED': return 'Rejected';
    case 'PROPOSAL_STATUS_DEPOSIT_PERIOD': return 'Deposit';
    case 'PROPOSAL_STATUS_FAILED': return 'Failed';
    default: return 'Unknown';
  }
}

function calculateVotePercentage(proposal: Proposal, voteType: 'yes' | 'no' | 'abstain' | 'noWithVeto'): number {
  const yes = parseInt(proposal.yesVotes) || 0;
  const no = parseInt(proposal.noVotes) || 0;
  const abstain = parseInt(proposal.abstainVotes) || 0;
  const veto = parseInt(proposal.noWithVetoVotes) || 0;
  const total = yes + no + abstain + veto;
  
  if (total === 0) return 0;
  
  switch (voteType) {
    case 'yes': return (yes / total) * 100;
    case 'no': return (no / total) * 100;
    case 'abstain': return (abstain / total) * 100;
    case 'noWithVeto': return (veto / total) * 100;
    default: return 0;
  }
}

function shortenAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 16) return address;
  return `${address.substring(0, 10)}...${address.substring(address.length - 6)}`;
}

function formatTokens(tokens: string): string {
  if (!tokens) return '0';
  const num = parseInt(tokens) / 1e6;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

async function fetchProposals() {
  if (!lumen?.net?.restGet) return;
  
  try {
    const res = await lumen.net.restGet(`/cosmos/gov/v1beta1/proposals`);
    
    if (res.ok && res.json?.proposals) {
      const rawProposals = res.json.proposals;
      
      proposals.value = rawProposals.map((p: any) => ({
        id: p.proposal_id,
        title: p.content?.title || `Proposal #${p.proposal_id}`,
        description: p.content?.description || '',
        status: p.status,
        submitTime: p.submit_time,
        depositEndTime: p.deposit_end_time,
        votingStartTime: p.voting_start_time,
        votingEndTime: p.voting_end_time,
        totalDeposit: p.total_deposit?.[0]?.amount || '0',
        yesVotes: p.final_tally_result?.yes || '0',
        noVotes: p.final_tally_result?.no || '0',
        abstainVotes: p.final_tally_result?.abstain || '0',
        noWithVetoVotes: p.final_tally_result?.no_with_veto || '0',
        proposer: p.proposer || ''
      })).reverse(); // Newest first
      
      activeProposalsCount.value = proposals.value.filter(
        p => p.status === 'PROPOSAL_STATUS_VOTING_PERIOD' || p.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD'
      ).length;
    }
  } catch (e) {
    console.error('Failed to fetch proposals:', e);
  }
}

async function fetchMembers() {
  if (!lumen?.net?.restGet) return;
  
  try {
    const res = await lumen.net.restGet(
      `/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`
    );
    
    if (res.ok && res.json?.validators) {
      const validators = res.json.validators;
      
      members.value = validators
        .sort((a: any, b: any) => {
          const tokensA = BigInt(a.tokens || '0');
          const tokensB = BigInt(b.tokens || '0');
          return tokensB > tokensA ? 1 : tokensB < tokensA ? -1 : 0;
        })
        .map((v: any) => ({
          address: v.operator_address,
          moniker: v.description?.moniker || 'Unknown',
          tokens: v.tokens || '0',
          avatar: avatarCache.value[v.description?.identity] || null,
          keybaseId: v.description?.identity || null
        }));
      
      totalMembers.value = validators.length;
      
      fetchKeybaseAvatars();
    }
  } catch (e) {
    console.error('Failed to fetch members:', e);
  }
}

async function fetchKeybaseAvatars() {
  const membersWithKeybase = members.value.filter(m => m.keybaseId && !avatarCache.value[m.keybaseId]);
  
  for (const member of membersWithKeybase) {
    if (!member.keybaseId) continue;
    
    try {
      const response = await fetch(
        `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${member.keybaseId}`
      );
      const data = await response.json();
      
      if (data?.them?.[0]?.pictures?.primary?.url) {
        const avatarUrl = data.them[0].pictures.primary.url;
        avatarCache.value[member.keybaseId] = avatarUrl;
        
        const memberIndex = members.value.findIndex(m => m.keybaseId === member.keybaseId);
        if (memberIndex !== -1) {
          members.value[memberIndex].avatar = avatarUrl;
        }
      }
    } catch (e) {
      console.log(`Failed to fetch Keybase avatar for ${member.moniker}`);
    }
  }
}

async function fetchTreasury() {
  if (!lumen?.net?.restGet) return;
  
  try {
    const res = await lumen.net.restGet(`/cosmos/distribution/v1beta1/community_pool`);
    
    if (res.ok && res.json?.pool) {
      treasuryAssets.value = res.json.pool.map((asset: any) => ({
        denom: asset.denom,
        amount: asset.amount?.split('.')[0] || '0', // Remove decimals
        displayName: asset.denom === 'ulumen' ? 'Lumen (LUM)' : asset.denom
      }));
      
      const lumAsset = treasuryAssets.value.find(a => a.denom === 'ulumen');
      if (lumAsset) {
        treasuryBalance.value = formatAmount(lumAsset.amount);
      }
    }
  } catch (e) {
    console.error('Failed to fetch treasury:', e);
  }
}

async function fetchAllData() {
  isLoading.value = true;
  
  try {
    await Promise.all([
      fetchProposals(),
      fetchMembers(),
      fetchTreasury()
    ]);
  } finally {
    isLoading.value = false;
  }
}

let refreshInterval: ReturnType<typeof setInterval> | null = null;

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    fetchAllData();
  }
);

onMounted(() => {
  fetchAllData();
  
  refreshInterval = setInterval(fetchAllData, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>
