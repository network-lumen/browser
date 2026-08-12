<template>
  <!-- ####### lumen://my-gateways MY GATEWAYS ####### -->
  <div class="internal-page flex">
    <InternalSidebar title="My Gateways" :icon="Server" activeKey="my-gateways">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection title="Manage">
          <UiSidebarNavItem active>
            <List :size="18" />
            <span>Gateway List</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <main class="flex-1 flex flex-column overflow-hidden bg-secondary py-32px px-40px">
      <UiPageHeader
        title="My Private Gateways"
        title-size="32px"
        subtitle="Manage your private IPFS gateways for secure content delivery"
      />

      <div class="pt-2px flex-1 min-h-0 overflow-y-auto">
        <UiCard
          class="transition-all-03 mb-32px"
          :class="{ 'card-state-active-green': embeddedServerRunning }"
          border-class="border-2"
          radius="16px"
          padding-class="p-28px"
          :shadow="false"
        >
          <div class="flex-align-center gap-20px mb-24px">
            <div class="flex-align-justify-center size-48px border-radius-12px color-text-secondary bg-hover transition-all-03" :class="{ 'bg-success-a15 color-success': embeddedServerRunning }">
              <Server :size="24" />
            </div>
            <div class="flex-1">
              <h3 class="text-18px txt-weight-light color-text-primary m-0px mb-4px">Embedded Gateway Server</h3>
              <p v-if="embeddedServerRunning" class="m-0px text-14px color-primary mono">{{ embeddedServerUrl }}</p>
              <p v-else class="color-text-secondary m-0px text-14px">Start your personal gateway server</p>
            </div>
            <div class="flex-align-center gap-8px fw-500 border-radius-20px py-8px px-16px text-14px transition-all-03" :class="embeddedServerRunning ? 'bg-fill-success color-success' : 'bg-fill-tertiary color-text-secondary'">
              <span class="border-radius-circle w-8px h-8px bg-text-tertiary animate-mygw-pulse" :class="{ 'bg-success': embeddedServerRunning }"></span>
              {{ embeddedServerRunning ? 'Running' : 'Stopped' }}
            </div>
          </div>

          <div class="flex gap-12px">
            <UiButton variant="primary" v-if="embeddedServerRunning"
              type="button"
              @click="viewApiKey">
              <Key :size="16" />
              Copy API Key
            </UiButton>
            <UiButton
              variant="none"
              type="button"
              class="flex-align-center gap-8px cursor-pointer color-white fw-500 py-12px px-20px border-radius-10px text-14px transition-all-02"
              :class="embeddedServerRunning ? 'hover-lift-2-enabled hover-shadow-danger' : 'hover-lift-2-enabled hover-shadow-success'"
              :style="serverToggleBtnStyle(embeddedServerRunning)"
              @click="toggleEmbeddedServer"
              :disabled="serverLoading"
            >
              <Pause v-if="embeddedServerRunning" :size="16" fill="currentColor" />
              <Play v-else :size="16" fill="currentColor" />
              {{ embeddedServerRunning ? 'Stop Server' : 'Start Server' }}
            </UiButton>
          </div>
        </UiCard>

        <div v-if="embeddedServerRunning" class="mb-32px border-top-1 pt-32px">
          <div class="flex-align-center flex-justify-space-between mb-24px">
            <h2 class="txt-weight-light color-text-primary m-0px text-20px">Whitelist Management</h2>
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
            <table class="w-full border-collapse-collapse">
              <thead class="bg-hover">
                <tr>
                  <th class="py-16px px-20px text-left text-14px txt-weight-light color-text-secondary border-bottom-1">Display Name</th>
                  <th class="py-16px px-20px text-left text-14px txt-weight-light color-text-secondary border-bottom-1">Wallet Address</th>
                  <th class="py-16px px-20px text-left text-14px txt-weight-light color-text-secondary border-bottom-1">Added</th>
                  <th class="py-16px px-20px text-left text-14px txt-weight-light color-text-secondary border-bottom-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr class="hover-bg-hover" v-for="(entry, idx) in whitelist" :key="entry.wallet_address">
                  <td class="py-16px px-20px text-14px color-text-primary" :class="{ 'border-bottom-1': idx !== whitelist.length - 1 }">
                    <div class="fw-500 color-text-primary">
                      {{ getUserDisplayName(entry.wallet_address) }}
                    </div>
                  </td>
                  <td class="py-16px px-20px text-14px color-text-primary" :class="{ 'border-bottom-1': idx !== whitelist.length - 1 }">
                    <AddressLabel :address="entry.wallet_address" tone-class="color-text-secondary text-13px" />
                  </td>
                  <td class="py-16px px-20px text-14px color-text-primary" :class="{ 'border-bottom-1': idx !== whitelist.length - 1 }">{{ formatDate(entry.added_at) }}</td>
                  <td class="py-16px px-20px text-14px color-text-primary" :class="{ 'border-bottom-1': idx !== whitelist.length - 1 }">
                    <div class="flex gap-8px">
                      <UiButton variant="secondary" @click="editWhitelistEntry(entry)" title="Edit display name" class="size-32px">
                        <Edit2 :size="14" />
                      </UiButton>
                      <UiButton variant="danger" @click="confirmRemoveFromWhitelist(entry)" title="Remove" class="size-32px hover-bg-error-a08">
                        <Trash2 :size="14" />
                      </UiButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </UiCard>
        </div>

        <div class="flex-align-center flex-justify-space-between mb-24px">
          <h2 class="txt-weight-light color-text-primary m-0px text-20px">External Gateways</h2>
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

        <div v-else class="gap-20px grid grid-cols-auto-fill-340">
          <UiCard
            v-for="gateway in gateways"
            :key="gateway.id"
            class="hover-lift-4"
            padding="lg"
            border-class="border-15"
            radius="14px"
            :shadow="false"
            hoverable
            hover-class="transition-all-02 hover-border-primary hover-shadow-md"
          >
            <div class="flex-align-start flex-justify-space-between mb-16px">
              <div class="flex-align-center gap-8px">
                <div class="border-radius-circle w-8px h-8px bg-text-tertiary animate-mygw-pulse" :class="{ 'bg-success': gateway.status === 'active' }"></div>
                <h3 class="text-18px txt-weight-light color-text-primary m-0px">{{ gateway.name }}</h3>
              </div>
              <span class="fw-500 border-radius-12px text-capitalize text-12px py-4px px-12px" :class="gatewayStatusBadgeClass(gateway.status)">
                {{ gateway.status }}
              </span>
            </div>

            <div class="flex flex-column gap-8px mb-16px">
              <div class="flex gap-8px text-14px">
                <span class="color-text-secondary fw-500 min-w-48px">URL:</span>
                <span class="mono break-all color-text-primary text-13px">{{ gateway.url }}</span>
              </div>
              <div class="flex gap-8px text-14px">
                <span class="color-text-secondary fw-500 min-w-48px">ID:</span>
                <span class="mono break-all color-text-primary text-13px">{{ gateway.id }}</span>
              </div>
              <div class="flex gap-8px text-14px">
                <span class="color-text-secondary fw-500 min-w-48px">Created:</span>
                <span class="break-all color-text-primary">{{ formatDate(gateway.createdAt) }}</span>
              </div>
            </div>

            <div class="flex gap-8px mt-16px">
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
      <ExternalGatewayDialog :model-value="showModal" :editing="!!editingGateway" :form="form" :error="modalError" :saving="saving" :valid="isFormValid" @update:model-value="closeModal" @submit="saveGateway" />

      <!-- Delete Confirmation Modal -->
      <ConfirmDialog
        :model-value="showDeleteConfirm"
        title="Delete Gateway"
        consequence="This action cannot be undone."
        confirm-label="Delete"
        busy-label="Deleting..."
        :busy="deleting"
        @update:model-value="closeDeleteConfirm"
        @confirm="deleteGateway"
      >
        <p>Are you sure you want to delete <strong>{{ deletingGateway?.name }}</strong>?</p>
      </ConfirmDialog>

      <!-- Whitelist Add/Edit Modal -->
      <WhitelistEntryDialog :model-value="showWhitelistModal" :editing="!!editingWhitelistEntry" :form="whitelistForm" :error="whitelistModalError" :saving="whitelistSaving" @update:model-value="closeWhitelistModal" @submit="saveWhitelistEntry" />

      <!-- Whitelist Remove Confirmation Modal -->
      <ConfirmDialog
        :model-value="showWhitelistDeleteConfirm"
        title="Remove User"
        consequence="They will no longer be able to access your gateway."
        confirm-label="Remove"
        busy-label="Removing..."
        :busy="whitelistDeleting"
        @update:model-value="closeWhitelistDeleteConfirm"
        @confirm="removeFromWhitelist"
      >
        <p>Remove <strong>{{ getUserDisplayName(removingWhitelistEntry?.wallet_address) }}</strong> from whitelist?</p>
      </ConfirmDialog>
    </main>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../../ui/UiButton.vue';
