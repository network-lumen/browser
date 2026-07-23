<template>
  <div class="my-gateways-page internal-page flex bg-primary h-100vh">
    <InternalSidebar title="My Gateways" :icon="Server" activeKey="my-gateways">
      <nav class="lsb-nav flex flex-column gap-12px">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em mb-4px py-8px px-10px">Manage</span>
          <UiButton variant="none" type="button" class="lsb-item active bg-gradient-primary color-white shadow-primary border-none cursor-pointer flex-align-center gap-10px border-radius-sm w-full text-13px fw-500 text-left py-8px px-10px transition-all-015">
            <List :size="18" />
            <span>Gateway List</span>
          </UiButton>
        </div>
      </nav>
    </InternalSidebar>

    <main class="mygw-main flex-1 flex flex-column overflow-hidden bg-secondary py-32px px-40px">
      <UiPageHeader
        title="My Private Gateways"
        title-size="32px"
        subtitle="Manage your private IPFS gateways for secure content delivery"
      />

      <div class="pt-2px flex-1 min-h-0 overflow-y-auto">
        <!-- Embedded Server Card -->
        <UiCard
          class="mygw-server-card transition-all-03 mb-40px"
          :class="{ 'card-state-active-green': embeddedServerRunning }"
          border-class="border-2"
          radius="16px"
          padding-class="p-28px"
          :shadow="false"
        >
          <div class="mygw-server-card-header flex-align-center gap-20px mb-24px">
            <div class="mygw-server-icon flex-align-justify-center size-48px border-radius-12px color-text-secondary bg-hover transition-all-03" :class="{ 'bg-ios-green-a15 color-ios-green-override': embeddedServerRunning }">
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
            <div class="mygw-server-info flex-1">
              <h3 class="text-18px txt-weight-light color-text-primary mygw-server-info-h3 m-0px mb-4px">Embedded Gateway Server</h3>
              <p v-if="embeddedServerRunning" class="mygw-server-url m-0px text-14px color-ios-blue mono">{{ embeddedServerUrl }}</p>
              <p v-else class="mygw-server-status-text color-text-secondary m-0px text-14px">Start your personal gateway server</p>
            </div>
            <div class="flex-align-center gap-8px fw-500 border-radius-20px py-8px px-16px text-14px transition-all-03" :class="embeddedServerRunning ? 'badge-success color-success' : 'badge-neutral color-text-secondary'">
              <span class="mygw-status-dot border-radius-circle w-8px h-8px bg-text-tertiary animate-mygw-pulse" :class="{ 'bg-ios-green-active': embeddedServerRunning }"></span>
              {{ embeddedServerRunning ? 'Running' : 'Stopped' }}
            </div>
          </div>

          <div class="mygw-server-card-actions flex gap-12px">
            <UiButton variant="primary" v-if="embeddedServerRunning"
              type="button" 
             
              @click="viewApiKey">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
              Copy API Key
            </UiButton>
            <button 
              type="button" 
              class="disabled-opacity-50-not-allowed-no-transform-important flex-align-center gap-8px border-none cursor-pointer color-white fw-500 py-12px px-20px border-radius-10px text-14px transition-all-02" :class="embeddedServerRunning ? 'hover-lift-2-enabled hover-shadow-ios-red-lg' : 'hover-lift-2-enabled hover-shadow-ios-green-lg'" :style="serverToggleBtnStyle(embeddedServerRunning)"
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
        </UiCard>

        <!-- Whitelist Management Section (only show when embedded server is running) -->
        <div v-if="embeddedServerRunning" class="mb-40px border-top-1 pt-32px">
          <div class="mygw-section-header flex-align-center flex-justify-space-between mb-24px">
            <h2 class="txt-weight-light color-text-primary m-0px mygw-section-header-h2 text-20px">Whitelist Management</h2>
            <UiButton variant="primary" type="button" @click="openWhitelistModal">
              <Plus :size="18" />
              Add User
            </UiButton>
          </div>

          <UiEmptyState v-if="whitelistLoading" description="Loading whitelist...">
            <UiSpinner size="lg" />
          </UiEmptyState>

          <UiEmptyState v-else-if="whitelist.length === 0" description="No users in whitelist yet. Add wallet addresses to grant access." />

          <UiCard v-else class="overflow-hidden" border-class="border-15" radius="14px" padding="none" :shadow="false">
            <table class="mygw-whitelist-table-table w-full border-collapse-collapse">
              <thead class="bg-hover">
                <tr>
                  <th class="mygw-whitelist-table-th py-16px px-20px text-left text-14px txt-weight-light color-text-secondary border-bottom-1">Display Name</th>
                  <th class="mygw-whitelist-table-th py-16px px-20px text-left text-14px txt-weight-light color-text-secondary border-bottom-1">Wallet Address</th>
                  <th class="mygw-whitelist-table-th py-16px px-20px text-left text-14px txt-weight-light color-text-secondary border-bottom-1">Added</th>
                  <th class="mygw-whitelist-table-th py-16px px-20px text-left text-14px txt-weight-light color-text-secondary border-bottom-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr class="hover-bg-hover" v-for="(entry, idx) in whitelist" :key="entry.wallet_address">
                  <td class="mygw-whitelist-table-td py-16px px-20px text-14px color-text-primary" :class="{ 'border-bottom-1': idx !== whitelist.length - 1 }">
                    <div class="mygw-user-display-name fw-500 color-text-primary">
                      {{ getUserDisplayName(entry.wallet_address) }}
                    </div>
                  </td>
                  <td class="mygw-whitelist-table-td py-16px px-20px text-14px color-text-primary" :class="{ 'border-bottom-1': idx !== whitelist.length - 1 }">
                    <span class="mygw-mono-text color-text-secondary text-13px mono">{{ formatAddress(entry.wallet_address) }}</span>
                  </td>
                  <td class="mygw-whitelist-table-td py-16px px-20px text-14px color-text-primary" :class="{ 'border-bottom-1': idx !== whitelist.length - 1 }">{{ formatDate(entry.added_at) }}</td>
                  <td class="mygw-whitelist-table-td py-16px px-20px text-14px color-text-primary" :class="{ 'border-bottom-1': idx !== whitelist.length - 1 }">
                    <div class="mygw-table-actions flex gap-8px">
                      <UiButton variant="secondary" @click="editWhitelistEntry(entry)" title="Edit display name" class="mygw-btn-icon size-32px">
                        <Edit2 :size="14" />
                      </UiButton>
                      <UiButton variant="danger" @click="confirmRemoveFromWhitelist(entry)" title="Remove" class="mygw-btn-icon size-32px background-ios-red-a10-hover">
                        <Trash2 :size="14" />
                      </UiButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </UiCard>
        </div>

        <!-- External Gateways Section -->
        <div class="mygw-section-header flex-align-center flex-justify-space-between mb-24px">
          <h2 class="txt-weight-light color-text-primary m-0px mygw-section-header-h2 text-20px">External Gateways</h2>
          <UiButton variant="primary" type="button" @click="openCreateModal">
            <Plus :size="18" />
            Add Gateway
          </UiButton>
        </div>

        <UiEmptyState v-if="loading" description="Loading gateways...">
          <UiSpinner size="lg" />
        </UiEmptyState>

        <UiEmptyState v-else-if="error" title="Error Loading Gateways" :description="error">
          <AlertCircle :size="48" />
          <template #actions>
            <UiButton variant="secondary" @click="loadGateways">Try Again</UiButton>
          </template>
        </UiEmptyState>

        <UiEmptyState v-else-if="gateways.length === 0" title="No Gateways Yet" description="Create your first private gateway to get started">
          <Server :size="48" />
          <template #actions>
            <UiButton variant="primary" @click="openCreateModal" class="disabled-fade-50">
              <Plus :size="18" />
              Create Gateway
            </UiButton>
          </template>
        </UiEmptyState>

        <div v-else class="mygw-gateways-grid gap-20px grid grid-cols-auto-fill-340">
          <UiCard
            v-for="gateway in gateways"
            :key="gateway.id"
            class="hover-lift-4"
            padding="lg"
            border-class="border-15"
            radius="14px"
            :shadow="false"
            hoverable
            hover-class="transition-all-02 hover-border-ios-blue shadow-0-8-24-rgba-0-0-0-0-08-hover"
          >
            <div class="mygw-gateway-header flex-align-start flex-justify-space-between mb-16px">
              <div class="mygw-gateway-title flex-align-center gap-8px">
                <div class="mygw-status-dot border-radius-circle w-8px h-8px bg-text-tertiary animate-mygw-pulse" :class="{ 'bg-ios-green-active': gateway.status === 'active' }"></div>
                <h3 class="text-18px txt-weight-light color-text-primary m-0px">{{ gateway.name }}</h3>
              </div>
              <span class="fw-500 border-radius-12px text-capitalize text-12px py-4px px-12px" :class="gatewayStatusBadgeClass(gateway.status)">
                {{ gateway.status }}
              </span>
            </div>

            <div class="mygw-gateway-info flex flex-column gap-8px mb-16px">
              <div class="mygw-info-row flex gap-8px text-14px">
                <span class="mygw-info-label color-text-secondary fw-500 min-w-50px">URL:</span>
                <span class="mygw-info-value mono break-all color-text-primary text-13px">{{ gateway.url }}</span>
              </div>
              <div class="mygw-info-row flex gap-8px text-14px">
                <span class="mygw-info-label color-text-secondary fw-500 min-w-50px">ID:</span>
                <span class="mygw-info-value mono break-all color-text-primary text-13px">{{ gateway.id }}</span>
              </div>
              <div class="mygw-info-row flex gap-8px text-14px">
                <span class="mygw-info-label color-text-secondary fw-500 min-w-50px">Created:</span>
                <span class="mygw-info-value break-all color-text-primary">{{ formatDate(gateway.createdAt) }}</span>
              </div>
            </div>

            <div class="mygw-gateway-actions flex gap-8px mt-16px">
              <UiButton variant="secondary" @click="openEditModal(gateway)">
                <Edit2 :size="16" />
                Edit
              </UiButton>
              <UiButton variant="danger" @click="confirmDelete(gateway)">
                <Trash2 :size="16" />
                Delete
              </UiButton>
            </div>
          </UiCard>
        </div>
      </div>

      <!-- Create/Edit Modal -->
      <UiModal :model-value="showModal" :title="editingGateway ? 'Edit External Gateway' : 'Add External Gateway'" panel-class="max-w-500px w-90pct" @update:model-value="closeModal">
              <p class="mygw-modal-description color-text-secondary mb-24px border-radius-8px py-12px px-16px text-14px line-height-15 bg-primary-a10 border-1-ios-blue-a20">
                Add an external private gateway (e.g., your VPS or company server). 
                For local embedded server, use the "Start Embedded Server" button instead.
              </p>
              
              <div class="mygw-form-group mb-20px">
                <label class="mygw-form-label block fw-500 color-text-secondary mb-8px text-14px">Gateway Name</label>
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-ios-blue" :focus-ring="false" v-model="form.name"
                 
                 
                  placeholder="My Private Gateway" class="focus-outline-none focus-ring-blue" />
              </div>

              <div class="mygw-form-group mb-20px">
                <label class="mygw-form-label block fw-500 color-text-secondary mb-8px text-14px">Gateway URL</label>
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-ios-blue" :focus-ring="false" v-model="form.url"
                 
                 
                  placeholder="https://gateway.example.com" class="focus-outline-none focus-ring-blue" />
              </div>

              <div class="mygw-form-group mb-20px">
                <label class="mygw-form-label block fw-500 color-text-secondary mb-8px text-14px">API Key</label>
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-ios-blue" :focus-ring="false" v-model="form.apiKey"
                 
                 
                  placeholder="Your gateway API key" class="focus-outline-none focus-ring-blue" />
              </div>

              <div v-if="modalError" class="mygw-error-message color-error mt-16px border-radius-10px py-12px px-16px text-14px bg-ios-red-a10 border-1-ios-red-a20">
                {{ modalError }}
              </div>
        <template #footer>
          <UiButton variant="secondary" @click="closeModal" :disabled="saving">
            Cancel
          </UiButton>
          <UiButton variant="primary" @click="saveGateway" :disabled="saving || !isFormValid" class="disabled-fade-50">
            {{ saving ? 'Saving...' : (editingGateway ? 'Update' : 'Create') }}
          </UiButton>
        </template>
      </UiModal>

      <!-- Delete Confirmation Modal -->
      <UiModal :model-value="showDeleteConfirm" title="Delete Gateway" panel-class="max-w-400px w-90pct" @update:model-value="closeDeleteConfirm">
              <p>Are you sure you want to delete <strong>{{ deletingGateway?.name }}</strong>?</p>
              <p class="mygw-warning-text color-warning mt-8px text-14px">This action cannot be undone.</p>
        <template #footer>
          <UiButton variant="secondary" @click="closeDeleteConfirm" :disabled="deleting">
            Cancel
          </UiButton>
          <UiButton variant="danger" @click="deleteGateway" :disabled="deleting">
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </UiButton>
        </template>
      </UiModal>

      <!-- Whitelist Add/Edit Modal -->
      <UiModal :model-value="showWhitelistModal" :title="editingWhitelistEntry ? 'Edit User' : 'Add User to Whitelist'" panel-class="max-w-500px w-90pct" @update:model-value="closeWhitelistModal">
              <div class="mygw-form-group mb-20px">
                <label class="mygw-form-label block fw-500 color-text-secondary mb-8px text-14px">Wallet Address</label>
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-ios-blue" :focus-ring="false" v-model="whitelistForm.address"
                 
                 
                  placeholder="lumen1..."
                  :disabled="!!editingWhitelistEntry" class="focus-outline-none focus-ring-blue" />
              </div>

              <div class="mygw-form-group mb-20px">
                <label class="mygw-form-label block fw-500 color-text-secondary mb-8px text-14px">Display Name (Optional)</label>
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-ios-blue" :focus-ring="false" v-model="whitelistForm.displayName"
                 
                 
                  placeholder="John Doe" class="focus-outline-none focus-ring-blue" />
              </div>

              <div class="mygw-form-group mb-20px">
                <label class="mygw-form-label block fw-500 color-text-secondary mb-8px text-14px">Notes (Optional)</label>
                <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-ios-blue" :focus-ring="false" v-model="whitelistForm.notes"
                 
                  rows="3"
                  placeholder="Additional notes about this user..." class="textarea-min-h-80-font-inherit resize-vertical focus-outline-none focus-ring-blue"></UiInput>
              </div>

              <div v-if="whitelistModalError" class="mygw-error-message color-error mt-16px border-radius-10px py-12px px-16px text-14px bg-ios-red-a10 border-1-ios-red-a20">
                {{ whitelistModalError }}
              </div>
        <template #footer>
          <UiButton variant="secondary" @click="closeWhitelistModal" :disabled="whitelistSaving">
            Cancel
          </UiButton>
          <UiButton variant="primary" @click="saveWhitelistEntry" :disabled="whitelistSaving || !whitelistForm.address.trim()" class="disabled-fade-50">
            {{ whitelistSaving ? 'Saving...' : (editingWhitelistEntry ? 'Update' : 'Add') }}
          </UiButton>
        </template>
      </UiModal>

      <!-- Whitelist Remove Confirmation Modal -->
      <UiModal :model-value="showWhitelistDeleteConfirm" title="Remove User" panel-class="max-w-400px w-90pct" @update:model-value="closeWhitelistDeleteConfirm">
              <p>Remove <strong>{{ getUserDisplayName(removingWhitelistEntry?.wallet_address) }}</strong> from whitelist?</p>
              <p class="mygw-warning-text color-warning mt-8px text-14px">They will no longer be able to access your gateway.</p>
        <template #footer>
          <UiButton variant="secondary" @click="closeWhitelistDeleteConfirm" :disabled="whitelistDeleting">
            Cancel
          </UiButton>
          <UiButton variant="danger" @click="removeFromWhitelist" :disabled="whitelistDeleting">
            {{ whitelistDeleting ? 'Removing...' : 'Remove' }}
          </UiButton>
        </template>
      </UiModal>
    </main>
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';
import UiModal from '../../ui/UiModal.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import { ref, computed, onMounted, watch } from 'vue';
import { Server, List, Plus, Edit2, Trash2, AlertCircle } from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { useToast } from '../../composables/useToast';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { copyToClipboard as copyToClipboardShared } from '../../composables/useClipboard';

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

