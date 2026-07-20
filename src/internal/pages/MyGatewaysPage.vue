<template>
  <div class="my-gateways-page internal-page flex bg-primary">
    <InternalSidebar title="My Gateways" :icon="Server" activeKey="my-gateways">
      <nav class="lsb-nav flex flex-column gap-75">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Manage</span>
          <button type="button" class="lsb-item active bg-gradient-primary color-white shadow-primary border-none cursor-pointer flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015">
            <List :size="18" />
            <span>Gateway List</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <main class="mygw-main flex-1 flex flex-column overflow-hidden bg-secondary padding-200-250">
      <header class="mygw-content-header margin-bottom-200">
        <div class="mygw-header-text">
          <h1 class="txt-weight-medium color-text-primary mygw-header-text-h1 fs-32px margin-0 margin-bottom-50">My Private Gateways</h1>
          <p class="color-text-secondary margin-0 mygw-header-text-p fs-15px">Manage your private IPFS gateways for secure content delivery</p>
        </div>
      </header>

      <div class="mygw-content-area flex-1 overflow-y-auto">
        <!-- Embedded Server Card -->
        <div class="mygw-server-card bg-card border-2 border-radius-16px transition-all-03 padding-175" :class="{ active: embeddedServerRunning }">
          <div class="mygw-server-card-header flex-align-center gap-125 margin-bottom-150">
            <div class="mygw-server-icon flex-align-justify-center size-48px border-radius-12px color-text-secondary bg-hover transition-all-03">
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
              <h3 class="fs-11rem txt-weight-light color-text-primary mygw-server-info-h3 margin-0 margin-bottom-25">Embedded Gateway Server</h3>
              <p v-if="embeddedServerRunning" class="mygw-server-url margin-0 fs-14px color-ios-blue mono">{{ embeddedServerUrl }}</p>
              <p v-else class="mygw-server-status-text color-text-secondary margin-0 fs-14px">Start your personal gateway server</p>
            </div>
            <div class="mygw-server-status-badge flex-align-center gap-50 fw-500 color-text-secondary border-radius-20px padding-50-100 bg-fill-tertiary fs-14px transition-all-03" :class="{ running: embeddedServerRunning }">
              <span class="mygw-status-dot border-radius-circle w-8px h-8px bg-text-tertiary"></span>
              {{ embeddedServerRunning ? 'Running' : 'Stopped' }}
            </div>
          </div>

          <div class="mygw-server-card-actions flex gap-75">
            <button 
              v-if="embeddedServerRunning"
              type="button" 
              class="mygw-btn-outline flex-align-center gap-50 cursor-pointer fw-500 color-text-primary flex-1 bg-transparent border-15 hover-bg-hover hover-border-ios-blue hover-lift-1 hover-color-ios-blue"
              @click="viewApiKey"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
              Copy API Key
            </button>
            <button 
              type="button" 
              class="flex-align-center gap-50 border-none cursor-pointer color-white fw-500" :class="embeddedServerRunning ? 'mygw-btn-stop' : 'mygw-btn-start hover-lift-2-enabled hover-shadow-ios-green-lg'"
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

        <!-- Whitelist Management Section (only show when embedded server is running) -->
        <div v-if="embeddedServerRunning" class="mygw-whitelist-section border-top-1">
          <div class="mygw-section-header flex-align-center flex-justify-space-between margin-bottom-150">
            <h2 class="txt-weight-light color-text-primary margin-0 mygw-section-header-h2 fs-125rem">Whitelist Management</h2>
            <button type="button" class="mygw-btn-add flex-align-center gap-50 border-none cursor-pointer color-white fw-500 bg-gradient-primary hover-lift-2" @click="openWhitelistModal">
              <Plus :size="18" />
              Add User
            </button>
          </div>

          <div v-if="whitelistLoading" class="mygw-empty-state small flex flex-column flex-align-justify-center text-center padding-400-200">
            <div class="mygw-spinner border-radius-full size-40px border-3"></div>
            <p class="mygw-empty-state-p fs-14px color-text-secondary margin-0 margin-bottom-150">Loading whitelist...</p>
          </div>

          <div v-else-if="whitelist.length === 0" class="mygw-empty-state small flex flex-column flex-align-justify-center text-center padding-400-200">
            <p class="mygw-empty-state-p fs-14px color-text-secondary margin-0 margin-bottom-150">No users in whitelist yet. Add wallet addresses to grant access.</p>
          </div>

          <div v-else class="mygw-whitelist-table overflow-hidden bg-card border-radius-14px border-15">
            <table class="mygw-whitelist-table-table w-full">
              <thead>
                <tr>
                  <th class="mygw-whitelist-table-th padding-100-125 text-left fs-14px txt-weight-light color-text-secondary border-bottom-1">Display Name</th>
                  <th class="mygw-whitelist-table-th padding-100-125 text-left fs-14px txt-weight-light color-text-secondary border-bottom-1">Wallet Address</th>
                  <th class="mygw-whitelist-table-th padding-100-125 text-left fs-14px txt-weight-light color-text-secondary border-bottom-1">Added</th>
                  <th class="mygw-whitelist-table-th padding-100-125 text-left fs-14px txt-weight-light color-text-secondary border-bottom-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in whitelist" :key="entry.wallet_address">
                  <td class="mygw-whitelist-table-td padding-100-125 fs-14px color-text-primary border-bottom-1">
                    <div class="mygw-user-display-name fw-500 color-text-primary">
                      {{ getUserDisplayName(entry.wallet_address) }}
                    </div>
                  </td>
                  <td class="mygw-whitelist-table-td padding-100-125 fs-14px color-text-primary border-bottom-1">
                    <span class="mygw-mono-text color-text-secondary fs-13px mono">{{ formatAddress(entry.wallet_address) }}</span>
                  </td>
                  <td class="mygw-whitelist-table-td padding-100-125 fs-14px color-text-primary border-bottom-1">{{ formatDate(entry.added_at) }}</td>
                  <td class="mygw-whitelist-table-td padding-100-125 fs-14px color-text-primary border-bottom-1">
                    <div class="mygw-table-actions flex gap-50">
                      <button class="mygw-btn-icon flex-align-justify-center bg-transparent cursor-pointer color-text-secondary size-32px border-1 border-radius-8px transition-all-02 hover-bg-hover hover-color-text-primary hover-border-ios-blue" @click="editWhitelistEntry(entry)" title="Edit display name">
                        <Edit2 :size="14" />
                      </button>
                      <button class="mygw-btn-icon danger flex-align-justify-center bg-transparent cursor-pointer color-text-secondary size-32px border-1 border-radius-8px transition-all-02 hover-bg-hover hover-color-text-primary hover-border-ios-blue" @click="confirmRemoveFromWhitelist(entry)" title="Remove">
                        <Trash2 :size="14" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- External Gateways Section -->
        <div class="mygw-section-header flex-align-center flex-justify-space-between margin-bottom-150">
          <h2 class="txt-weight-light color-text-primary margin-0 mygw-section-header-h2 fs-125rem">External Gateways</h2>
          <button type="button" class="mygw-btn-add flex-align-center gap-50 border-none cursor-pointer color-white fw-500 bg-gradient-primary hover-lift-2" @click="openCreateModal">
            <Plus :size="18" />
            Add Gateway
          </button>
        </div>

        <div v-if="loading" class="mygw-empty-state flex flex-column flex-align-justify-center text-center padding-400-200">
          <div class="mygw-spinner border-radius-full size-40px border-3"></div>
          <p class="mygw-empty-state-p fs-14px color-text-secondary margin-0 margin-bottom-150">Loading gateways...</p>
        </div>

        <div v-else-if="error" class="mygw-empty-state flex flex-column flex-align-justify-center text-center padding-400-200">
          <AlertCircle :size="48" class="color-error margin-bottom-100" />
          <h2 class="txt-weight-light color-text-primary mygw-empty-state-h2 fs-125rem margin-0 margin-bottom-50">Error Loading Gateways</h2>
          <p class="mygw-empty-state-p fs-14px color-text-secondary margin-0 margin-bottom-150">{{ error }}</p>
          <button class="mygw-btn-secondary flex-align-center gap-50 cursor-pointer fw-500 color-text-secondary flex-1 bg-hover border-1 padding-62-100 border-radius-10px fs-14px transition-all-02 hover-color-text-primary" @click="loadGateways">Try Again</button>
        </div>

        <div v-else-if="gateways.length === 0" class="mygw-empty-state flex flex-column flex-align-justify-center text-center padding-400-200">
          <Server :size="48" class="color-text-tertiary margin-bottom-100" />
          <h2 class="txt-weight-light color-text-primary mygw-empty-state-h2 fs-125rem margin-0 margin-bottom-50">No Gateways Yet</h2>
          <p class="mygw-empty-state-p fs-14px color-text-secondary margin-0 margin-bottom-150">Create your first private gateway to get started</p>
          <button class="mygw-btn-primary disabled-fade-50 flex-align-center gap-50 border-none cursor-pointer color-white fw-500 bg-gradient-primary padding-62-100 border-radius-10px fs-14px transition-all-02 hover-lift-1" @click="openCreateModal">
            <Plus :size="18" />
            Create Gateway
          </button>
        </div>

        <div v-else class="mygw-gateways-grid gap-125 grid">
          <div v-for="gateway in gateways" :key="gateway.id" class="mygw-gateway-card padding-150 bg-card border-radius-14px border-15 transition-all-02 hover-border-ios-blue">
            <div class="mygw-gateway-header flex-align-start flex-justify-space-between margin-bottom-100">
              <div class="mygw-gateway-title flex-align-center gap-50">
                <div class="mygw-status-dot border-radius-circle w-8px h-8px bg-text-tertiary" :class="{ active: gateway.status === 'active' }"></div>
                <h3 class="fs-11rem txt-weight-light color-text-primary margin-0">{{ gateway.name }}</h3>
              </div>
              <span class="mygw-gateway-badge fw-500 border-radius-12px text-capitalize fs-075rem padding-25-75" :class="`badge-${gateway.status}`">
                {{ gateway.status }}
              </span>
            </div>

            <div class="mygw-gateway-info flex flex-column gap-50 margin-bottom-100">
              <div class="mygw-info-row flex gap-50 fs-14px">
                <span class="mygw-info-label color-text-secondary fw-500 min-w-60px">URL:</span>
                <span class="mygw-info-value mono break-all color-text-primary">{{ gateway.url }}</span>
              </div>
              <div class="mygw-info-row flex gap-50 fs-14px">
                <span class="mygw-info-label color-text-secondary fw-500 min-w-60px">ID:</span>
                <span class="mygw-info-value mono break-all color-text-primary">{{ gateway.id }}</span>
              </div>
              <div class="mygw-info-row flex gap-50 fs-14px">
                <span class="mygw-info-label color-text-secondary fw-500 min-w-60px">Created:</span>
                <span class="mygw-info-value break-all color-text-primary">{{ formatDate(gateway.createdAt) }}</span>
              </div>
            </div>

            <div class="mygw-gateway-actions flex gap-50 margin-top-100">
              <button class="mygw-btn-secondary flex-align-center gap-50 cursor-pointer fw-500 color-text-secondary flex-1 bg-hover border-1 padding-62-100 border-radius-10px fs-14px transition-all-02 hover-color-text-primary" @click="openEditModal(gateway)">
                <Edit2 :size="16" />
                Edit
              </button>
              <button class="mygw-btn-danger flex-align-center gap-50 cursor-pointer fw-500 color-error flex-1 padding-62-100 border-radius-10px fs-14px transition-all-02 bg-ios-red-a10 border-1-ios-red-a2" @click="confirmDelete(gateway)">
                <Trash2 :size="16" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create/Edit Modal -->
      <Transition name="mygw-modal">
        <div v-if="showModal" class="overlay-scrim z-1000 mygw-modal-overlay backdrop-blur-4" @click="closeModal">
          <div class="mygw-modal-content bg-card overflow-hidden flex flex-column border-radius-16px max-w-500px max-h-90vh w-90pct" @click.stop>
            <div class="mygw-modal-header flex-align-center flex-justify-space-between padding-150 border-bottom-1">
              <h2 class="txt-weight-light color-text-primary margin-0 mygw-modal-header-h2 fs-125rem">{{ editingGateway ? 'Edit External Gateway' : 'Add External Gateway' }}</h2>
              <button class="mygw-icon-btn hover-fill-primary flex-align-justify-center bg-transparent border-none cursor-pointer color-text-secondary size-32px border-radius-8px fs-15rem transition-all-02" @click="closeModal">×</button>
            </div>

            <div class="mygw-modal-body flex-1 overflow-y-auto padding-150">
              <p class="mygw-modal-description color-text-secondary margin-bottom-150 border-radius-8px padding-75-100 fs-14px line-height-15 bg-ios-blue-a1 border-1-ios-blue-a2">
                Add an external private gateway (e.g., your VPS or company server). 
                For local embedded server, use the "Start Embedded Server" button instead.
              </p>
              
              <div class="mygw-form-group margin-bottom-125">
                <label class="mygw-form-label block fw-500 color-text-secondary margin-bottom-50 fs-14px">Gateway Name</label>
                <input
                  v-model="form.name"
                  type="text"
                  class="mygw-form-input w-full color-text-primary border-radius-10px padding-75-100 bg-secondary border-1 fs-14px transition-all-02 focus-outline-none focus-border-ios-blue focus-ring-blue"
                  placeholder="My Private Gateway"
                />
              </div>

              <div class="mygw-form-group margin-bottom-125">
                <label class="mygw-form-label block fw-500 color-text-secondary margin-bottom-50 fs-14px">Gateway URL</label>
                <input
                  v-model="form.url"
                  type="text"
                  class="mygw-form-input w-full color-text-primary border-radius-10px padding-75-100 bg-secondary border-1 fs-14px transition-all-02 focus-outline-none focus-border-ios-blue focus-ring-blue"
                  placeholder="https://gateway.example.com"
                />
              </div>

              <div class="mygw-form-group margin-bottom-125">
                <label class="mygw-form-label block fw-500 color-text-secondary margin-bottom-50 fs-14px">API Key</label>
                <input
                  v-model="form.apiKey"
                  type="password"
                  class="mygw-form-input w-full color-text-primary border-radius-10px padding-75-100 bg-secondary border-1 fs-14px transition-all-02 focus-outline-none focus-border-ios-blue focus-ring-blue"
                  placeholder="Your gateway API key"
                />
              </div>

              <div v-if="modalError" class="mygw-error-message color-error margin-top-100 border-radius-10px padding-75-100 fs-14px bg-ios-red-a10 border-1-ios-red-a2">
                {{ modalError }}
              </div>
            </div>

            <div class="mygw-modal-actions flex gap-75 padding-150 border-top-1">
              <button class="mygw-btn-secondary flex-align-center gap-50 cursor-pointer fw-500 color-text-secondary flex-1 bg-hover border-1 padding-62-100 border-radius-10px fs-14px transition-all-02 hover-color-text-primary" @click="closeModal" :disabled="saving">
                Cancel
              </button>
              <button class="mygw-btn-primary disabled-fade-50 flex-align-center gap-50 border-none cursor-pointer color-white fw-500 bg-gradient-primary padding-62-100 border-radius-10px fs-14px transition-all-02 hover-lift-1" @click="saveGateway" :disabled="saving || !isFormValid">
                {{ saving ? 'Saving...' : (editingGateway ? 'Update' : 'Create') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Delete Confirmation Modal -->
      <Transition name="mygw-modal">
        <div v-if="showDeleteConfirm" class="overlay-scrim z-1000 mygw-modal-overlay backdrop-blur-4" @click="closeDeleteConfirm">
          <div class="mygw-modal-content small bg-card overflow-hidden flex flex-column border-radius-16px max-w-500px max-h-90vh w-90pct" @click.stop>
            <div class="mygw-modal-header flex-align-center flex-justify-space-between padding-150 border-bottom-1">
              <h2 class="txt-weight-light color-text-primary margin-0 mygw-modal-header-h2 fs-125rem">Delete Gateway</h2>
              <button class="mygw-icon-btn hover-fill-primary flex-align-justify-center bg-transparent border-none cursor-pointer color-text-secondary size-32px border-radius-8px fs-15rem transition-all-02" @click="closeDeleteConfirm">×</button>
            </div>

            <div class="mygw-modal-body flex-1 overflow-y-auto padding-150">
              <p>Are you sure you want to delete <strong>{{ deletingGateway?.name }}</strong>?</p>
              <p class="mygw-warning-text color-warning margin-top-50 fs-14px">This action cannot be undone.</p>
            </div>

            <div class="mygw-modal-actions flex gap-75 padding-150 border-top-1">
              <button class="mygw-btn-secondary flex-align-center gap-50 cursor-pointer fw-500 color-text-secondary flex-1 bg-hover border-1 padding-62-100 border-radius-10px fs-14px transition-all-02 hover-color-text-primary" @click="closeDeleteConfirm" :disabled="deleting">
                Cancel
              </button>
              <button class="mygw-btn-danger flex-align-center gap-50 cursor-pointer fw-500 color-error flex-1 padding-62-100 border-radius-10px fs-14px transition-all-02 bg-ios-red-a10 border-1-ios-red-a2" @click="deleteGateway" :disabled="deleting">
                {{ deleting ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Whitelist Add/Edit Modal -->
      <Transition name="mygw-modal">
        <div v-if="showWhitelistModal" class="overlay-scrim z-1000 mygw-modal-overlay backdrop-blur-4" @click="closeWhitelistModal">
          <div class="mygw-modal-content bg-card overflow-hidden flex flex-column border-radius-16px max-w-500px max-h-90vh w-90pct" @click.stop>
            <div class="mygw-modal-header flex-align-center flex-justify-space-between padding-150 border-bottom-1">
              <h2 class="txt-weight-light color-text-primary margin-0 mygw-modal-header-h2 fs-125rem">{{ editingWhitelistEntry ? 'Edit User' : 'Add User to Whitelist' }}</h2>
              <button class="mygw-icon-btn hover-fill-primary flex-align-justify-center bg-transparent border-none cursor-pointer color-text-secondary size-32px border-radius-8px fs-15rem transition-all-02" @click="closeWhitelistModal">×</button>
            </div>

            <div class="mygw-modal-body flex-1 overflow-y-auto padding-150">
              <div class="mygw-form-group margin-bottom-125">
                <label class="mygw-form-label block fw-500 color-text-secondary margin-bottom-50 fs-14px">Wallet Address</label>
                <input
                  v-model="whitelistForm.address"
                  type="text"
                  class="mygw-form-input w-full color-text-primary border-radius-10px padding-75-100 bg-secondary border-1 fs-14px transition-all-02 focus-outline-none focus-border-ios-blue focus-ring-blue"
                  placeholder="lumen1..."
                  :disabled="!!editingWhitelistEntry"
                />
              </div>

              <div class="mygw-form-group margin-bottom-125">
                <label class="mygw-form-label block fw-500 color-text-secondary margin-bottom-50 fs-14px">Display Name (Optional)</label>
                <input
                  v-model="whitelistForm.displayName"
                  type="text"
                  class="mygw-form-input w-full color-text-primary border-radius-10px padding-75-100 bg-secondary border-1 fs-14px transition-all-02 focus-outline-none focus-border-ios-blue focus-ring-blue"
                  placeholder="John Doe"
                />
              </div>

              <div class="mygw-form-group margin-bottom-125">
                <label class="mygw-form-label block fw-500 color-text-secondary margin-bottom-50 fs-14px">Notes (Optional)</label>
                <textarea
                  v-model="whitelistForm.notes"
                  class="mygw-form-input w-full color-text-primary border-radius-10px padding-75-100 bg-secondary border-1 fs-14px transition-all-02 focus-outline-none focus-border-ios-blue focus-ring-blue"
                  rows="3"
                  placeholder="Additional notes about this user..."
                ></textarea>
              </div>

              <div v-if="whitelistModalError" class="mygw-error-message color-error margin-top-100 border-radius-10px padding-75-100 fs-14px bg-ios-red-a10 border-1-ios-red-a2">
                {{ whitelistModalError }}
              </div>
            </div>

            <div class="mygw-modal-actions flex gap-75 padding-150 border-top-1">
              <button class="mygw-btn-secondary flex-align-center gap-50 cursor-pointer fw-500 color-text-secondary flex-1 bg-hover border-1 padding-62-100 border-radius-10px fs-14px transition-all-02 hover-color-text-primary" @click="closeWhitelistModal" :disabled="whitelistSaving">
                Cancel
              </button>
              <button class="mygw-btn-primary disabled-fade-50 flex-align-center gap-50 border-none cursor-pointer color-white fw-500 bg-gradient-primary padding-62-100 border-radius-10px fs-14px transition-all-02 hover-lift-1" @click="saveWhitelistEntry" :disabled="whitelistSaving || !whitelistForm.address.trim()">
                {{ whitelistSaving ? 'Saving...' : (editingWhitelistEntry ? 'Update' : 'Add') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Whitelist Remove Confirmation Modal -->
      <Transition name="mygw-modal">
        <div v-if="showWhitelistDeleteConfirm" class="overlay-scrim z-1000 mygw-modal-overlay backdrop-blur-4" @click="closeWhitelistDeleteConfirm">
          <div class="mygw-modal-content small bg-card overflow-hidden flex flex-column border-radius-16px max-w-500px max-h-90vh w-90pct" @click.stop>
            <div class="mygw-modal-header flex-align-center flex-justify-space-between padding-150 border-bottom-1">
              <h2 class="txt-weight-light color-text-primary margin-0 mygw-modal-header-h2 fs-125rem">Remove User</h2>
              <button class="mygw-icon-btn hover-fill-primary flex-align-justify-center bg-transparent border-none cursor-pointer color-text-secondary size-32px border-radius-8px fs-15rem transition-all-02" @click="closeWhitelistDeleteConfirm">×</button>
            </div>

            <div class="mygw-modal-body flex-1 overflow-y-auto padding-150">
              <p>Remove <strong>{{ getUserDisplayName(removingWhitelistEntry?.wallet_address) }}</strong> from whitelist?</p>
              <p class="mygw-warning-text color-warning margin-top-50 fs-14px">They will no longer be able to access your gateway.</p>
            </div>

            <div class="mygw-modal-actions flex gap-75 padding-150 border-top-1">
              <button class="mygw-btn-secondary flex-align-center gap-50 cursor-pointer fw-500 color-text-secondary flex-1 bg-hover border-1 padding-62-100 border-radius-10px fs-14px transition-all-02 hover-color-text-primary" @click="closeWhitelistDeleteConfirm" :disabled="whitelistDeleting">
                Cancel
              </button>
              <button class="mygw-btn-danger flex-align-center gap-50 cursor-pointer fw-500 color-error flex-1 padding-62-100 border-radius-10px fs-14px transition-all-02 bg-ios-red-a10 border-1-ios-red-a2" @click="removeFromWhitelist" :disabled="whitelistDeleting">
                {{ whitelistDeleting ? 'Removing...' : 'Remove' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Server, List, Plus, Edit2, Trash2, AlertCircle } from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { useToast } from '../../composables/useToast';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';

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