import UiCard from '../../ui/UiCard.vue';
import ConfirmDialog from '../../dialogs/ConfirmDialog.vue';
import ExternalGatewayDialog from '../../dialogs/ExternalGatewayDialog.vue';
import WhitelistEntryDialog from '../../dialogs/WhitelistEntryDialog.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import { ref, computed, onMounted, watch } from 'vue';
import { Server, List, Plus, Edit2, Trash2, AlertCircle, Key, Play, Pause } from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { useToast } from '../../composables/useToast';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { formatDate, shortenAddress } from '../services/format';
import AddressLabel from '../../entities/AddressLabel.vue';
import { copyToClipboard as copyToClipboardShared } from '../../composables/useClipboard';
import type { ExternalGatewayForm, Gateway, WhitelistEntryForm } from '../../types/myGatewaysPage';

import { errorMessage } from '../services/coerce';
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
    ? { background: 'linear-gradient(135deg, var(--color-error) 0%, color-mix(in srgb, var(--color-error) 85%, black) 100%)', boxShadow: '0 2px 8px rgba(var(--color-error-rgb), 0.3)' }
    : { background: 'linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 85%, black) 100%)', boxShadow: '0 2px 8px rgba(var(--color-success-rgb), 0.3)' };
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

const whitelistForm = ref<WhitelistEntryForm>({
  address: '',
  displayName: '',
  notes: ''
});