useTabLoadingSync(loading);
const showModal = ref(false);
const showDeleteConfirm = ref(false);
const editingGateway = ref<Gateway | null>(null);
const deletingGateway = ref<Gateway | null>(null);
const saving = ref(false);
const deleting = ref(false);
const modalError = ref('');

// Embedded server state
const embeddedServerRunning = ref(false);

function serverToggleBtnStyle(running: boolean): Record<string, string> {
  return running
    ? { background: 'linear-gradient(135deg, var(--ios-red) 0%, color-mix(in srgb, var(--ios-red) 85%, black) 100%)', boxShadow: '0 2px 8px rgba(var(--ios-red-rgb), 0.3)' }
    : { background: 'linear-gradient(135deg, var(--ios-green) 0%, color-mix(in srgb, var(--ios-green) 85%, black) 100%)', boxShadow: '0 2px 8px rgba(var(--ios-green-rgb), 0.3)' };
}
const embeddedServerPort = ref<number | null>(null);
const embeddedServerUrl = ref<string | null>(null);
const serverLoading = ref(false);

// Whitelist state
const whitelist = ref<any[]>([]);
const whitelistLoading = ref(false);
const showWhitelistModal = ref(false);
const showWhitelistDeleteConfirm = ref(false);
const editingWhitelistEntry = ref<any | null>(null);
const removingWhitelistEntry = ref<any | null>(null);
const whitelistSaving = ref(false);
const whitelistDeleting = ref(false);
const whitelistModalError = ref('');
const userMetadata = ref<Record<string, any>>({});

