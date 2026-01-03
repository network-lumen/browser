<template>
  <div class="domain-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Globe :size="24" />
        </div>
        <span class="logo-text">Domains</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Manage</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'my-domains' }"
            @click="currentView = 'my-domains'"
          >
            <List :size="18" />
            <span>My Domains</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'register' }"
            @click="currentView = 'register'"
          >
            <Plus :size="18" />
            <span>Register</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Browse</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'marketplace' }"
            @click="currentView = 'marketplace'"
          >
            <ShoppingBag :size="18" />
            <span>Marketplace</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'favorites' }"
            @click="currentView = 'favorites'"
          >
            <Star :size="18" />
            <span>Favorites</span>
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
        <button v-if="currentView === 'my-domains'" class="btn-primary" @click="openRegisterModal">
          <Plus :size="18" />
          Register Domain
        </button>
      </header>

      <!-- Search Box -->
      <div class="search-box" v-if="currentView === 'register' || currentView === 'marketplace'">
        <Search :size="20" />
        <input
          type="text"
          placeholder="Search for a domain name..."
          v-model="searchQuery"
          @keyup.enter="runSearch"
        />
        <button class="search-btn" @click="runSearch">
          {{ searchBusy ? 'Searching...' : 'Search' }}
        </button>
      </div>

      <!-- My Domains View -->
      <div v-if="currentView === 'my-domains'" class="content-area">
        <div class="domains-toolbar">
          <div class="owner-input">
            <label class="owner-label">Owner address (Lumen)</label>
            <input
              type="text"
              class="form-input"
              v-model="ownerAddress"
              placeholder="lmn1..."
            />
          </div>
          <button class="btn-primary small" @click="loadMyDomains" :disabled="domainsLoading || !ownerAddress">
            <span v-if="domainsLoading">Loading...</span>
            <span v-else>Load domains</span>
          </button>
        </div>

        <p v-if="domainsError" class="error-text">{{ domainsError }}</p>

        <div class="empty-state" v-if="!domainsLoading && domains.length === 0">
          <div class="empty-icon">
            <Globe :size="48" />
          </div>
          <h3>No domains found</h3>
          <p>Load domains for your Lumen address or register a new one.</p>
          <button class="btn-primary" @click="openRegisterModal">Register Domain</button>
        </div>
        <div v-else-if="domainsLoading" class="empty-state">
          <div class="empty-icon">
            <Globe :size="48" />
          </div>
          <h3>Loading domains...</h3>
          <p>Please wait while we query the network.</p>
        </div>
        <div v-else class="domains-grid">
          <div class="domain-card" v-for="domain in domains" :key="domain.name">
            <div class="domain-info">
              <span class="domain-name">{{ domain.name }}</span>
              <span class="domain-expires">
                {{ domain.expiryLabel }}
              </span>
            </div>
            <div class="domain-actions">
              <button class="btn-icon" :title="'Open lumen://' + domain.name">
                <ExternalLink :size="16" />
              </button>
              <button class="btn-icon" @click="openSettingsModal(domain)"><Settings :size="16" /></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Register View -->
      <div v-else-if="currentView === 'register'" class="content-area">
        <div class="register-results" v-if="searchQuery">
          <div class="result-item" :class="{ available: searchResult?.available === true }">
            <div class="result-info">
              <span class="result-name">{{ fullSearchName }}</span>
              <span class="result-status">
                <span v-if="searchBusy">Checking...</span>
                <span v-else-if="searchResult?.available === true">Available</span>
                <span v-else-if="searchResult?.available === false">Already taken</span>
                <span v-else>Unknown</span>
              </span>
            </div>
            <div class="result-action">
              <span class="result-price" v-if="searchResult && searchResult.priceLabel">
                {{ searchResult.priceLabel }}
              </span>
              <button class="btn-primary" @click="openRegisterModal" :disabled="!searchResult?.available">
                Register
              </button>
            </div>
          </div>
        </div>
        <div v-else class="info-card">
          <h3>Register a Web3 Domain</h3>
          <p>Search for your desired domain name above to check availability and pricing.</p>
        </div>
      </div>

      <!-- Marketplace View -->
      <div v-else-if="currentView === 'marketplace'" class="content-area">
        <div class="domains-grid">
          <div class="domain-card" v-for="i in 4" :key="i">
            <div class="domain-info">
              <span class="domain-name">example{{ i }}.eth</span>
              <span class="domain-price">0.5 ETH</span>
            </div>
            <button class="btn-secondary">View</button>
          </div>
        </div>
      </div>

      <!-- Favorites View -->
      <div v-else-if="currentView === 'favorites'" class="content-area">
        <div class="empty-state">
          <div class="empty-icon">
            <Star :size="48" />
          </div>
          <h3>No favorites</h3>
          <p>Star domains to add them here</p>
        </div>
      </div>
    </main>

    <!-- Register Domain Modal -->
    <Transition name="fade">
      <div v-if="showRegisterModal" class="modal-overlay" @click="closeRegisterModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Register Domain</h3>
            <button class="modal-close" @click="closeRegisterModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">Register your Web3 domain name</p>
            
            <div class="form-group">
              <label>Domain Name</label>
              <div class="domain-input-wrapper">
                <input
                  type="text"
                  class="form-input"
                  v-model="registerForm.domainName"
                  placeholder="myname"
                  @blur="refreshAvailability"
                />
                <span class="domain-suffix">.lumen</span>
              </div>
              <div v-if="registerForm.domainName" class="domain-availability" :class="{ available: domainAvailable }">
                <svg v-if="domainAvailable" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM6.4 12L2.4 8L3.52 6.88L6.4 9.76L12.48 3.68L13.6 4.8L6.4 12Z"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM10.59 10.59L8 8L5.41 10.59L4 9.17L6.59 6.59L4 4L5.41 2.59L8 5.17L10.59 2.59L12 4L9.41 6.59L12 9.17L10.59 10.59Z"/>
                </svg>
                <span>{{ domainAvailable ? 'Available' : 'Already taken' }}</span>
              </div>
            </div>
            
            <div class="form-group">
              <label>Registration Period</label>
              <select class="form-select" v-model="registerForm.years" @change="refreshPrice">
                <option value="1">1 Year</option>
                <option value="2">2 Years</option>
                <option value="3">3 Years</option>
              </select>
            </div>
            
            <div class="price-summary">
              <div class="price-row">
                <span>Registration Fee:</span>
                <span class="price-value">{{ registrationFeeLabel }}</span>
              </div>
              <div class="price-row">
                <span>Gas Fee (Est.):</span>
                <span class="price-value">~0.0005 LMN</span>
              </div>
              <div class="price-row total">
                <span>Total:</span>
                <span class="price-value">{{ totalFeeLabel }}</span>
              </div>
            </div>
            
            <button class="btn-modal-primary" @click="confirmRegister" :disabled="!canRegister()">
              <Plus :size="18" />
              Register (preview only)
            </button>
            <p class="modal-desc" style="margin-top: 0.75rem; font-size: 0.78rem; color: #6b7280;">
              This open-source shell currently supports read-only DNS. Use the full Lumen browser to submit on-chain
              registration transactions.
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Domain Settings Modal -->
    <Transition name="fade">
      <div v-if="showSettingsModal" class="modal-overlay" @click="closeSettingsModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Domain Settings</h3>
            <button class="modal-close" @click="closeSettingsModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">Manage your domain settings and records</p>
            
            <div class="domain-info-card">
              <div class="domain-name-large">{{ selectedDomain?.name || 'mydomain.lumen' }}</div>
              <div class="domain-expiry">{{ selectedDomain?.expiryLabel || 'Expires: unknown' }}</div>
            </div>
            
            <div class="settings-section">
              <div class="section-title">Resolver (preview only)</div>
              <div class="form-group">
                <label>IPFS CID</label>
                <input type="text" class="form-input" v-model="settingsForm.ipfsHash" placeholder="Qm..." />
              </div>
            </div>
            
            <div class="modal-actions">
              <button class="btn-modal-secondary" @click="closeSettingsModal">Cancel</button>
              <button class="btn-modal-primary" @click="saveSettings">
                <Settings :size="18" />
                Save (preview)
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

  <script setup lang="ts">
  import { ref, computed } from 'vue';
  import { 
    Globe,
    List,
    Plus,
    ShoppingBag,
    Star,
    Search,
    ExternalLink,
    Settings,
    X
  } from 'lucide-vue-next';
  
  type DomainRow = {
    name: string;
    expiryLabel: string;
  };
  
  type SearchResult = {
    available: boolean | null;
    priceUlmn: number | null;
    priceLabel: string | null;
  };
  
  const currentView = ref<'my-domains' | 'register' | 'marketplace' | 'favorites'>('my-domains');
  const searchQuery = ref('');
  const searchBusy = ref(false);
  const searchResult = ref<SearchResult | null>(null);
  
  const ownerAddress = ref('');
  const domains = ref<DomainRow[]>([]);
  const domainsLoading = ref(false);
  const domainsError = ref('');
  
  const showRegisterModal = ref(false);
  const showSettingsModal = ref(false);
  const selectedDomain = ref<DomainRow | null>(null);
  const domainAvailable = ref(true);
  
  const registerForm = ref({
    domainName: '',
    years: '1'
  });
  
  const settingsForm = ref({
    ipfsHash: ''
  });
  
  const fullSearchName = computed(() => {
    const base = searchQuery.value.trim();
    return base ? `${base}.lumen` : '';
  });
  
  function getViewTitle(): string {
    const titles: Record<string, string> = {
      'my-domains': 'My Domains',
      register: 'Register Domain',
      marketplace: 'Marketplace',
      favorites: 'Favorites'
    };
    return titles[currentView.value] || 'Domains';
  }
  
  function getViewDescription(): string {
    const descs: Record<string, string> = {
      'my-domains': 'Manage your Lumen DNS domains (read-only)',
      register: 'Search and estimate registration for new domains',
      marketplace: 'Browse example domains',
      favorites: 'Your saved domains'
    };
    return descs[currentView.value] || '';
  }
  
  function prettyExpiry(expireAtSeconds: number | null | undefined): string {
    if (!expireAtSeconds || !Number.isFinite(expireAtSeconds)) return 'Expires: unknown';
    const ms = expireAtSeconds * 1000;
    try {
      const d = new Date(ms);
      const formatted = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      }).format(d);
      return `Expires ${formatted}`;
    } catch {
      return 'Expires: unknown';
    }
  }
  
  async function loadMyDomains() {
    domainsError.value = '';
    domainsLoading.value = true;
    domains.value = [];
    try {
      const addr = ownerAddress.value.trim();
      const anyWindow = window as any;
      const dnsApi = anyWindow?.lumen?.dns;
      if (!dnsApi || typeof dnsApi.listByOwnerDetailed !== 'function') {
        domainsError.value = 'DNS bridge not available.';
        return;
      }
      const res = await dnsApi.listByOwnerDetailed(addr);
      if (!res || res.ok === false) {
        domainsError.value = res?.error || 'Unable to load domains.';
        return;
      }
      const list = Array.isArray(res.data) ? res.data : [];
      domains.value = list
        .map((dom: any) => {
          const name = String(dom?.name || dom?.index || '').trim();
          const expireAt = dom?.expire_at ?? dom?.expireAt;
          const expireNum = typeof expireAt === 'string' ? parseInt(expireAt, 10) : Number(expireAt);
          return name
            ? {
                name,
                expiryLabel: prettyExpiry(Number.isFinite(expireNum) ? expireNum : undefined)
              }
            : null;
        })
        .filter((d: DomainRow | null): d is DomainRow => !!d);
    } catch (e) {
      console.error('[domains] loadMyDomains error', e);
      domainsError.value = 'Unexpected error while loading domains.';
    } finally {
      domainsLoading.value = false;
    }
  }
  
  async function runSearch() {
    if (!fullSearchName.value) return;
    searchBusy.value = true;
    searchResult.value = null;
    try {
      const anyWindow = window as any;
      const dnsApi = anyWindow?.lumen?.dns;
      if (!dnsApi || typeof dnsApi.getDomainInfo !== 'function') {
        searchResult.value = { available: null, priceUlmn: null, priceLabel: null };
        return;
      }
      const res = await dnsApi.getDomainInfo(fullSearchName.value);
      if (!res || res.ok === false) {
        const status = res?.status ?? 0;
        if (status === 404) {
          domainAvailable.value = true;
          searchResult.value = { available: true, priceUlmn: null, priceLabel: null };
        } else {
          domainAvailable.value = true;
          searchResult.value = { available: null, priceUlmn: null, priceLabel: null };
        }
        return;
      }
      const dom = res.data?.domain || res.data || {};
      const owner = String(dom?.owner || '').trim();
      const status = String(dom?.status || '').toLowerCase();
      const taken = !!owner && status !== 'free';
      domainAvailable.value = !taken;
      searchResult.value = {
        available: !taken,
        priceUlmn: null,
        priceLabel: null
      };
    } catch (e) {
      console.error('[domains] runSearch error', e);
      domainAvailable.value = true;
      searchResult.value = { available: null, priceUlmn: null, priceLabel: null };
    } finally {
      searchBusy.value = false;
    }
  }
  
  function openRegisterModal() {
    showRegisterModal.value = true;
    if (!registerForm.value.domainName && searchQuery.value) {
      registerForm.value.domainName = searchQuery.value.trim();
    }
    void refreshAvailability();
  }
  
  function closeRegisterModal() {
    showRegisterModal.value = false;
    registerForm.value = { domainName: '', years: '1' };
  }
  
  async function refreshAvailability() {
    const name = registerForm.value.domainName.trim();
    if (!name) {
      domainAvailable.value = true;
      return;
    }
    const fqdn = `${name}.lumen`;
    try {
      const anyWindow = window as any;
      const dnsApi = anyWindow?.lumen?.dns;
      if (!dnsApi || typeof dnsApi.getDomainInfo !== 'function') {
        domainAvailable.value = true;
        return;
      }
      const res = await dnsApi.getDomainInfo(fqdn);
      if (!res || res.ok === false) {
        const status = res?.status ?? 0;
        domainAvailable.value = status === 404;
        return;
      }
      const dom = res.data?.domain || res.data || {};
      const owner = String(dom?.owner || '').trim();
      const status = String(dom?.status || '').toLowerCase();
      const taken = !!owner && status !== 'free';
      domainAvailable.value = !taken;
    } catch (e) {
      console.error('[domains] refreshAvailability error', e);
      domainAvailable.value = true;
    }
  }
  
  function estimateRegistrationUlmn(): number {
    const years = parseInt(registerForm.value.years, 10) || 1;
    const days = years * 365;
    const months = days <= 0 ? 1 : Math.max(1, Math.round(days / 30));
    const minPricePerMonthUlmn = 2_000_000;
    return minPricePerMonthUlmn * months;
  }
  
  const registrationFeeLabel = computed(() => {
    if (!registerForm.value.domainName) return '—';
    const ulmn = estimateRegistrationUlmn();
    const lmn = ulmn / 1_000_000;
    return `${lmn.toFixed(3)} LMN`;
  });
  
  const totalFeeLabel = computed(() => {
    if (!registerForm.value.domainName) return '—';
    const base = estimateRegistrationUlmn() / 1_000_000;
    const gas = 0.0005;
    return `${(base + gas).toFixed(3)} LMN`;
  });
  
  function refreshPrice() {
    void registrationFeeLabel.value;
  }
  
  function canRegister(): boolean {
    return registerForm.value.domainName.length > 0 && domainAvailable.value;
  }
  
  function confirmRegister() {
    console.log('[domains] register preview:', {
      fqdn: `${registerForm.value.domainName.trim()}.lumen`,
      years: registerForm.value.years
    });
    closeRegisterModal();
  }
  
  function openSettingsModal(domain?: DomainRow) {
    selectedDomain.value = domain || null;
    showSettingsModal.value = true;
  }
  
  function closeSettingsModal() {
    showSettingsModal.value = false;
    selectedDomain.value = null;
  }
  
  function saveSettings() {
    console.log('[domains] settings preview (no on-chain update):', {
      domain: selectedDomain.value?.name,
      ipfsCid: settingsForm.value.ipfsHash
    });
    closeSettingsModal();
  }
  </script>

