<template>
  <!-- ####### lumen://dao DAO ####### -->
  <div class="internal-page flex">
    <!-- ####### lumen://dao SIDEBAR ####### -->
    <InternalSidebar title="DAO" :icon="Users" activeKey="dao">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection title="Governance">
          <UiSidebarNavItem :active="currentView === 'proposals'" @click="currentView = 'proposals'">
            <FileText :size="18" />
            <span>Proposals</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'voting'" @click="currentView = 'voting'">
            <Vote :size="18" />
            <span>Voting</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>

        <UiSidebarNavSection title="Treasury">
          <UiSidebarNavItem :active="currentView === 'treasury'" @click="currentView = 'treasury'">
            <Wallet :size="18" />
            <span>Treasury</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'members'" @click="currentView = 'members'">
            <Users :size="18" />
            <span>Members</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <!-- ####### lumen://dao MAIN CONTENT ####### -->
    <main class="flex-1 min-w-0 flex flex-column overflow-hidden bg-secondary m-0px py-32px px-40px">
      <!-- Header -->
      <UiPageHeader :title="getViewTitle()" :subtitle="getViewDescription()">
        <template v-if="currentView === 'proposals'" #actions>
          <UiButton variant="primary" @click="openCreateProposalModal">
            <Plus :size="18" />
            New Proposal
          </UiButton>
        </template>
      </UiPageHeader>

      <!-- Loading State -->
      <UiLoadingBlock v-if="isLoading" message="Loading governance data..." />

      <template v-else>
        <!-- Stats Grid -->
        <div class="mb-24px gap-16px grid grid-cols-auto-fit-180">
          <UiStatIconTile label="Active Proposals" :value="activeProposalsCount" card-bg-class="bg-gradient-secondary-hover" icon-class="color-white bg-gradient-primary">
            <template #icon><FileText :size="20" /></template>
          </UiStatIconTile>
          <UiStatIconTile label="Validators" :value="totalMembers" card-bg-class="bg-gradient-secondary-hover" icon-class="color-white bg-gradient-primary">
            <template #icon><Users :size="20" /></template>
          </UiStatIconTile>
          <UiStatIconTile label="Community Pool" :value="`${treasuryBalance} LUM`" card-bg-class="bg-gradient-secondary-hover" icon-class="color-white bg-gradient-primary">
            <template #icon><Wallet :size="20" /></template>
          </UiStatIconTile>
        </div>

        <!-- ####### lumen://dao PROPOSALS VIEW ####### -->
        <div v-if="currentView === 'proposals'" class="flex-1 overflow-y-auto">
          <UiEmptyState v-if="proposals.length === 0" description="No proposals found">
            <FileText :size="48" />
          </UiEmptyState>
          <div v-else class="flex flex-column gap-16px">
            <UiCard padding="lg" border-class="border-1" radius="12px" bg-class="bg-primary" :shadow="false" v-for="proposal in proposals" :key="proposal.id">
              <div class="flex-align-center flex-justify-space-between mb-12px">
                <span class="color-text-secondary text-13px">#{{ proposal.id }}</span>
                <span class="border-radius-20px fw-500 text-12px py-4px px-12px" :class="getProposalStatusClass(proposal.status)" :style="getProposalStatusStyle(proposal.status)">
                  {{ getProposalStatusText(proposal.status) }}
                </span>
              </div>
              <h3 class="color-text-primary text-18px txt-weight-light m-0px mb-8px">{{ proposal.title }}</h3>
              <p class="color-text-secondary text-14px m-0px mb-16px">{{ proposal.description.substring(0, 150) }}{{ proposal.description.length > 150 ? '...' : '' }}</p>
              <div class="flex-align-center flex-justify-space-between">
                <div class="flex gap-16px text-13px">
                  <span class="color-success">{{ calculateVotePercentage(proposal, 'yes').toFixed(0) }}% Yes</span>
                  <span class="color-error">{{ calculateVotePercentage(proposal, 'no').toFixed(0) }}% No</span>
                </div>
                <UiButton variant="secondary" @click="openVoteModal(proposal)">
                  {{ proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD' ? 'Vote' : 'View Details' }}
                </UiButton>
              </div>
            </UiCard>
          </div>
        </div>

        <!-- ####### lumen://dao VOTING VIEW ####### -->
        <div v-else-if="currentView === 'voting'" class="flex-1 overflow-y-auto">
          <UiCard class="text-center" padding-class="p-32px" radius="16px" :shadow="false">
            <h3 class="txt-weight-light color-text-secondary text-16px m-0px mb-8px">Active Voting Proposals</h3>
            <p class="color-text-secondary m-0px text-14px">Select a proposal from the Proposals tab to vote</p>
          </UiCard>
          <div class="flex flex-column gap-16px mt-16px">
            <UiCard
              padding="lg"
              border-class="border-1"
              radius="12px"
              bg-class="bg-primary"
              :shadow="false"
              v-for="proposal in proposals.filter(p => p.status === 'PROPOSAL_STATUS_VOTING_PERIOD')"
              :key="proposal.id"
            >
              <div class="flex-align-center flex-justify-space-between mb-12px">
                <span class="color-text-secondary text-13px">#{{ proposal.id }}</span>
                <span class="border-radius-20px fw-500 text-12px py-4px px-12px color-accent-secondary bg-fill-blue">Voting</span>
              </div>
              <h3 class="color-text-primary text-18px txt-weight-light m-0px mb-8px">{{ proposal.title }}</h3>
              <div class="flex-align-center flex-justify-space-between">
                <div class="flex-1 flex flex-column gap-4px">
                  <div class="h-6px overflow-hidden bg-border border-radius-4px">
                    <div class="h-full border-radius-4px transition-width-03 bg-gradient-teal-green" :style="{ width: calculateVotePercentage(proposal, 'yes') + '%' }"></div>
                  </div>
                  <span class="color-text-secondary text-12px">{{ calculateVotePercentage(proposal, 'yes').toFixed(1) }}% Yes</span>
                </div>
                <UiButton variant="primary" @click="openVoteModal(proposal)">
                  <Vote :size="16" />
                  Vote Now
                </UiButton>
              </div>
            </UiCard>
          </div>
        </div>

        <!-- ####### lumen://dao TREASURY VIEW ####### -->
        <div v-else-if="currentView === 'treasury'" class="flex-1 overflow-y-auto">
          <UiEmptyState v-if="treasuryAssets.length === 0" description="No treasury assets found">
            <Wallet :size="48" />
          </UiEmptyState>
          <div v-else class="flex flex-column gap-12px">
            <UiCard class="flex-align-center flex-justify-space-between" padding-class="p-20px" border-class="border-1" radius="12px" bg-class="bg-primary" :shadow="false" v-for="asset in treasuryAssets" :key="asset.denom">
              <div class="flex flex-column gap-4px">
                <span class="color-text-primary txt-weight-light text-14px">{{ asset.displayName }}</span>
                <span class="color-text-secondary text-13px">{{ formatAmount(asset.amount) }} {{ asset.denom === 'ulumen' ? 'LUM' : asset.denom }}</span>
              </div>
            </UiCard>
          </div>
        </div>

        <!-- ####### lumen://dao MEMBERS VIEW ####### -->
        <div v-else-if="currentView === 'members'" class="flex-1 overflow-y-auto">
          <UiEmptyState v-if="members.length === 0" description="No validators found">
            <Users :size="48" />
          </UiEmptyState>
          <div v-else class="flex flex-column gap-8px">
            <UiCard class="hover-bg-hover flex-align-center gap-16px transition-all-02" padding="md" border-class="border-1" radius="12px" bg-class="bg-primary" :shadow="false" v-for="(member, index) in members" :key="member.address">
              <div class="flex-align-justify-center color-text-secondary txt-weight-light h-24px bg-primary border-radius-6px text-12px min-w-24px">{{ index + 1 }}</div>
              <div class="flex-align-justify-center color-white overflow-hidden border-radius-full size-40px txt-weight-light bg-gradient-primary min-w-40px" :class="{ 'bg-transparent': member.avatar }">
                <img v-if="member.avatar" :src="member.avatar" :alt="member.moniker" class="w-full h-full object-fit-cover border-radius-full" />
                <span v-else>{{ member.moniker.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="flex flex-column flex-1">
                <span class="color-text-primary txt-weight-light text-14px">{{ member.moniker }}</span>
                <span class="color-text-tertiary text-12px mono">{{ shortenAddress(member.address) }}</span>
              </div>
              <div class="txt-weight-light color-primary text-14px nowrap">{{ formatTokens(member.tokens) }} LUM</div>
            </UiCard>
          </div>
        </div>
      </template>
    </main>

    <!-- ####### lumen://dao CREATE PROPOSAL MODAL ####### -->
    <UiModal :model-value="showCreateProposalModal" title="Create Proposal" panel-class="w-full max-w-640px" @update:model-value="closeCreateProposalModal">
            <p class="color-text-secondary mb-24px text-14px">Submit a proposal for DAO governance</p>

            <div class="mb-20px">
              <label class="txt-weight-light color-text-primary block text-13px mb-8px">Proposal Title</label>
              <UiInput radius-class="border-radius-10px" padding-class="p-14px" :focus-ring="false" type="text" v-model="proposalForm.title" placeholder="Enter proposal title..." class="focus-outline-none focus-ring focus-shadow bg-primary" />
            </div>

            <div class="mb-20px">
              <label class="txt-weight-light color-text-primary block text-13px mb-8px">Description</label>
              <UiInput type="textarea" radius-class="border-radius-10px" padding-class="p-14px" :focus-ring="false" v-model="proposalForm.description" rows="6" placeholder="Describe your proposal in detail..." class="resize-vertical focus-outline-none focus-ring focus-shadow bg-primary"></UiInput>
            </div>

            <div class="mb-20px">
              <label class="txt-weight-light color-text-primary block text-13px mb-8px">Category</label>
              <select class="cursor-pointer w-full p-14px border-1 border-radius-10px text-14px color-text-primary transition-all-02 hover-border-color focus-outline-none focus-border-primary focus-ring focus-shadow bg-primary" v-model="proposalForm.category">
                <option value="governance">Governance</option>
                <option value="treasury">Treasury</option>
                <option value="technical">Technical</option>
                <option value="marketing">Marketing</option>
                <option value="community">Community</option>
              </select>
            </div>

            <div class="mb-20px">
              <label class="txt-weight-light color-text-primary block text-13px mb-8px">Deposit (LMN)</label>
              <UiInput radius-class="border-radius-10px" padding-class="p-14px" :focus-ring="false" type="text" v-model="proposalForm.depositLmn" placeholder="10" class="focus-outline-none focus-ring focus-shadow bg-primary" />
            </div>

            <UiCard class="mb-24px" padding="md" radius="10px" border-class="border-1-primary-a30" :shadow="false">
              <div class="flex-align-center gap-12px color-text-secondary text-13px p-0px pt-8px pb-8px">
                <svg class="flex-shrink-0 color-primary" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM6.4 12L2.4 8L3.52 6.88L6.4 9.76L12.48 3.68L13.6 4.8L6.4 12Z"/>
                </svg>
                <span>Minimum deposit to enter voting: {{ govMinDepositLmn }} LMN</span>
              </div>
            </UiCard>

            <UiButton variant="primary" @click="submitProposal" :disabled="!canSubmitProposal() || isSubmittingProposal">
              <Plus :size="18" />
              {{ isSubmittingProposal ? 'Submitting…' : 'Submit Proposal' }}
            </UiButton>
    </UiModal>

    <!-- ####### lumen://dao VOTE MODAL ####### -->
    <UiModal :model-value="showVoteModal" title="Cast Your Vote" panel-class="w-full max-w-520px" @update:model-value="closeVoteModal">
            <div class="flex-align-center flex-justify-space-between mb-24px border-radius-12px p-24px bg-gradient-primary">
              <h4 class="m-0px txt-weight-light text-18px color-white">{{ selectedProposal?.title || 'Proposal Title' }}</h4>
              <span class="border-radius-20px fw-500 text-12px py-4px px-12px color-text-primary bg-primary border-1">Active</span>
            </div>

            <div class="flex flex-column gap-12px mb-24px">
              <label class="reveal-on-hover block cursor-pointer" :class="{ selected: voteChoice === 'for' }">
                <input type="radio" name="vote" value="for" v-model="voteChoice" class="hidden" />
                <UiCard class="reveal-border-bg-target flex-align-center gap-16px transition-all-02" :class="{ 'border-color-primary bg-card': voteChoice === 'for' }" padding="md" radius="10px" border-class="border-2" :shadow="false">
                  <div class="flex-align-justify-center flex-0-0-auto bg-fill-success color-success size-40px border-radius-10px">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="color-text-primary txt-weight-light text-15px mb-4px">Vote For</div>
                    <div class="color-text-secondary text-13px">Support this proposal</div>
                  </div>
                </UiCard>
              </label>

              <label class="reveal-on-hover block cursor-pointer" :class="{ selected: voteChoice === 'against' }">
                <input type="radio" name="vote" value="against" v-model="voteChoice" class="hidden" />
                <UiCard class="reveal-border-bg-target flex-align-center gap-16px transition-all-02" :class="{ 'border-color-primary bg-card': voteChoice === 'against' }" padding="md" radius="10px" border-class="border-2" :shadow="false">
                  <div class="flex-align-justify-center flex-0-0-auto size-40px border-radius-10px color-error bg-card">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM15 13.59L13.59 15L10 11.41L6.41 15L5 13.59L8.59 10L5 6.41L6.41 5L10 8.59L13.59 5L15 6.41L11.41 10L15 13.59Z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="color-text-primary txt-weight-light text-15px mb-4px">Vote Against</div>
                    <div class="color-text-secondary text-13px">Oppose this proposal</div>
                  </div>
                </UiCard>
              </label>

              <label class="reveal-on-hover block cursor-pointer" :class="{ selected: voteChoice === 'abstain' }">
                <input type="radio" name="vote" value="abstain" v-model="voteChoice" class="hidden" />
                <UiCard class="reveal-border-bg-target flex-align-center gap-16px transition-all-02" :class="{ 'border-color-primary bg-card': voteChoice === 'abstain' }" padding="md" radius="10px" border-class="border-2" :shadow="false">
                  <div class="flex-align-justify-center flex-0-0-auto size-40px border-radius-10px color-text-tertiary bg-card">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
                      <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </div>
                  <div>
                    <div class="color-text-primary txt-weight-light text-15px mb-4px">Abstain</div>
                    <div class="color-text-secondary text-13px">No preference</div>
                  </div>
                </UiCard>
              </label>
            </div>

            <UiCard class="flex-align-center flex-justify-space-between mb-24px" padding="md" radius="10px" bg-class="bg-secondary" border-class="border-1" :shadow="false">
              <span class="color-text-secondary text-14px">Your Voting Power:</span>
              <span class="color-text-primary txt-weight-light text-15px">{{ votingPowerLmnDisplay }} LMN</span>
            </UiCard>

            <UiButton variant="primary" @click="castVote" :disabled="!voteChoice || isVoting">
              <Vote :size="18" />
              {{ isVoting ? 'Casting…' : 'Cast Vote' }}
            </UiButton>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';
import UiModal from '../../ui/UiModal.vue';
import UiLoadingBlock from '../../ui/UiLoadingBlock.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiCard from '../../ui/UiCard.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiStatIconTile from '../../ui/UiStatIconTile.vue';
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { profilesState, activeProfileId } from '../profilesStore';
import { useToast } from '../../composables/useToast';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
import {
  Users,
  FileText,
  Vote,
  Wallet,
  Plus
} from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';

const lumen = useInternalLumen();
const toast = useToast();

const activeProfile = computed(
  () => profilesState.value.find((p) => p.id === activeProfileId.value) || null
);
const activeAddress = computed(
  () => activeProfile.value?.address || activeProfile.value?.walletAddress || ''
);

const currentView = ref<'proposals' | 'voting' | 'treasury' | 'members'>('proposals');

const showCreateProposalModal = ref(false);
const showVoteModal = ref(false);
const selectedProposal = ref<any>(null);
const voteChoice = ref('');
const isSubmittingProposal = ref(false);
const isVoting = ref(false);
const votingPowerUlmn = ref<bigint>(0n);
const votingPowerLmnDisplay = computed(() => (Number(votingPowerUlmn.value) / 1e6).toLocaleString());
const govMinDepositLmn = ref('10');

const proposalForm = ref({
  title: '',
  description: '',
  category: 'governance',
  depositLmn: '10'
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
  proposalForm.value.depositLmn = govMinDepositLmn.value;
  showCreateProposalModal.value = true;
}

function closeCreateProposalModal() {
  showCreateProposalModal.value = false;
  proposalForm.value = {
    title: '',
    description: '',
    category: 'governance',
    depositLmn: govMinDepositLmn.value
  };
}

function canSubmitProposal(): boolean {
  return (
    proposalForm.value.title.trim().length > 0 &&
    proposalForm.value.description.trim().length > 0 &&
    !Number.isNaN(Number(proposalForm.value.depositLmn)) &&
    Number(proposalForm.value.depositLmn) >= 0
  );
}

async function handleSigningError(result: { ok?: boolean; error?: string }): Promise<boolean> {
  if (result?.ok === false && (result.error === 'password_required' || result.error === 'invalid_password')) {
    try {
      await lumen?.security?.lockSession?.();
    } catch {
      // ignore - the security gate will re-prompt regardless
    }
    return true;
  }
  return false;
}

async function submitProposal() {
  if (!canSubmitProposal() || isSubmittingProposal.value) return;

  const profileId = activeProfileId.value;
  const address = activeAddress.value;
  if (!profileId || !address) {
    toast.error('Select a profile first.');
    return;
  }

  const walletApi = lumen?.wallet;
  if (!walletApi?.govSubmitProposal) {
    toast.error('Governance submission is not available.');
    return;
  }

  isSubmittingProposal.value = true;
  try {
    const metadata = proposalForm.value.category ? `category:${proposalForm.value.category}` : '';
    const result = await walletApi.govSubmitProposal({
      profileId,
      address,
      title: proposalForm.value.title.trim(),
      summary: proposalForm.value.description.trim(),
      metadata,
      depositLmn: proposalForm.value.depositLmn || '0'
    });

    if (await handleSigningError(result)) return;
    if (!toast.fromResult(result, 'Proposal submitted on-chain.')) return;

    closeCreateProposalModal();
    await fetchProposals();
  } catch (err: any) {
    toast.error(err?.message || 'Failed to submit proposal.');
  } finally {
    isSubmittingProposal.value = false;
  }
}

async function openVoteModal(proposal: any) {
  selectedProposal.value = proposal || null;
  voteChoice.value = '';
  showVoteModal.value = true;
  votingPowerUlmn.value = 0n;

  const address = activeAddress.value;
  if (!address || !lumen?.wallet?.getDelegations) return;
  try {
    const res = await lumen.wallet.getDelegations(address);
    if (res?.ok && Array.isArray(res.delegations)) {
      votingPowerUlmn.value = res.delegations.reduce(
        (sum: bigint, d: any) => sum + BigInt(d?.balance?.amount || '0'),
        0n
      );
    }
  } catch (e) {
    console.error('Failed to fetch voting power:', e);
  }
}

function closeVoteModal() {
  showVoteModal.value = false;
  selectedProposal.value = null;
  voteChoice.value = '';
}

const VOTE_OPTION_MAP: Record<string, string> = {
  for: 'VOTE_OPTION_YES',
  against: 'VOTE_OPTION_NO',
  abstain: 'VOTE_OPTION_ABSTAIN'
};

async function castVote() {
  if (!voteChoice.value || !selectedProposal.value || isVoting.value) return;

  const profileId = activeProfileId.value;
  const address = activeAddress.value;
  if (!profileId || !address) {
    toast.error('Select a profile first.');
    return;
  }

  const walletApi = lumen?.wallet;
  if (!walletApi?.govVote) {
    toast.error('Governance voting is not available.');
    return;
  }

  isVoting.value = true;
  try {
    const result = await walletApi.govVote({
      profileId,
      address,
      proposalId: selectedProposal.value.id,
      option: VOTE_OPTION_MAP[voteChoice.value]
    });

    if (await handleSigningError(result)) return;
    if (!toast.fromResult(result, 'Vote broadcasted.')) return;

    closeVoteModal();
    await fetchProposals();
  } catch (err: any) {
    toast.error(err?.message || 'Failed to cast vote.');
  } finally {
    isVoting.value = false;
  }
}

function formatAmount(amount: string): string {
  if (!amount) return '0';
  const num = parseInt(amount) / 1e6;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

function getProposalStatusClass(status: string): string {
  switch (status) {
    case 'PROPOSAL_STATUS_VOTING_PERIOD': return 'color-accent-secondary bg-fill-blue';
    case 'PROPOSAL_STATUS_PASSED': return 'passed bg-fill-success';
    case 'PROPOSAL_STATUS_REJECTED': return 'rejected bg-fill-error';
    default: return '';
  }
}

function getProposalStatusStyle(status: string): Record<string, string> {
  if (status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD') return { background: 'rgba(var(--color-yellow-rgb), 0.15)', color: 'var(--color-warning)' };
  if (status === 'PROPOSAL_STATUS_VOTING_PERIOD' || status === 'PROPOSAL_STATUS_PASSED' || status === 'PROPOSAL_STATUS_REJECTED') return {};
  return { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
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
    } catch {
      console.warn(`Failed to fetch Keybase avatar for ${member.moniker}`);
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

async function fetchGovParams() {
  if (!lumen?.net?.restGet) return;

  try {
    const res = await lumen.net.restGet(`/cosmos/gov/v1/params`);
    const minDeposit = res.ok && res.json?.params?.min_deposit?.[0];
    if (minDeposit?.denom === 'ulmn' && minDeposit?.amount) {
      const lmn = Number(minDeposit.amount) / 1e6;
      if (Number.isFinite(lmn)) {
        govMinDepositLmn.value = String(lmn);
        if (!showCreateProposalModal.value) {
          proposalForm.value.depositLmn = govMinDepositLmn.value;
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch gov params:', e);
  }
}

async function fetchAllData() {
  isLoading.value = true;

  try {
    await Promise.all([
      fetchProposals(),
      fetchMembers(),
      fetchTreasury(),
      fetchGovParams()
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
