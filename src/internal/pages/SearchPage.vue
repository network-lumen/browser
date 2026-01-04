<template>
  <div class="search-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Search :size="24" />
        </div>
        <span class="logo-text">Search</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Filter</span>
          <button 
            class="nav-item"
            :class="{ active: currentFilter === 'all' }"
            @click="currentFilter = 'all'"
          >
            <Globe :size="18" />
            <span>All Results</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentFilter === 'files' }"
            @click="currentFilter = 'files'"
          >
            <FileText :size="18" />
            <span>Files</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentFilter === 'domains' }"
            @click="currentFilter = 'domains'"
          >
            <Hash :size="18" />
            <span>Domains</span>
          </button>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>Search</h1>
          <p>Search across IPFS content and domains</p>
        </div>
      </header>

      <!-- Search Box -->
      <div class="search-box">
        <Search :size="20" />
        <input 
          type="text" 
          placeholder="Search for files, domains, or content..." 
          v-model="searchQuery"
          @keyup.enter="performSearch"
        />
        <button class="search-btn" @click="performSearch">Search</button>
      </div>

      <!-- Results -->
      <div class="content-area">
        <div v-if="!hasSearched" class="empty-state">
          <div class="empty-icon">
            <Search :size="48" />
          </div>
          <h3>Start searching</h3>
          <p>Enter a query to find files, domains, and content</p>
        </div>

        <div v-else-if="searchQuery && hasSearched" class="results-section">
          <p class="results-info">Showing results for "{{ searchQuery }}"</p>
          
          <div v-if="currentFilter === 'all' || currentFilter === 'files'" class="result-group">
            <h3>Files</h3>
            <div class="result-list">
              <div class="result-item" v-for="i in 3" :key="'file-' + i">
                <div class="result-icon">
                  <FileText :size="20" />
                </div>
                <div class="result-info">
                  <span class="result-title">Document {{ i }}.pdf</span>
                  <span class="result-desc">QmX{{ i }}abc...def • 2.5 MB</span>
                </div>
                <button class="btn-secondary">Open</button>
              </div>
            </div>
          </div>

          <div v-if="currentFilter === 'all' || currentFilter === 'domains'" class="result-group">
            <h3>Domains</h3>
            <div class="result-list">
              <div class="result-item" v-for="i in 2" :key="'domain-' + i">
                <div class="result-icon">
                  <Hash :size="20" />
                </div>
                <div class="result-info">
                  <span class="result-title">example{{ i }}.eth</span>
                  <span class="result-desc">Web3 domain</span>
                </div>
                <button class="btn-secondary">View</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import { Search, Globe, FileText, Hash } from 'lucide-vue-next';

const currentFilter = ref<'all' | 'files' | 'domains'>('all');
const searchQuery = ref('');
const hasSearched = ref(false);

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

function performSearch() {
  const query = searchQuery.value.trim();
  if (!query) return;
  
  hasSearched.value = true;
  
  if (/^\d+$/.test(query)) {
    const height = parseInt(query);
    navigateToBlock(height);
  }
  else if (/^[A-Fa-f0-9]{64}$/.test(query)) {
    navigateToTransaction(query.toUpperCase());
  }
  else if (/^lmn1[a-z0-9]{38,}$/.test(query)) {
    navigateToAddress(query);
  }
  else {
    hasSearched.value = true;
  }
}

function navigateToBlock(height: number) {
  if (openInNewTab) {
    openInNewTab(`lumen://explorer/block/${height}`);
  } else {
    window.location.href = `lumen://explorer/block/${height}`;
  }
}

function navigateToTransaction(hash: string) {
  if (openInNewTab) {
    openInNewTab(`lumen://explorer/tx/${hash}`);
  } else {
    window.location.href = `lumen://explorer/tx/${hash}`;
  }
}

function navigateToAddress(address: string) {
  if (openInNewTab) {
    openInNewTab(`lumen://explorer/address/${address}`);
  } else {
    window.location.href = `lumen://explorer/address/${address}`;
  }
}
</script>

<style scoped>
.search-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-primary);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: 2px solid var(--border-color);
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
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
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
  background: var(--bg-primary);
  margin: 0;
  border-radius: 0;
}

.content-header {
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

/* Search Box */
.search-box {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: var(--text-primary);
  outline: none;
}

.search-box input::placeholder {
  color: var(--text-tertiary);
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

.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--hover-bg, #f1f5f9);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: var(--text-primary, #1e293b);
}

/* Content Area */
.content-area {
  flex: 1;
  overflow-y: auto;
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
  color: var(--text-tertiary, #94a3b8);
  margin-bottom: 1.5rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  font-size: 0.9rem;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* Results */
.results-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.results-info {
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.result-group h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 1rem 0;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--card-bg, #ffffff);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.result-icon {
  width: 40px;
  height: 40px;
  background: var(--hover-bg, #f1f5f9);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #64748b);
  flex-shrink: 0;
}

.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.result-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.result-desc {
  font-size: 0.75rem;
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
  .search-page {
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
</style>