<style scoped>
.domain-page {
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

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hover-bg, #f1f5f9);
  border: none;
  border-radius: 8px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
}

.btn-icon:hover {
  background: var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
}

/* Search Box */
.search-box {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: var(--text-primary, #1e293b);
  outline: none;
}

.search-box input::placeholder {
  color: var(--text-tertiary, #94a3b8);
}

.search-btn {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

/* Content Area */
.content-area {
  flex: 1;
  overflow-y: auto;
}

/* Domains Grid */
.domains-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.domain-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: var(--bg-primary, white);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

.domain-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.domain-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.domain-expires,
.domain-price {
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
}

.domain-actions {
  display: flex;
  gap: 0.5rem;
}

/* Register Results */
.register-results {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: var(--bg-primary, white);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

.result-item.available {
  border-color: #22c55e;
  background: var(--card-bg, #f0fdf4);
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.result-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.result-status {
  font-size: 0.8rem;
  color: #22c55e;
}

.result-action {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.result-price {
  font-size: 0.875rem;
  color: #64748b;
}

/* Info Card */
.info-card {
  padding: 2rem;
  background: var(--card-bg, #f8fafc);
  border-radius: 16px;
  text-align: center;
}

.info-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.info-card p {
  font-size: 0.9rem;
  color: #64748b;
  margin: 0;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: var(--hover-bg, #f1f5f9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  margin-bottom: 1.5rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  font-size: 0.9rem;
  color: #64748b;
  margin: 0 0 1.5rem 0;
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
  .domain-page {
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
  
  .content-header {
    flex-direction: column;
    gap: 1rem;
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
  background: var(--card-bg, #ffffff);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--hover-bg, #f1f5f9);
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.modal-body {
  padding: 1.5rem;
}

.modal-desc {
  color: #64748b;
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
  color: #475569;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #1e293b;
  background: var(--card-bg, #ffffff);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-input.small {
  max-width: 120px;
}

.domain-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.domain-input-wrapper .form-input {
  padding-right: 4rem;
}

.domain-suffix {
  position: absolute;
  right: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
}

.domain-availability {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.domain-availability.available {
  background: #d1fae5;
  color: #065f46;
}

.domain-availability:not(.available) {
  background: var(--card-bg, #fee2e2);
  color: #991b1b;
}

.form-select {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #1e293b;
  background: var(--card-bg, #ffffff);
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

.price-summary {
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: #64748b;
}

.price-row.total {
  border-top: 1px solid #e2e8f0;
  margin-top: 0.5rem;
  padding-top: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.price-value {
  font-weight: 600;
  color: #1e293b;
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

.btn-modal-secondary {
  flex: 1;
  padding: 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: var(--card-bg, #ffffff);
  color: #64748b;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-modal-secondary:hover {
  background: var(--bg-secondary, #f8fafc);
  border-color: #cbd5e1;
}

.domain-info-card {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.domain-name-large {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.domain-expiry {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
}

.settings-section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1rem;
}

.text-record {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
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
