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

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <FileText :size="20" />
          </div>
          <div class="stat-info">
            <span class="stat-value">12</span>
            <span class="stat-label">Active Proposals</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <Users :size="20" />
          </div>
          <div class="stat-info">
            <span class="stat-value">1,284</span>
            <span class="stat-label">Members</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <Wallet :size="20" />
          </div>
          <div class="stat-info">
            <span class="stat-value">145.8 ETH</span>
            <span class="stat-label">Treasury</span>
          </div>
        </div>
      </div>

      <!-- Proposals View -->
      <div v-if="currentView === 'proposals'" class="content-area">
        <div class="proposals-list">
          <div class="proposal-card" v-for="i in 3" :key="i">
            <div class="proposal-header">
              <span class="proposal-id">#{{ 100 + i }}</span>
              <span class="proposal-status" :class="i === 1 ? 'active' : 'passed'">
                {{ i === 1 ? 'Active' : 'Passed' }}
              </span>
            </div>
            <h3 class="proposal-title">Proposal Title {{ i }}</h3>
            <p class="proposal-desc">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            <div class="proposal-footer">
              <div class="proposal-votes">
                <span class="vote-for">85% For</span>
                <span class="vote-against">15% Against</span>
              </div>
              <button class="btn-secondary">View Details</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Voting View -->
      <div v-else-if="currentView === 'voting'" class="content-area">
        <div class="info-card">
          <h3>Your Voting Power</h3>
          <p class="voting-power">1,000 LMN</p>
          <p class="voting-desc">Based on your token holdings</p>
        </div>
      </div>

      <!-- Treasury View -->
      <div v-else-if="currentView === 'treasury'" class="content-area">
        <div class="treasury-list">
          <div class="treasury-item">
            <div class="asset-info">
              <span class="asset-name">Ethereum (ETH)</span>
              <span class="asset-value">145.8 ETH</span>
            </div>
            <span class="asset-usd">$420,000</span>
          </div>
          <div class="treasury-item">
            <div class="asset-info">
              <span class="asset-name">Lumen Token (LMN)</span>
              <span class="asset-value">1,000,000 LMN</span>
            </div>
            <span class="asset-usd">$50,000</span>
          </div>
        </div>
      </div>

      <!-- Members View -->
      <div v-else-if="currentView === 'members'" class="content-area">
        <div class="members-list">
          <div class="member-item" v-for="i in 5" :key="i">
            <div class="member-avatar">{{ i }}</div>
            <div class="member-info">
              <span class="member-address">0x1234...abcd</span>
              <span class="member-power">{{ 10000 - i * 1000 }} LMN</span>
            </div>
          </div>
        </div>
      </div>
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
import { ref } from 'vue';
import { 
  Users,
  FileText,
  Vote,
  Wallet,
  Plus,
  X
} from 'lucide-vue-next';

const currentView = ref<'proposals' | 'voting' | 'treasury' | 'members'>('proposals');

// Modal states
const showCreateProposalModal = ref(false);
const showVoteModal = ref(false);
const selectedProposal = ref<{ title: string } | null>(null);
const voteChoice = ref('');

// Proposal form
const proposalForm = ref({
  title: '',
  description: '',
  category: 'governance',
  duration: '7'
});

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

// Create Proposal Modal
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

// Vote Modal
function openVoteModal(proposal?: { title: string }) {
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
</script>

<style scoped>
.dao-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-tertiary, #f0f2f5);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--bg-primary, #ffffff);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: #1a1a2e;
  border-right: 2px solid var(--border-color, #e5e7eb);
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
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
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.nav-item.active {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-primary, #fff);
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
  color: var(--text-primary, #1e293b);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0.25rem 0 0 0;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
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
  box-shadow: 0 6px 20px rgba(52, 152, 219, 0.35);
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--hover-bg, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
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
  background: linear-gradient(135deg, var(--bg-secondary, #f8fafc) 0%, var(--hover-bg, #f1f5f9) 100%);
  border-radius: 12px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
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
  color: var(--text-primary, #1e293b);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
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
  border: 1px solid var(--border-color, #e2e8f0);
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
  color: var(--text-secondary, #64748b);
}

.proposal-status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.proposal-status.active {
  background: #dbeafe;
  color: #2563eb;
}

.proposal-status.passed {
  background: #dcfce7;
  color: #16a34a;
}

.proposal-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem 0;
}

.proposal-desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
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
  color: #16a34a;
}

.vote-against {
  color: #dc2626;
}

/* Info Card */
.info-card {
  padding: 2rem;
  background: var(--card-bg, #f8fafc);
  border-radius: 16px;
  text-align: center;
}

.info-card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  margin: 0 0 0.5rem 0;
}

.voting-power {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem 0;
}

.voting-desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
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
  border: 1px solid var(--border-color, #e2e8f0);
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
  color: var(--text-primary, #1e293b);
}

.asset-value {
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
}

.asset-usd {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
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
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

.member-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
}

.member-info {
  display: flex;
  flex-direction: column;
}

.member-address {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
}

.member-power {
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
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
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
}

.modal-body {
  padding: 1.5rem;
}

.modal-desc {
  color: var(--text-secondary, #64748b);
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
  color: var(--text-primary, #475569);
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
  background: var(--bg-primary, white);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-textarea {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
  background: var(--bg-primary, white);
  transition: all 0.2s ease;
  resize: vertical;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-select {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
  background: var(--bg-primary, white);
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-select:hover {
  border-color: #cbd5e1;
}

.form-select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.proposal-requirements {
  background: var(--card-bg, #f0f9ff);
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
  color: var(--text-secondary, #0369a1);
}

.requirement-item svg {
  flex-shrink: 0;
  color: #0284c7;
}

.btn-modal-primary {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
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
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.btn-modal-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.proposal-title-card {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
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
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
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
  background: var(--card-bg, #ffffff);
  transition: all 0.2s ease;
}

.vote-option:hover .vote-option-content {
  border-color: #cbd5e1;
  background: var(--bg-secondary, #f8fafc);
}

.vote-option.selected .vote-option-content {
  border-color: #3498db;
  background: var(--card-bg, #f0f9ff);
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
  background: #d1fae5;
  color: #059669;
}

.vote-icon.against {
  background: var(--card-bg, #fee2e2);
  color: #dc2626;
}

.vote-icon.abstain {
  background: var(--card-bg, #f3f4f6);
  color: #6b7280;
}

.vote-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.25rem;
}

.vote-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
}

.voting-power {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  margin-bottom: 1.5rem;
}

.power-label {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.power-value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
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
