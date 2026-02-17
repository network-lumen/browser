<template>
  <div class="my-gateways-page internal-page">
    <InternalSidebar title="My Gateways" :icon="Server" activeKey="my-gateways">
      <nav class="lsb-nav">
        <div class="lsb-section">
          <span class="lsb-label">Manage</span>
          <button type="button" class="lsb-item active">
            <List :size="18" />
            <span>Gateway List</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <main class="main-content">
      <header class="content-header">
        <div class="header-text">
          <h1>My Private Gateways</h1>
          <p>Manage your private IPFS gateways for secure content delivery</p>
        </div>
      </header>

      <div class="content-area">
        <!-- Embedded Server Card -->
        <div class="embedded-server-card" :class="{ active: embeddedServerRunning }">
          <div class="server-card-header">
            <div class="server-icon">
              <svg v-if="embeddedServerRunning" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
              <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </div>
            <div class="server-info">
              <h3>Embedded Gateway Server</h3>
              <p v-if="embeddedServerRunning" class="server-url">{{ embeddedServerUrl }}</p>
              <p v-else class="server-status-text">Start your personal gateway server</p>
            </div>
            <div class="server-status-badge" :class="{ running: embeddedServerRunning }">
              <span class="status-dot"></span>
              {{ embeddedServerRunning ? 'Running' : 'Stopped' }}
            </div>
          </div>

          <div class="server-card-actions">
            <button 
              v-if="embeddedServerRunning"
              type="button" 
              class="btn-outline"
              @click="viewApiKey"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
              Copy API Key
            </button>
            <button 
              type="button" 
              :class="embeddedServerRunning ? 'btn-stop' : 'btn-start'"
              @click="toggleEmbeddedServer"
              :disabled="serverLoading"
            >
              <svg v-if="embeddedServerRunning" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              {{ embeddedServerRunning ? 'Stop Server' : 'Start Server' }}
            </button>
          </div>
        </div>

        <!-- External Gateways Section -->
        <div class="section-header">
          <h2>External Gateways</h2>
          <button type="button" class="btn-add" @click="openCreateModal">
            <Plus :size="18" />
            Add Gateway
          </button>
        </div>

        <div v-if="loading" class="empty-state">
          <div class="spinner"></div>
          <p>Loading gateways...</p>
        </div>

        <div v-else-if="error" class="empty-state">
          <AlertCircle :size="48" class="error-icon" />
          <h2>Error Loading Gateways</h2>
          <p>{{ error }}</p>
          <button class="btn-secondary" @click="loadGateways">Try Again</button>
        </div>

        <div v-else-if="gateways.length === 0" class="empty-state">
          <Server :size="48" class="empty-icon" />
          <h2>No Gateways Yet</h2>
          <p>Create your first private gateway to get started</p>
          <button class="btn-primary" @click="openCreateModal">
            <Plus :size="18" />
            Create Gateway
          </button>
        </div>

        <div v-else class="gateways-grid">
          <div v-for="gateway in gateways" :key="gateway.id" class="gateway-card">
            <div class="gateway-header">
              <div class="gateway-title">
                <div class="status-dot" :class="{ active: gateway.status === 'active' }"></div>
                <h3>{{ gateway.name }}</h3>
              </div>
              <span class="gateway-badge" :class="`badge-${gateway.status}`">
                {{ gateway.status }}
              </span>
            </div>

            <div class="gateway-info">
              <div class="info-row">
                <span class="info-label">URL:</span>
                <span class="info-value mono">{{ gateway.url }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">ID:</span>
                <span class="info-value mono">{{ gateway.id }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Created:</span>
                <span class="info-value">{{ formatDate(gateway.createdAt) }}</span>
              </div>
            </div>

            <div class="gateway-actions">
              <button class="btn-secondary" @click="openEditModal(gateway)">
                <Edit2 :size="16" />
                Edit
              </button>
              <button class="btn-danger" @click="confirmDelete(gateway)">
                <Trash2 :size="16" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create/Edit Modal -->
      <Transition name="modal">
        <div v-if="showModal" class="modal-overlay" @click="closeModal">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h2>{{ editingGateway ? 'Edit External Gateway' : 'Add External Gateway' }}</h2>
              <button class="icon-btn" @click="closeModal">×</button>
            </div>

            <div class="modal-body">
              <p class="modal-description">
                Add an external private gateway (e.g., your VPS or company server). 
                For local embedded server, use the "Start Embedded Server" button instead.
              </p>
              
              <div class="form-group">
                <label class="form-label">Gateway Name</label>
                <input
                  v-model="form.name"
                  type="text"
                  class="form-input"
                  placeholder="My Private Gateway"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Gateway URL</label>
                <input
                  v-model="form.url"
                  type="text"
                  class="form-input"
                  placeholder="https://gateway.example.com"
                />
              </div>

              <div class="form-group">
                <label class="form-label">API Key</label>
                <input
                  v-model="form.apiKey"
                  type="password"
                  class="form-input"
                  placeholder="Your gateway API key"
                />
              </div>

              <div v-if="modalError" class="error-message">
                {{ modalError }}
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn-secondary" @click="closeModal" :disabled="saving">
                Cancel
              </button>
              <button class="btn-primary" @click="saveGateway" :disabled="saving || !isFormValid">
                {{ saving ? 'Saving...' : (editingGateway ? 'Update' : 'Create') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Delete Confirmation Modal -->
      <Transition name="modal">
        <div v-if="showDeleteConfirm" class="modal-overlay" @click="closeDeleteConfirm">
          <div class="modal-content small" @click.stop>
            <div class="modal-header">
              <h2>Delete Gateway</h2>
              <button class="icon-btn" @click="closeDeleteConfirm">×</button>
            </div>

            <div class="modal-body">
              <p>Are you sure you want to delete <strong>{{ deletingGateway?.name }}</strong>?</p>
              <p class="warning-text">This action cannot be undone.</p>
            </div>

            <div class="modal-actions">
              <button class="btn-secondary" @click="closeDeleteConfirm" :disabled="deleting">
                Cancel
              </button>
              <button class="btn-danger" @click="deleteGateway" :disabled="deleting">
                {{ deleting ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Server, List, Plus, Edit2, Trash2, AlertCircle } from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { useToast } from '../../composables/useToast';

interface Gateway {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'inactive' | 'error';
  owner: string;
}

const gateways = ref<Gateway[]>([]);
const loading = ref(false);
const error = ref('');
const showModal = ref(false);
const showDeleteConfirm = ref(false);
const editingGateway = ref<Gateway | null>(null);
const deletingGateway = ref<Gateway | null>(null);
const saving = ref(false);
const deleting = ref(false);
const modalError = ref('');

// Embedded server state
const embeddedServerRunning = ref(false);
const embeddedServerPort = ref<number | null>(null);
const embeddedServerUrl = ref<string | null>(null);
const serverLoading = ref(false);

const form = ref({
  name: '',
  url: '',
  apiKey: ''
});

const toast = useToast();

const isFormValid = computed(() => {
  return form.value.name.trim() && form.value.url.trim() && form.value.apiKey.trim();
});

async function loadGateways() {
  loading.value = true;
  error.value = '';
  try {
    const result = await (window as any).lumen.settingsLoadGateways();
    gateways.value = result || [];
  } catch (e: any) {
    error.value = e.message || 'Failed to load gateways';
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingGateway.value = null;
  form.value = {
    name: '',
    url: '',
    apiKey: ''
  };
  modalError.value = '';
  showModal.value = true;
}

function openEditModal(gateway: Gateway) {
  editingGateway.value = gateway;
  form.value = {
    name: gateway.name,
    url: gateway.url,
    apiKey: gateway.apiKey
  };
  modalError.value = '';
  showModal.value = true;
}

function closeModal() {
  if (saving.value) return;
  showModal.value = false;
  editingGateway.value = null;
  modalError.value = '';
}

async function saveGateway() {
  if (!isFormValid.value || saving.value) return;

  modalError.value = '';
  saving.value = true;

  try {
    if (editingGateway.value) {
      // Update existing gateway
      const result = await (window as any).lumen.settingsUpdateGateway(
        editingGateway.value.id,
        {
          name: form.value.name.trim(),
          url: form.value.url.trim(),
          apiKey: form.value.apiKey.trim()
        }
      );

      if (!result.ok) {
        modalError.value = result.error || 'Failed to update gateway';
        return;
      }
      
      toast.success('Gateway updated successfully');
    } else {
      // Create new gateway
      const newGateway: Gateway = {
        id: crypto.randomUUID(),
        name: form.value.name.trim(),
        url: form.value.url.trim(),
        apiKey: form.value.apiKey.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active',
        owner: ''
      };

      const result = await (window as any).lumen.settingsAddGateway(newGateway);

      if (!result.ok) {
        modalError.value = result.error || 'Failed to create gateway';
        return;
      }
      
      toast.success('Gateway created successfully');
    }

    await loadGateways();
    closeModal();
  } catch (e: any) {
    modalError.value = e.message || 'Failed to save gateway';
  } finally {
    saving.value = false;
  }
}

function confirmDelete(gateway: Gateway) {
  deletingGateway.value = gateway;
  showDeleteConfirm.value = true;
}

function closeDeleteConfirm() {
  if (deleting.value) return;
  showDeleteConfirm.value = false;
  deletingGateway.value = null;
}

async function deleteGateway() {
  if (!deletingGateway.value || deleting.value) return;

  deleting.value = true;

  try {
    const result = await (window as any).lumen.settingsDeleteGateway(deletingGateway.value.id);

    if (!result.ok) {
      toast.error(result.error || 'Failed to delete gateway');
      return;
    }

    toast.success('Gateway deleted successfully');
    await loadGateways();
    closeDeleteConfirm();
  } catch (e: any) {
    toast.error(e.message || 'Failed to delete gateway');
  } finally {
    deleting.value = false;
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

async function checkEmbeddedServerStatus() {
  try {
    const status = await (window as any).lumen.gatewayServerStatus();
    embeddedServerRunning.value = status.running;
    embeddedServerPort.value = status.port;
    embeddedServerUrl.value = status.url;
  } catch (e) {
    console.error('Failed to check embedded server status:', e);
  }
}

async function viewApiKey() {
  try {
    const result = await (window as any).lumen.gatewayServerGetApiKey();
    
    if (result.ok && result.apiKey) {
      // Copy to clipboard
      await navigator.clipboard.writeText(result.apiKey);
      
      toast.success(
        'API Key copied to clipboard!',
        { 
          title: 'API Key',
          duration: 5000 
        }
      );
    } else {
      toast.error('No API key found. Please start the server first.');
    }
  } catch (e: any) {
    toast.error(e.message || 'Failed to get API key');
  }
}

async function toggleEmbeddedServer() {
  serverLoading.value = true;
  try {
    if (embeddedServerRunning.value) {
      // Stop server
      const result = await (window as any).lumen.gatewayServerStop();
      if (result.ok) {
        embeddedServerRunning.value = false;
        embeddedServerPort.value = null;
        embeddedServerUrl.value = null;
        toast.success('Embedded Gateway Server stopped');
      } else {
        toast.error(result.error || 'Failed to stop embedded server');
      }
    } else {
      // Start server
      const result = await (window as any).lumen.gatewayServerStart({ port: 3100 });
      if (result.ok) {
        embeddedServerRunning.value = true;
        embeddedServerPort.value = result.port;
        embeddedServerUrl.value = result.url;
        
        // Copy API key to clipboard
        try {
          await navigator.clipboard.writeText(result.apiKey);
          
          // Show success notification
          toast.success(
            `Server running at ${result.url}`,
            { 
              title: 'Embedded Gateway Server Started',
              duration: 8000 
            }
          );
          
          // Show API key copied notification
          toast.success(
            `API Key copied to clipboard!`,
            { 
              title: 'API Key Ready',
              duration: 6000 
            }
          );
        } catch (clipboardError) {
          // If clipboard fails, show API key in notification
          toast.success(
            `Server running at ${result.url}`,
            { 
              title: 'Embedded Gateway Server Started',
              duration: 8000 
            }
          );
          
          toast.info(
            `API Key: ${result.apiKey}`,
            { 
              title: 'Save Your API Key',
              duration: 15000 
            }
          );
        }
      } else {
        toast.error(result.error || 'Failed to start embedded server');
      }
    }
  } catch (e: any) {
    toast.error(e.message || 'Failed to toggle embedded server');
  } finally {
    serverLoading.value = false;
  }
}

onMounted(() => {
  loadGateways();
  checkEmbeddedServerStatus();
});
</script>

<style scoped>
.my-gateways-page {
  display: flex;
  height: 100vh;
  background: var(--bg-primary);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-secondary);
}

.content-header {
  margin-bottom: 2rem;
}

.header-text h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.header-text p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

/* Embedded Server Card */
.embedded-server-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 16px;
  padding: 1.75rem;
  margin-bottom: 2.5rem;
  transition: all 0.3s ease;
}

.embedded-server-card.active {
  border-color: var(--ios-green);
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.05) 0%, rgba(52, 199, 89, 0.02) 100%);
  box-shadow: 0 4px 20px rgba(52, 199, 89, 0.1);
}

.server-card-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.server-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hover-bg);
  border-radius: 12px;
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.embedded-server-card.active .server-icon {
  background: rgba(52, 199, 89, 0.15);
  color: var(--ios-green);
}

.server-info {
  flex: 1;
}

.server-info h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.server-url {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.875rem;
  color: var(--ios-blue);
  margin: 0;
}

.server-status-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.server-status-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(142, 142, 147, 0.15);
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.server-status-badge.running {
  background: rgba(52, 199, 89, 0.15);
  color: var(--ios-green);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.server-card-actions {
  display: flex;
  gap: 0.75rem;
}

/* Section Header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* Buttons */
.btn-outline,
.btn-start,
.btn-stop,
.btn-add {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-outline {
  background: transparent;
  border: 1.5px solid var(--border-color);
  color: var(--text-primary);
  flex: 1;
}

.btn-outline:hover {
  background: var(--hover-bg);
  border-color: var(--ios-blue);
  color: var(--ios-blue);
  transform: translateY(-1px);
}

.btn-start {
  background: linear-gradient(135deg, #34C759 0%, #30B350 100%);
  color: white;
  flex: 1;
  box-shadow: 0 2px 8px rgba(52, 199, 89, 0.3);
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 199, 89, 0.4);
}

.btn-stop {
  background: linear-gradient(135deg, #FF3B30 0%, #E8352A 100%);
  color: white;
  flex: 1;
  box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
}

.btn-stop:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 59, 48, 0.4);
}

.btn-add {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-outline:disabled,
.btn-start:disabled,
.btn-stop:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon,
.error-icon {
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

.error-icon {
  color: var(--ios-red);
}

.empty-state h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.empty-state p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--ios-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.gateways-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.25rem;
}

.gateway-card {
  background: var(--card-bg);
  border: 1.5px solid var(--border-color);
  border-radius: 14px;
  padding: 1.5rem;
  transition: all 0.25s ease;
}

.gateway-card:hover {
  border-color: var(--ios-blue);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transform: translateY(-4px);
}

.gateway-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.gateway-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
}

.status-dot.active {
  background: var(--ios-green);
}

.gateway-title h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.gateway-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.badge-active {
  background: rgba(52, 199, 89, 0.15);
  color: var(--ios-green);
}

.badge-inactive {
  background: rgba(142, 142, 147, 0.15);
  color: var(--text-secondary);
}

.badge-error {
  background: rgba(255, 59, 48, 0.15);
  color: var(--ios-red);
}

.gateway-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.info-label {
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 60px;
}

.info-value {
  color: var(--text-primary);
  word-break: break-all;
}

.info-value.mono {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.8rem;
}

.gateway-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--hover-bg);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  flex: 1;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--border-color);
  color: var(--text-primary);
}

.btn-danger {
  background: rgba(255, 59, 48, 0.1);
  color: var(--ios-red);
  border: 1px solid rgba(255, 59, 48, 0.2);
  flex: 1;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(255, 59, 48, 0.15);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--card-bg);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-content.small {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.modal-description {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--ios-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message {
  padding: 0.75rem 1rem;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.2);
  border-radius: 10px;
  color: var(--ios-red);
  font-size: 0.875rem;
  margin-top: 1rem;
}

.warning-text {
  color: var(--ios-orange);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.modal-actions .btn-secondary,
.modal-actions .btn-primary,
.modal-actions .btn-danger {
  flex: 1;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