const form = ref<ExternalGatewayForm>({
  name: '',
  url: '',
  apiKey: ''
});

const toast = useToast();

const isFormValid = computed(() => {
  // `&&` over trimmed strings yields the last string, not a boolean - harmless
  // while this only fed a `:disabled`, wrong the moment it is a typed prop.
  return !!(form.value.name.trim() && form.value.url.trim() && form.value.apiKey.trim());
});

async function loadGateways() {
  loading.value = true;
  error.value = '';
  try {
    const result = await useInternalLumen()?.settingsLoadGateways();
    gateways.value = result || [];
  } catch (e) {
    error.value = errorMessage(e, 'Failed to load gateways');
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
      const result = await useInternalLumen()?.settingsUpdateGateway(
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

      const result = await useInternalLumen()?.settingsAddGateway(newGateway);

      if (!result.ok) {
        modalError.value = result.error || 'Failed to create gateway';
        return;
      }
      
      toast.success('Gateway created successfully');
    }

    await loadGateways();
    closeModal();
  } catch (e) {
    modalError.value = errorMessage(e, 'Failed to save gateway');
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
    const result = await useInternalLumen()?.settingsDeleteGateway(deletingGateway.value.id);

    if (!result.ok) {
      toast.error(result.error || 'Failed to delete gateway');
      return;
    }

    toast.success('Gateway deleted successfully');
    await loadGateways();
    closeDeleteConfirm();
  } catch (e) {
    toast.error(errorMessage(e, 'Failed to delete gateway'));
  } finally {
    deleting.value = false;
  }
}

