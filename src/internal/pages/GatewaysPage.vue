<template>
  <div class="gateways-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Server :size="24" />
        </div>
        <span class="logo-text">Gateways</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Manage</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'list' }"
            @click="currentView = 'list'"
          >
            <List :size="18" />
            <span>All Gateways</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'add' }"
            @click="currentView = 'add'"
          >
            <Plus :size="18" />
            <span>Add Gateway</span>
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
        <button v-if="currentView === 'list'" class="btn-primary" @click="currentView = 'add'">
          <Plus :size="18" />
          Add Gateway
        </button>
      </header>

      <!-- List View -->
      <div v-if="currentView === 'list'" class="content-area">
        <div class="gateways-list">
          <div class="gateway-card default">
            <div class="gateway-status online"></div>
            <div class="gateway-info">
              <div class="gateway-header">
                <span class="gateway-name">Local Gateway</span>
                <span class="gateway-badge">Default</span>
              </div>
              <span class="gateway-url">http://localhost:8088</span>
              <div class="gateway-stats">
                <span class="stat">✓ Online</span>
                <span class="stat">12ms</span>
              </div>
            </div>
            <button class="btn-secondary">Configure</button>
          </div>

          <div class="gateway-card">
            <div class="gateway-status online"></div>
            <div class="gateway-info">
              <div class="gateway-header">
                <span class="gateway-name">IPFS.io</span>
              </div>
              <span class="gateway-url">https://ipfs.io</span>
              <div class="gateway-stats">
                <span class="stat">✓ Online</span>
                <span class="stat">45ms</span>
              </div>
            </div>
            <button class="btn-secondary">Set Default</button>
          </div>

          <div class="gateway-card">
            <div class="gateway-status online"></div>
            <div class="gateway-info">
              <div class="gateway-header">
                <span class="gateway-name">Cloudflare IPFS</span>
              </div>
              <span class="gateway-url">https://cloudflare-ipfs.com</span>
              <div class="gateway-stats">
                <span class="stat">✓ Online</span>
                <span class="stat">38ms</span>
              </div>
            </div>
            <button class="btn-secondary">Set Default</button>
          </div>
        </div>
      </div>

      <!-- Add View -->
      <div v-else-if="currentView === 'add'" class="content-area">
        <div class="add-form">
          <div class="form-group">
            <label>Gateway Name</label>
            <input type="text" placeholder="e.g. My Custom Gateway" />
          </div>
          <div class="form-group">
            <label>Gateway URL</label>
            <input type="text" placeholder="https://your-gateway.com" />
          </div>
          <div class="form-actions">
            <button class="btn-primary">Add Gateway</button>
            <button class="btn-secondary" @click="currentView = 'list'">Cancel</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Server, List, Plus } from 'lucide-vue-next';

const currentView = ref<'list' | 'add'>('list');

function getViewTitle(): string {
  return currentView.value === 'list' ? 'IPFS Gateways' : 'Add Gateway';
}

function getViewDescription(): string {
  return currentView.value === 'list'
    ? 'Manage your IPFS gateway connections'
    : 'Add a new IPFS gateway';
}
</script>

<style scoped>
.gateways-page {
  display: flex;
  height: 100%;
  background: #f0f2f5;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: #1a1a2e;
  border-right: 1px solid #e5e7eb;
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
  color: #1e293b;
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
  color: #94a3b8;
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
  color: #64748b;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-item.active {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: #fff;
  margin: 0.5rem 0.5rem 0.5rem 0;
  border-radius: 16px;
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
  color: #1e293b;
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: #64748b;
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
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.8rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

.gateways-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gateway-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.gateway-card.default {
  border-color: #3498db;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.gateway-status {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #94a3b8;
}

.gateway-status.online {
  background: #22c55e;
}

.gateway-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gateway-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.gateway-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.gateway-badge {
  padding: 0.2rem 0.6rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}

.gateway-url {
  font-size: 0.85rem;
  color: #64748b;
  font-family: monospace;
}

.gateway-stats {
  display: flex;
  gap: 1rem;
}

.stat {
  font-size: 0.75rem;
  color: #64748b;
}

.add-form {
  max-width: 500px;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.9rem;
  color: #1e293b;
}

.form-group input:focus {
  outline: none;
  border-color: #3498db;
  background: white;
}

.form-actions {
  display: flex;
  gap: 1rem;
}

@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
}

@media (max-width: 700px) {
  .gateways-page {
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
