<template>
  <div class="dao-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Users :size="24" />
        </div>
        <span class="logo-text">DAO</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Governance</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'proposals' }"
            @click="currentView = 'proposals'"
          >
            <FileText :size="18" />
            <span>Proposals</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'voting' }"
            @click="currentView = 'voting'"
          >
            <Vote :size="18" />
            <span>Voting</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Treasury</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'treasury' }"
            @click="currentView = 'treasury'"
          >
            <Wallet :size="18" />
            <span>Treasury</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'members' }"
            @click="currentView = 'members'"
          >
            <Users :size="18" />
            <span>Members</span>
          </button>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>
        <button v-if="currentView === 'proposals'" class="btn-primary" @click="openCreateProposalModal">
          <Plus :size="18" />
          New Proposal
        </button>
      </header>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading governance data...</p>
      </div>

      <template v-else>
        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">
              <FileText :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ activeProposalsCount }}</span>
              <span class="stat-label">Active Proposals</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">
              <Users :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ totalMembers }}</span>
              <span class="stat-label">Validators</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">
              <Wallet :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ treasuryBalance }} LUM</span>
              <span class="stat-label">Community Pool</span>
            </div>
          </div>
        </div>

        <!-- Proposals View -->
        <div v-if="currentView === 'proposals'" class="content-area">
          <div v-if="proposals.length === 0" class="empty-state">
            <FileText :size="48" />
            <p>No proposals found</p>
          </div>
          <div v-else class="proposals-list">
            <div class="proposal-card" v-for="proposal in proposals" :key="proposal.id">
              <div class="proposal-header">
                <span class="proposal-id">#{{ proposal.id }}</span>
                <span class="proposal-status" :class="getProposalStatusClass(proposal.status)">
                  {{ getProposalStatusText(proposal.status) }}
                </span>
              </div>
              <h3 class="proposal-title">{{ proposal.title }}</h3>
              <p class="proposal-desc">{{ proposal.description.substring(0, 150) }}{{ proposal.description.length > 150 ? '...' : '' }}</p>
              <div class="proposal-footer">
                <div class="proposal-votes">
                  <span class="vote-for">{{ calculateVotePercentage(proposal, 'yes').toFixed(0) }}% Yes</span>
                  <span class="vote-against">{{ calculateVotePercentage(proposal, 'no').toFixed(0) }}% No</span>
                </div>
                <button class="btn-secondary" @click="openVoteModal(proposal)">
                  {{ proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD' ? 'Vote' : 'View Details' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Voting View -->
        <div v-else-if="currentView === 'voting'" class="content-area">
          <div class="info-card">
            <h3>Active Voting Proposals</h3>
            <p class="voting-desc">Select a proposal from the Proposals tab to vote</p>
          </div>
          <div class="proposals-list" style="margin-top: 1rem;">
            <div 
              class="proposal-card" 
              v-for="proposal in proposals.filter(p => p.status === 'PROPOSAL_STATUS_VOTING_PERIOD')" 
              :key="proposal.id"
            >
              <div class="proposal-header">
                <span class="proposal-id">#{{ proposal.id }}</span>
                <span class="proposal-status active">Voting</span>
              </div>
              <h3 class="proposal-title">{{ proposal.title }}</h3>
              <div class="proposal-footer">
                <div class="vote-progress">
                  <div class="progress-bar-container">
                    <div class="progress-yes" :style="{ width: calculateVotePercentage(proposal, 'yes') + '%' }"></div>
                  </div>
                  <span class="progress-label">{{ calculateVotePercentage(proposal, 'yes').toFixed(1) }}% Yes</span>
                </div>
                <button class="btn-primary" @click="openVoteModal(proposal)">
                  <Vote :size="16" />
                  Vote Now
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Treasury View -->
        <div v-else-if="currentView === 'treasury'" class="content-area">
          <div v-if="treasuryAssets.length === 0" class="empty-state">
            <Wallet :size="48" />
            <p>No treasury assets found</p>
          </div>
          <div v-else class="treasury-list">
            <div class="treasury-item" v-for="asset in treasuryAssets" :key="asset.denom">
              <div class="asset-info">
                <span class="asset-name">{{ asset.displayName }}</span>
                <span class="asset-value">{{ formatAmount(asset.amount) }} {{ asset.denom === 'ulumen' ? 'LUM' : asset.denom }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Members View -->
        <div v-else-if="currentView === 'members'" class="content-area">
          <div v-if="members.length === 0" class="empty-state">
            <Users :size="48" />
            <p>No validators found</p>
          </div>
          <div v-else class="members-list">
            <div class="member-item" v-for="(member, index) in members" :key="member.address">
              <div class="member-rank">{{ index + 1 }}</div>
              <div class="member-avatar" :class="{ 'has-image': member.avatar }">
                <img v-if="member.avatar" :src="member.avatar" :alt="member.moniker" />
                <span v-else>{{ member.moniker.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="member-info">
                <span class="member-name">{{ member.moniker }}</span>
                <span class="member-address">{{ shortenAddress(member.address) }}</span>
              </div>
              <div class="member-power">{{ formatTokens(member.tokens) }} LUM</div>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- Create Proposal Modal -->
    <Transition name="fade">
      <div v-if="showCreateProposalModal" class="modal-overlay" @click="closeCreateProposalModal">
        <div class="modal-content large" @click.stop>
          <div class="modal-header">
            <h3>Create Proposal</h3>
            <button class="modal-close" @click="closeCreateProposalModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">Submit a proposal for DAO governance</p>
            
            <div class="form-group">
              <label>Proposal Title</label>
              <input type="text" class="form-input" v-model="proposalForm.title" placeholder="Enter proposal title..." />
            </div>
            
            <div class="form-group">
              <label>Description</label>
              <textarea class="form-textarea" v-model="proposalForm.description" rows="6" placeholder="Describe your proposal in detail..."></textarea>
            </div>
            
            <div class="form-group">
              <label>Category</label>
              <select class="form-select" v-model="proposalForm.category">
                <option value="governance">Governance</option>
                <option value="treasury">Treasury</option>
                <option value="technical">Technical</option>
                <option value="marketing">Marketing</option>
                <option value="community">Community</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Voting Duration</label>
              <select class="form-select" v-model="proposalForm.duration">
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>
            
            <div class="proposal-requirements">
              <div class="requirement-item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM6.4 12L2.4 8L3.52 6.88L6.4 9.76L12.48 3.68L13.6 4.8L6.4 12Z"/>
                </svg>
                <span>Minimum 1000 LMN required to submit</span>
              </div>
              <div class="requirement-item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM6.4 12L2.4 8L3.52 6.88L6.4 9.76L12.48 3.68L13.6 4.8L6.4 12Z"/>
                </svg>
                <span>Proposal fee: 10 LMN</span>
              </div>
            </div>
            
            <button class="btn-modal-primary" @click="submitProposal" :disabled="!canSubmitProposal()">
              <Plus :size="18" />
              Submit Proposal
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Vote Modal -->
    <Transition name="fade">
      <div v-if="showVoteModal" class="modal-overlay" @click="closeVoteModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Cast Your Vote</h3>
            <button class="modal-close" @click="closeVoteModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="proposal-title-card">
              <h4>{{ selectedProposal?.title || 'Proposal Title' }}</h4>
              <span class="proposal-status active">Active</span>
            </div>
            
            <div class="vote-options">
              <label class="vote-option" :class="{ selected: voteChoice === 'for' }">
                <input type="radio" name="vote" value="for" v-model="voteChoice" />
                <div class="vote-option-content">
                  <div class="vote-icon for">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="vote-label">Vote For</div>
                    <div class="vote-desc">Support this proposal</div>
                  </div>
                </div>
              </label>
              
              <label class="vote-option" :class="{ selected: voteChoice === 'against' }">
                <input type="radio" name="vote" value="against" v-model="voteChoice" />
                <div class="vote-option-content">
                  <div class="vote-icon against">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM15 13.59L13.59 15L10 11.41L6.41 15L5 13.59L8.59 10L5 6.41L6.41 5L10 8.59L13.59 5L15 6.41L11.41 10L15 13.59Z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="vote-label">Vote Against</div>
                    <div class="vote-desc">Oppose this proposal</div>
                  </div>
                </div>
              </label>
              
              <label class="vote-option" :class="{ selected: voteChoice === 'abstain' }">
                <input type="radio" name="vote" value="abstain" v-model="voteChoice" />
                <div class="vote-option-content">
                  <div class="vote-icon abstain">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
                      <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </div>
                  <div>
                    <div class="vote-label">Abstain</div>
                    <div class="vote-desc">No preference</div>
                  </div>
                </div>
              </label>
            </div>
            
            <div class="voting-power">
              <span class="power-label">Your Voting Power:</span>
              <span class="power-value">9,000 LMN</span>
            </div>
            
            <button class="btn-modal-primary" @click="castVote" :disabled="!voteChoice">
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
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { 
  Users,
  FileText,
  Vote,
  Wallet,
  Plus,
  X
} from 'lucide-vue-next';

const lumen = (window as any).lumen;

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
const rpcBase = ref('http://142.132.201.187:26657');
const restBase = ref('http://142.132.201.187:1317');

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
    case 'PROPOSAL_STATUS_PASSED': return 'passed';
    case 'PROPOSAL_STATUS_REJECTED': return 'rejected';
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
  if (!lumen?.http?.get) return;
  
  try {
    const res = await lumen.http.get(`${restBase.value}/cosmos/gov/v1beta1/proposals`);
    
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
  if (!lumen?.http?.get) return;
  
  try {
    const res = await lumen.http.get(
      `${restBase.value}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`
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
  if (!lumen?.http?.get) return;
  
  try {
    const res = await lumen.http.get(`${restBase.value}/cosmos/distribution/v1beta1/community_pool`);
    
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

<style scoped>
.dao-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-tertiary);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--sidebar-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: var(--border-width) solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 2rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-lg);
  color: white;
  box-shadow: var(--shadow-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1.5rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border: none;
  background: transparent;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: var(--fs-base);
  font-weight: 400;
  color: var(--text-primary);
  transition: all var(--transition-fast);
  letter-spacing: -0.022em;
}

.nav-item:hover {
  background: var(--hover-bg);
}

.nav-item.active {
  background: var(--ios-blue);
  color: white;
  font-weight: 600;
  box-shadow: var(--shadow-primary);
}

.nav-item:active {
  transform: scale(0.98);
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-secondary);
  margin: 0;
  border-radius: 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.25rem 0 0 0;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--gradient-primary);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--primary-a30);
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.loading-state .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-tertiary);
  text-align: center;
}

.empty-state svg {
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--hover-bg) 100%);
  border-radius: 12px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  background: var(--gradient-primary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Content Area */
.content-area {
  flex: 1;
  overflow-y: auto;
}

/* Proposals */
.proposals-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.proposal-card {
  padding: 1.5rem;
  background: var(--bg-primary, white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.proposal-id {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.proposal-status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.proposal-status.active {
  background: var(--fill-blue);
  color: var(--accent-secondary);
}

.proposal-status.passed {
  background: var(--fill-success);
  color: var(--ios-green);
}

.proposal-status.rejected {
  background: var(--fill-error);
  color: var(--ios-red);
}

.proposal-status.deposit {
  background: rgba(255, 204, 0, 0.15);
  color: var(--ios-orange);
}

.proposal-status.unknown {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.proposal-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.proposal-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 1rem 0;
}

.proposal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.proposal-votes {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
}

.vote-for {
  color: var(--ios-green);
}

.vote-against {
  color: var(--ios-red);
}

/* Info Card */
.info-card {
  padding: 2rem;
  background: var(--card-bg);
  border-radius: 16px;
  text-align: center;
}

.info-card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 0 0.5rem 0;
}

.voting-power {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.voting-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

/* Treasury */
.treasury-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.treasury-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: var(--bg-primary, white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.asset-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.asset-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.asset-value {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.asset-usd {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* Members */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-primary, white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.member-item:hover {
  background: var(--hover-bg);
}

.member-rank {
  min-width: 24px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.member-avatar {
  width: 40px;
  height: 40px;
  min-width: 40px;
  background: var(--gradient-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  overflow: hidden;
}

.member-avatar.has-image {
  background: transparent;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.member-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.member-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.member-address {
  font-size: 0.75rem;
  font-family: 'Monaco', 'Menlo', monospace;
  color: var(--text-tertiary);
}

.member-power {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent-primary);
  white-space: nowrap;
}

/* Vote Progress */
.vote-progress {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.progress-bar-container {
  height: 6px;
  background: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
}

.progress-yes {
  height: 100%;
  background: linear-gradient(90deg, #25bb8d, #10b981);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Responsive */
@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
}

@media (max-width: 700px) {
  .dao-page {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    max-width: 100%;
    min-width: 100%;
    flex-direction: row;
    padding: 1rem;
    overflow-x: auto;
  }
  
  .sidebar-header {
    margin-bottom: 0;
    margin-right: 1rem;
  }
  
  .sidebar-nav {
    flex-direction: row;
    gap: 0.5rem;
  }
  
  .nav-section {
    flex-direction: row;
  }
  
  .nav-label {
    display: none;
  }
  
  .nav-item span {
    display: none;
  }
  
  .main-content {
    margin: 0 0.5rem 0.5rem 0.5rem;
    padding: 1.5rem;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-primary, white);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.large {
  max-width: 640px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--hover-bg);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.modal-desc {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-primary, white);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.form-textarea {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-primary, white);
  transition: all 0.2s ease;
  resize: vertical;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.form-select {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-primary, white);
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-select:hover {
  border-color: var(--border-color);
}

.form-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.proposal-requirements {
  background: var(--card-bg);
  border: 1px solid #bae6fd;
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.requirement-item svg {
  flex-shrink: 0;
  color: var(--accent-primary);
}

.btn-modal-primary {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 10px;
  background: var(--gradient-primary);
  color: white;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-modal-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-a30);
}

.btn-modal-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.proposal-title-card {
  background: var(--gradient-primary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.proposal-title-card h4 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
}

.proposal-title-card .proposal-status {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.vote-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.vote-option {
  display: block;
  cursor: pointer;
}

.vote-option input[type=\"radio\"] {
  display: none;
}

.vote-option-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  background: var(--card-bg);
  transition: all 0.2s ease;
}

.vote-option:hover .vote-option-content {
  border-color: var(--border-color);
  background: var(--bg-secondary);
}

.vote-option.selected .vote-option-content {
  border-color: var(--accent-primary);
  background: var(--card-bg);
}

.vote-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vote-icon.for {
  background: var(--fill-success);
  color: var(--ios-green);
}

.vote-icon.against {
  background: var(--card-bg);
  color: var(--ios-red);
}

.vote-icon.abstain {
  background: var(--card-bg);
  color: var(--text-tertiary);
}

.vote-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.vote-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.voting-power {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  margin-bottom: 1.5rem;
}

.power-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.power-value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