function gatewayStatusBadgeClass(status: Gateway['status']): string {
  if (status === 'active') return 'bg-fill-success color-success';
  if (status === 'error') return 'bg-fill-error color-error';
  return 'bg-fill-tertiary color-text-tertiary';
}

async function checkEmbeddedServerStatus() {
  try {
    const status = await useInternalLumen()?.gatewayServerStatus();
    embeddedServerRunning.value = status.running;
    embeddedServerPort.value = status.port;
    embeddedServerUrl.value = status.url;
  } catch (e) {
    console.error('Failed to check embedded server status:', e);
  }
}

async function viewApiKey() {
  try {
    const result = await useInternalLumen()?.gatewayServerGetApiKey();
    
    if (result.ok && result.apiKey) {
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
  } catch (e) {
    toast.error(errorMessage(e, 'Failed to get API key'));
  }
}

async function toggleEmbeddedServer() {
  serverLoading.value = true;
  try {
    if (embeddedServerRunning.value) {
      const result = await useInternalLumen()?.gatewayServerStop();
      if (result.ok) {
        embeddedServerRunning.value = false;
        embeddedServerPort.value = null;
        embeddedServerUrl.value = null;
        toast.success('Embedded Gateway Server stopped');
      } else {
        toast.error(result.error || 'Failed to stop embedded server');
      }
    } else {
      const result = await useInternalLumen()?.gatewayServerStart({ port: 3100 });
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
        } catch {
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
  } catch (e) {
    toast.error(errorMessage(e, 'Failed to toggle embedded server'));
  } finally {
    serverLoading.value = false;
  }
}

// Whitelist management functions
async function loadWhitelist() {
  if (!embeddedServerRunning.value) return;
  
  whitelistLoading.value = true;
  try {
    const apiKey = await useInternalLumen()?.gatewayServerGetApiKey();
    if (!apiKey.ok || !apiKey.apiKey) {
      console.error('No API key available');
      return;
    }

    const response = await fetch(`http://127.0.0.1:${embeddedServerPort.value}/api/whitelist`, {
      headers: {
        'X-API-Key': apiKey.apiKey
      }
    });

    if (response.ok) {
      const data = await response.json();
      whitelist.value = data.entries || [];
      
      await loadAllUserMetadata();
    } else {
      console.error('Failed to load whitelist:', response.statusText);
    }
  } catch (e) {
    console.error('Error loading whitelist:', e);
  } finally {
    whitelistLoading.value = false;
  }
}

async function loadAllUserMetadata() {
  try {
    const result = await useInternalLumen()?.gatewayServerGetAllMetadata();
    if (result.ok && result.metadata) {
      userMetadata.value = result.metadata;
    }
  } catch (e) {
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
  return shortenAddress(address);
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
    const apiKey = await useInternalLumen()?.gatewayServerGetApiKey();
    if (!apiKey.ok || !apiKey.apiKey) {
      whitelistModalError.value = 'No API key available';
      return;
    }

    if (editingWhitelistEntry.value) {
      // Update metadata only (whitelist entry already exists)
      if (whitelistForm.value.displayName.trim()) {
        const metadataResult = await useInternalLumen()?.gatewayServerSaveMetadata(
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
        await useInternalLumen()?.gatewayServerSaveMetadata(
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
  } catch (e) {
    whitelistModalError.value = errorMessage(e, 'Failed to save user');
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
    const apiKey = await useInternalLumen()?.gatewayServerGetApiKey();
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
  } catch (e) {
    toast.error(errorMessage(e, 'Failed to remove user'));
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