const whitelistForm = ref({
  address: '',
  displayName: '',
  notes: ''
});

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
    const result = await useInternalLumen().settingsLoadGateways();
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
      const result = await useInternalLumen().settingsUpdateGateway(
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

      const result = await useInternalLumen().settingsAddGateway(newGateway);

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
    const result = await useInternalLumen().settingsDeleteGateway(deletingGateway.value.id);

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

function gatewayStatusBadgeClass(status: Gateway['status']): string {
  if (status === 'active') return 'badge-success color-success';
  if (status === 'error') return 'badge-error color-error';
  return 'badge-neutral color-text-tertiary';
}

async function checkEmbeddedServerStatus() {
  try {
    const status = await useInternalLumen().gatewayServerStatus();
    embeddedServerRunning.value = status.running;
    embeddedServerPort.value = status.port;
    embeddedServerUrl.value = status.url;
  } catch (e) {
    console.error('Failed to check embedded server status:', e);
  }
}

async function viewApiKey() {
  try {
    const result = await useInternalLumen().gatewayServerGetApiKey();
    
    if (result.ok && result.apiKey) {
      // Copy to clipboard
      await copyToClipboardShared(result.apiKey);

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
      const result = await useInternalLumen().gatewayServerStop();
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
      const result = await useInternalLumen().gatewayServerStart({ port: 3100 });
      if (result.ok) {
        embeddedServerRunning.value = true;
        embeddedServerPort.value = result.port;
        embeddedServerUrl.value = result.url;
        
        // Copy API key to clipboard
        try {
          await copyToClipboardShared(result.apiKey);

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
        
        // Load whitelist after server starts
        await loadWhitelist();
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

// Whitelist management functions
async function loadWhitelist() {
  if (!embeddedServerRunning.value) return;
  
  whitelistLoading.value = true;
  try {
    const apiKey = await useInternalLumen().gatewayServerGetApiKey();
    if (!apiKey.ok || !apiKey.apiKey) {
      console.error('No API key available');
      return;
    }

    // Fetch whitelist from embedded server
    const response = await fetch(`http://127.0.0.1:${embeddedServerPort.value}/api/whitelist`, {
      headers: {
        'X-API-Key': apiKey.apiKey
      }
    });

    if (response.ok) {
      const data = await response.json();
      whitelist.value = data.entries || [];
      
      // Load all user metadata
      await loadAllUserMetadata();
    } else {
      console.error('Failed to load whitelist:', response.statusText);
    }
  } catch (e: any) {
    console.error('Error loading whitelist:', e);
  } finally {
    whitelistLoading.value = false;
  }
}

async function loadAllUserMetadata() {
  try {
    const result = await useInternalLumen().gatewayServerGetAllMetadata();
    if (result.ok && result.metadata) {
      userMetadata.value = result.metadata;
    }
  } catch (e: any) {
    console.error('Error loading user metadata:', e);
  }
}

function getUserDisplayName(address: string): string {
  const metadata = userMetadata.value[address];
  if (metadata && metadata.display_name) {
    return metadata.display_name;
  }
  return formatAddress(address);
}

function formatAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 16) return address;
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

function openWhitelistModal() {
  editingWhitelistEntry.value = null;
  whitelistForm.value = {
    address: '',
    displayName: '',
    notes: ''
  };
  whitelistModalError.value = '';
  showWhitelistModal.value = true;
}

function editWhitelistEntry(entry: any) {
  editingWhitelistEntry.value = entry;
  const metadata = userMetadata.value[entry.wallet_address];
  whitelistForm.value = {
    address: entry.wallet_address,
    displayName: metadata?.display_name || '',
    notes: entry.notes || ''
  };
  whitelistModalError.value = '';
  showWhitelistModal.value = true;
}

function closeWhitelistModal() {
  if (whitelistSaving.value) return;
  showWhitelistModal.value = false;
  editingWhitelistEntry.value = null;
  whitelistModalError.value = '';
}

async function saveWhitelistEntry() {
  if (!whitelistForm.value.address.trim() || whitelistSaving.value) return;

  whitelistModalError.value = '';
  whitelistSaving.value = true;

  try {
    const apiKey = await useInternalLumen().gatewayServerGetApiKey();
    if (!apiKey.ok || !apiKey.apiKey) {
      whitelistModalError.value = 'No API key available';
      return;
    }

    if (editingWhitelistEntry.value) {
      // Update metadata only (whitelist entry already exists)
      if (whitelistForm.value.displayName.trim()) {
        const metadataResult = await useInternalLumen().gatewayServerSaveMetadata(
          whitelistForm.value.address,
          {
            display_name: whitelistForm.value.displayName.trim()
          }
        );

        if (!metadataResult.ok) {
          whitelistModalError.value = metadataResult.error || 'Failed to save display name';
          return;
        }
      }

      toast.success('User updated successfully');
    } else {
      // Add new user to whitelist
      const response = await fetch(`http://127.0.0.1:${embeddedServerPort.value}/api/whitelist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey.apiKey
        },
        body: JSON.stringify({
          address: whitelistForm.value.address.trim(),
          notes: whitelistForm.value.notes.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        whitelistModalError.value = error.error || 'Failed to add user';
        return;
      }

      // Save display name if provided
      if (whitelistForm.value.displayName.trim()) {
        await useInternalLumen().gatewayServerSaveMetadata(
          whitelistForm.value.address.trim(),
          {
            display_name: whitelistForm.value.displayName.trim()
          }
        );
      }

      toast.success('User added to whitelist');
    }

    await loadWhitelist();
    closeWhitelistModal();
  } catch (e: any) {
    whitelistModalError.value = e.message || 'Failed to save user';
  } finally {
    whitelistSaving.value = false;
  }
}

function confirmRemoveFromWhitelist(entry: any) {
  removingWhitelistEntry.value = entry;
  showWhitelistDeleteConfirm.value = true;
}

function closeWhitelistDeleteConfirm() {
  if (whitelistDeleting.value) return;
  showWhitelistDeleteConfirm.value = false;
  removingWhitelistEntry.value = null;
}

async function removeFromWhitelist() {
  if (!removingWhitelistEntry.value || whitelistDeleting.value) return;

  whitelistDeleting.value = true;

  try {
    const apiKey = await useInternalLumen().gatewayServerGetApiKey();
    if (!apiKey.ok || !apiKey.apiKey) {
      toast.error('No API key available');
      return;
    }

    const response = await fetch(
      `http://127.0.0.1:${embeddedServerPort.value}/api/whitelist/${removingWhitelistEntry.value.wallet_address}`,
      {
        method: 'DELETE',
        headers: {
          'X-API-Key': apiKey.apiKey
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      toast.error(error.error || 'Failed to remove user');
      return;
    }

    toast.success('User removed from whitelist');
    await loadWhitelist();
    closeWhitelistDeleteConfirm();
  } catch (e: any) {
    toast.error(e.message || 'Failed to remove user');
  } finally {
    whitelistDeleting.value = false;
  }
}

// Watch for server status changes and load whitelist
watch(embeddedServerRunning, (isRunning) => {
  if (isRunning) {
    loadWhitelist();
  } else {
    whitelist.value = [];
    userMetadata.value = {};
  }
});

onMounted(async () => {
  loadGateways();
  await checkEmbeddedServerStatus();
  
  // Load whitelist if server is already running
  if (embeddedServerRunning.value) {
    loadWhitelist();
  }
});
</script>
