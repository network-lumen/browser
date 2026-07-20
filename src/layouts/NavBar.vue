<template>
  <header class="navbar flex-align-center gap-75 padding-50-75 bg-primary border-bottom-default min-h-52px">
    <!-- Navigation Controls -->
    <div class="navbar-nav-controls flex-align-center gap-25">
      <UiButton variant="icon" icon-radius-class="border-radius-sm" icon-padding-class="" :disabled="!canGoBack"
        title="Back"
        @click="previous" class="navbar-nav-btn flex-inline-align-justify-center size-32px">
        <ArrowLeft :size="16" />
      </UiButton>
      <UiButton variant="icon" icon-radius-class="border-radius-sm" icon-padding-class="" :disabled="!canGoForward"
        title="Forward"
        @click="next" class="navbar-nav-btn flex-inline-align-justify-center size-32px">
        <ArrowRight :size="16" />
      </UiButton>
      <UiButton variant="icon" icon-radius-class="border-radius-sm" icon-padding-class="" v-if="!isExtensionTab"

        :aria-busy="loading ? 'true' : 'false'"
        :disabled="loading"
        :title="loading ? 'Loading…' : 'Refresh'"
        @click="refresh" class="navbar-nav-btn flex-inline-align-justify-center size-32px">
        <UiSpinner v-if="loading" size="sm" />
        <RefreshCw v-else :size="16" />
      </UiButton>
    </div>

    <!-- URL Bar -->
    <div class="navbar-url-bar-container appregion-no-drag flex-align-center flex-1 relative min-w-0">
      <Search :size="15" stroke-width="2" class="navbar-url-bar-icon color-text-tertiary absolute cursor-events-none" />
      <UiInput bg-class="bg-secondary" radius-class="border-radius-sm" font-size-class="fs-13px" padding-class="padding-50-275-50-225" :focus-ring="false" :value="urlField"
        @input="onInput"
       
       
        placeholder="Search or enter a URL"
        @keydown.enter="onEnter" class="navbar-url-bar-input border-default focus-outline-none focus-bg-primary focus-ring focus-shadow" />
      <UiButton
        variant="icon"
        icon-radius-class="border-radius-8px"
        icon-padding-class=""
        class="navbar-url-bar-action flex-inline-align-justify-center size-28px color-text-tertiary absolute top-half"
        :class="{ 'is-active': favActive }"
        :title="favActive ? 'Remove from shortcuts' : 'Add to shortcuts'"
        :aria-label="favActive ? 'Remove from shortcuts' : 'Add to shortcuts'"
        :aria-pressed="favActive ? 'true' : 'false'"
        @mousedown.prevent
        @click="onToggleFavourite"
      >
        <Star :size="16" :fill="favActive ? 'currentColor' : 'none'" />
      </UiButton>
    </div>

    <!-- Quick Actions -->
    <div class="navbar-quick-actions flex-align-center gap-25">
      <UiButton variant="icon" icon-radius-class="border-radius-sm" icon-padding-class="" title="Home"
        @click="$emit('goto', 'lumen://home')" class="navbar-nav-btn flex-inline-align-justify-center size-32px">
        <House :size="16" />
      </UiButton>
      <UiButton variant="icon" icon-radius-class="border-radius-sm" icon-padding-class="" title="Drive"
        @click="$emit('goto', 'lumen://drive')" class="navbar-nav-btn flex-inline-align-justify-center size-32px">
        <Cloud :size="16" />
      </UiButton>
    </div>

    <div class="navbar-extensions-section appregion-no-drag relative margin-left-n50">
      <UiButton
        variant="icon"
        icon-radius-class="border-radius-sm"
        icon-padding-class=""
        class="navbar-nav-btn extensions-trigger flex-inline-align-justify-center size-32px"
        :class="{ 'is-active': showExtensionsMenu }"
        title="Extensions"
        @click.stop="toggleExtensionsMenu"
      >
        <Puzzle :size="16" />
      </UiButton>

      <UiCard padding="none" :shadow="false" v-if="showExtensionsMenu" role="menu" class="navbar-extensions-menu absolute padding-50 shadow-xl z-100 right-0 w-340px max-w-min-92vw-340px">
        <div class="navbar-extensions-menu-title fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em padding-0 padding-right-50 padding-bottom-50 padding-left-50">Extensions</div>

        <div v-if="extensions.length" class="navbar-extensions-list flex flex-column gap-35 overflow-y-auto padding-right-25">
          <div
            v-for="ext in extensions"
            :key="ext.id"
            class="navbar-extension-row flex-align-start gap-62 padding-62 border-radius-md bg-secondary border-05-light"
          >
            <div class="navbar-extension-main flex-1 min-w-0">
              <div class="navbar-extension-name fs-13px txt-weight-light color-text-primary nowrap overflow-hidden txt-overflow-ellipsis">{{ ext.name }}</div>
              <div class="navbar-extension-meta flex-align-center flex-wrap-wrap gap-35 margin-top-25">
                <span class="navbar-extension-state fs-11px color-text-tertiary" :class="{ error: !!ext.lastError, disabled: !ext.enabled }">
                  {{ extensionStateLabel(ext) }}
                </span>
                <span v-if="ext.version" class="navbar-extension-version fs-11px color-text-tertiary">v{{ ext.version }}</span>
              </div>
              <div v-if="ext.lastError" class="navbar-extension-error fs-11px margin-top-25 break-word line-height-135">{{ ext.lastError }}</div>
            </div>

            <div class="navbar-extension-actions flex-align-center gap-35">
              <UiButton variant="icon" icon-radius-class="border-radius-sm" icon-padding-class="" type="button"
                title="Open extension"
                :disabled="extensionsBusy || !ext.enabled || !ext.launchUrl"
                @click.stop="openExtension(ext)" class="flex-inline-align-justify-center disabled-fade-40 size-28px">
                <ExternalLink :size="14" />
              </UiButton>

              <label class="navbar-extension-toggle flex-inline-align-center cursor-pointer relative" :title="ext.enabled ? 'Disable extension' : 'Enable extension'">
                <input class="navbar-extension-toggle-input absolute opacity-0 w-0"
                  type="checkbox"
                  :checked="ext.enabled"
                  :disabled="extensionsBusy"
                  @change="toggleExtensionEnabled(ext)"
                />
                <span class="navbar-extension-toggle-slider border-radius-full relative bg-border w-34px h-20px"></span>
              </label>

              <UiButton variant="icon" icon-radius-class="border-radius-sm" icon-padding-class="" type="button"
                title="Reload extension"
                :disabled="extensionsBusy || !ext.enabled"
                @click.stop="reloadExtension(ext.id)" class="flex-inline-align-justify-center disabled-fade-40 size-28px">
                <RefreshCw :size="14" />
              </UiButton>

              <UiButton variant="danger" type="button"
               
                title="Remove extension"
                :disabled="extensionsBusy"
                @click.stop="removeExtension(ext.id)" class="disabled-fade-40 size-28px">
                <Trash2 :size="14" />
              </UiButton>
            </div>
          </div>
        </div>

        <div v-else class="navbar-extensions-menu-hint text-center fs-12px color-text-tertiary padding-87-50">
          No extensions installed yet.
        </div>

        <div class="navbar-extensions-menu-actions flex flex-column gap-50 margin-top-62 padding-top-50 border-top-05-border-light">
          <UiButton
            variant="none"
            class="navbar-profile-menu-action disabled-fade-40 w-full border-radius-sm cursor-pointer fs-13px fw-500 color-text-primary flex-justify-start padding-50-62 border-none bg-transparent transition-all-015"
            :disabled="extensionsBusy"
            @click.stop="loadUnpackedExtension"
          >
            Load unpacked extension
          </UiButton>

          <UiButton variant="primary" type="button"
           
            :disabled="extensionsBusy"
            @click.stop="openChromeWebStore" class="navbar-extensions-store-link disabled-fade-45">
            <span>Import from Chrome Web Store</span>
            <ExternalLink :size="13" />
          </UiButton>

          <div v-if="extensionsMessage" class="navbar-extensions-menu-message fs-12px color-text-tertiary padding-0-12">
            {{ extensionsMessage }}
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Profile -->
    <div class="navbar-profile-section appregion-no-drag relative">
      <UiButton variant="secondary" type="button" :title="activeProfileDisplay" @click.stop="toggleProfileMenu" class="navbar-profile-trigger">
        <ProfileAvatar :profile="activeProfile" :size="28" :title="activeProfileDisplay" />
        <span class="navbar-profile-trigger-name fs-13px fw-500 color-text-primary overflow-hidden txt-overflow-ellipsis nowrap max-w-100px">{{ activeProfileDisplay }}</span>
        <ChevronDown :size="14" class="navbar-profile-chevron color-text-tertiary margin-left-n12" />
      </UiButton>

      <UiCard padding="none" :shadow="false" v-if="showProfileMenu"
       
        role="menu" class="navbar-profile-menu absolute padding-50 shadow-xl z-100 right-0 min-w-260px max-w-300px">
        <ActiveProfileCard
          v-if="activeProfile"
          :profile="activeProfile"
          dense
          :label="isGuestOnly ? 'Guest mode' : 'Active profile'"
        />

        <div v-if="hasProfiles && !isGuestOnly" class="navbar-profile-menu-section">
          <div class="navbar-profile-menu-title fs-11px txt-weight-light color-text-tertiary text-uppercase margin-top-50 letter-spacing-005em padding-0-50 margin-bottom-25">Profiles</div>
          <ul class="navbar-profile-list flex flex-column padding-0 margin-0 gap-2px list-style-none overflow-y-auto">
            <li
              v-for="p in profiles"
              :key="p.id"
              class="navbar-profile-row flex-align-center border-radius-sm gap-35 padding-25"
              :class="{ active: p.id === activeProfileId }"
              role="menuitem"
            >
              <UiButton variant="none" type="button" @click.stop="selectProfile(p.id)" class="navbar-profile-row-btn flex-1 flex-align-center gap-35 border-none bg-transparent cursor-pointer color-text-primary fs-13px fw-500 border-radius-sm padding-25-50 transition-all-015 text-left w-full min-w-0">
                <ProfileAvatar :profile="p" :size="26" :title="p.name || p.id" />
                <span class="navbar-profile-row-name fs-13px fw-500 color-text-primary nowrap overflow-hidden txt-overflow-ellipsis">{{ p.name || p.id }}</span>
              </UiButton>

              <button type="button" class="navbar-profile-row-delete flex-inline-align-justify-center border-radius-sm cursor-pointer color-text-tertiary border-none bg-transparent transition-all-015 opacity-0 w-26px" title="Delete profile" @click.stop="requestDeleteProfile(p)">
                <Trash2 :size="14" />
              </button>
            </li>
          </ul>
        </div>

        <div v-else class="navbar-profile-menu-hint fs-12px color-text-tertiary text-center padding-0 padding-top-75 padding-right-50 padding-bottom-75 padding-left-50">
          {{ isGuestOnly
            ? 'Guest mode active. Create or import a profile to get started.'
            : 'No profiles yet.' }}
        </div>

        <div class="navbar-profile-menu-actions flex flex-column gap-2px margin-top-50 padding-top-50 border-top-05-border-light">
          <UiButton variant="none" class="navbar-profile-menu-action disabled-fade-40 w-full border-radius-sm cursor-pointer fs-13px fw-500 color-text-primary flex-justify-start padding-50-62 border-none bg-transparent transition-all-015" @click.stop="onCreateProfileClick">
            New profile…
          </UiButton>
          <UiButton variant="none" class="navbar-profile-menu-action disabled-fade-40 w-full border-radius-sm cursor-pointer fs-13px fw-500 color-text-primary flex-justify-start padding-50-62 border-none bg-transparent transition-all-015" :disabled="!activeProfileId" @click.stop="onExportProfile">
            Export active profile…
          </UiButton>
          <UiButton variant="none" class="navbar-profile-menu-action disabled-fade-40 w-full border-radius-sm cursor-pointer fs-13px fw-500 color-text-primary flex-justify-start padding-50-62 border-none bg-transparent transition-all-015" @click.stop="onImportProfileClick">
            Import profile…
          </UiButton>

          <div v-if="creatingProfile" class="navbar-profile-create flex flex-column margin-top-37 padding-top-50 gap-35 border-top-05-border-light">
            <UiInput bg-class="bg-fill-primary" radius-class="border-radius-sm" font-size-class="fs-13px" padding-class="padding-50-62" :focus-ring="false" v-model="newProfileName" placeholder="Profile name" class="navbar-profile-create-input fw-500 border-default focus-outline-none background-fill-primary-focus" />
            <div class="navbar-profile-create-actions flex gap-35">
              <UiButton variant="primary" class="flex-1" @click="confirmCreateProfile">
                Create
              </UiButton>
              <UiButton variant="secondary" class="flex-1" @click="cancelCreateProfile">
                Cancel
              </UiButton>
            </div>
          </div>

          <div v-if="profileMessage" class="navbar-profile-menu-message margin-top-37 fs-12px color-text-tertiary padding-25-4">
            {{ profileMessage }}
          </div>
        </div>
      </UiCard>
    </div>
  </header>

  <!-- Export Options Modal -->
  <UiModal :model-value="showExportModal" title="Export Profile" panel-class="min-w-360px max-w-90vw" @update:model-value="cancelExportModal">
          <p class="navbar-export-modal-desc fs-13px color-text-secondary line-height-15 margin-0 margin-bottom-100">
            Export your profile backup.
            <template v-if="exportRequiresPassword">
              <br/><strong>Note:</strong> Your wallet is password-protected. Enter your password to include wallet data in the backup.
            </template>
            <template v-else>
              You can optionally encrypt it with a password.
            </template>
          </p>
          
          <!-- Password required for decryption notice -->
          <div v-if="exportRequiresPassword" class="navbar-export-password-fields flex flex-column gap-62 border-radius-md margin-top-75 padding-87 bg-secondary border-05-light">
            <div class="navbar-export-field flex flex-column gap-25">
              <label class="fs-11px txt-weight-light color-text-tertiary text-uppercase navbar-export-field-label">Wallet Password</label>
              <input 
                type="password" 
                v-model="exportPassword" 
                placeholder="Enter your wallet password"
                class="navbar-export-input border-radius-sm color-text-primary fs-13px padding-50-62 border-default bg-primary focus-outline-none focus-border-accent focus-ring focus-shadow"
                @keyup.enter="confirmExportProfile"
              />
            </div>
            
            <div class="navbar-export-option margin-top-75 border-radius-sm padding-50-62">
              <UiCheckbox v-model="exportEncrypted">Also encrypt the backup file with this password</UiCheckbox>
            </div>
          </div>
          
          <!-- Optional encryption for non-protected wallets -->
          <template v-if="!exportRequiresPassword">
            <div class="navbar-export-option border-radius-sm padding-50-62">
              <UiCheckbox v-model="exportEncrypted">Encrypt backup with password</UiCheckbox>
            </div>
            
            <div v-if="exportEncrypted" class="navbar-export-password-fields flex flex-column gap-62 border-radius-md margin-top-75 padding-87 bg-secondary border-05-light">
              <div class="navbar-export-field flex flex-column gap-25">
                <label class="fs-11px txt-weight-light color-text-tertiary text-uppercase navbar-export-field-label">Password</label>
                <input 
                  type="password" 
                  v-model="exportPassword" 
                  placeholder="Enter password (min 6 characters)"
                  class="navbar-export-input border-radius-sm color-text-primary fs-13px padding-50-62 border-default bg-primary focus-outline-none focus-border-accent focus-ring focus-shadow"
                />
              </div>
              <div class="navbar-export-field flex flex-column gap-25">
                <label class="fs-11px txt-weight-light color-text-tertiary text-uppercase navbar-export-field-label">Confirm Password</label>
                <input 
                  type="password" 
                  v-model="exportPasswordConfirm" 
                  placeholder="Confirm password"
                  class="navbar-export-input border-radius-sm color-text-primary fs-13px padding-50-62 border-default bg-primary focus-outline-none focus-border-accent focus-ring focus-shadow"
                  @keyup.enter="confirmExportProfile"
                />
              </div>
            </div>
          </template>
          
          <div v-if="exportError" class="navbar-export-error border-radius-sm fs-12px padding-50-62 margin-top-62 bg-ios-red-a10 color-error-red border-05-ios-red-a25">
            {{ exportError }}
          </div>
          
    <template #footer>
      <UiButton variant="secondary" class="flex-1" @click="cancelExportModal">
        Cancel
      </UiButton>
      <UiButton variant="primary" class="flex-1" @click="confirmExportProfile">
        Export {{ exportEncrypted ? '(Encrypted)' : '' }}
      </UiButton>
    </template>
  </UiModal>

  <!-- Import Modal -->
  <UiModal :model-value="showImportModal" title="Import profile" panel-class="min-w-360px max-w-90vw w-min-560px-92vw" @update:model-value="cancelImportModal">
          <p class="navbar-export-modal-desc fs-13px color-text-secondary line-height-15 margin-0 margin-bottom-100">
            Choose how you want to import your profile.
          </p>

          <div class="navbar-import-mode-switch gap-50 margin-bottom-100 grid">
            <button
              type="button"
              class="navbar-import-mode-btn hover-fill-primary border-radius-md color-text-secondary fs-13px txt-weight-light cursor-pointer border-default bg-secondary transition-all-015 padding-62-75"
              :class="{ 'active bg-primary-a08 border-color-accent color-text-primary': importMode === 'file' }"
              @click="setImportMode('file')"
            >
              Via file
            </button>
            <button
              type="button"
              class="navbar-import-mode-btn hover-fill-primary border-radius-md color-text-secondary fs-13px txt-weight-light cursor-pointer border-default bg-secondary transition-all-015 padding-62-75"
              :class="{ 'active bg-primary-a08 border-color-accent color-text-primary': importMode === 'manual' }"
              @click="setImportMode('manual')"
            >
              Manual
            </button>
          </div>

          <div v-if="importMode === 'file'" class="import-mode-panel flex flex-column gap-75">
            <p class="navbar-import-mode-copy margin-0 border-radius-md color-text-secondary fs-13px padding-87 bg-secondary line-height-15 border-05-light">
              Keep the current workflow and select a full profile backup file or folder.
            </p>
          </div>

          <div v-else class="import-mode-panel flex flex-column gap-75">
            <div class="navbar-import-manual-actions flex flex-wrap-wrap gap-50">
              <UiButton
                variant="secondary"
                class="flex-1 min-w-180px"
                :disabled="importBusy"
                @click="loadManualProfileSourceIntoForm"
              >
                Load profile backup…
              </UiButton>
              <UiButton
                variant="secondary"
                class="flex-1 min-w-180px"
                :disabled="importBusy"
                @click="loadManualPqcSourceIntoForm"
              >
                Load Dilithium backup…
              </UiButton>
            </div>

            <div
              v-if="manualImportProfileSourceName || manualImportPqcSourceName"
              class="navbar-import-source-summary flex flex-column border-radius-md color-text-secondary fs-12px gap-25 bg-secondary padding-75-87 border-05-light"
            >
              <div v-if="manualImportProfileSourceName" class="navbar-import-source-line line-height-145 break-word">
                Profile source: {{ manualImportProfileSourceName }}
              </div>
              <div v-if="manualImportPqcSourceName" class="navbar-import-source-line line-height-145 break-word">
                Dilithium source: {{ manualImportPqcSourceName }}
              </div>
            </div>

            <div class="navbar-export-password-fields flex flex-column gap-62 border-radius-md margin-top-75 padding-87 bg-secondary border-05-light">
              <div class="navbar-export-field flex flex-column gap-25">
                <label class="fs-11px txt-weight-light color-text-tertiary text-uppercase navbar-export-field-label">Profile Name</label>
                <input
                  v-model="manualImportName"
                  type="text"
                  class="navbar-export-input border-radius-sm color-text-primary fs-13px padding-50-62 border-default bg-primary focus-outline-none focus-border-accent focus-ring focus-shadow"
                  placeholder="Enter profile name"
                />
              </div>

              <div class="navbar-export-field flex flex-column gap-25">
                <label class="fs-11px txt-weight-light color-text-tertiary text-uppercase navbar-export-field-label">Mnemonic</label>
                <textarea
                  v-model="manualImportMnemonic"
                  class="navbar-export-input navbar-import-textarea border-radius-sm color-text-primary fs-13px padding-50-62 border-default bg-primary font-inherit focus-outline-none focus-border-accent focus-ring focus-shadow min-h-84px"
                  rows="4"
                  placeholder="Enter wallet mnemonic"
                ></textarea>
              </div>

              <div class="navbar-export-field flex flex-column gap-25">
                <label class="fs-11px txt-weight-light color-text-tertiary text-uppercase navbar-export-field-label">PQC Public Key</label>
                <textarea
                  v-model="manualImportPqcPublicKey"
                  class="navbar-export-input navbar-import-textarea navbar-import-mono border-radius-sm color-text-primary fs-13px padding-50-62 border-default bg-primary mono font-inherit focus-outline-none focus-border-accent focus-ring focus-shadow min-h-84px"
                  rows="3"
                  placeholder="Optional"
                ></textarea>
              </div>

              <div class="navbar-export-field flex flex-column gap-25">
                <label class="fs-11px txt-weight-light color-text-tertiary text-uppercase navbar-export-field-label">PQC Private Key</label>
                <textarea
                  v-model="manualImportPqcPrivateKey"
                  class="navbar-export-input navbar-import-textarea navbar-import-mono border-radius-sm color-text-primary fs-13px padding-50-62 border-default bg-primary mono font-inherit focus-outline-none focus-border-accent focus-ring focus-shadow min-h-84px"
                  rows="3"
                  placeholder="Optional"
                ></textarea>
              </div>
            </div>

            <p class="navbar-import-manual-hint margin-0 fs-12px color-text-tertiary line-height-15">
              You can paste values manually or load `profile.json` and `lumen_pqc_*.json` to prefill the form.
            </p>

            <p class="navbar-import-manual-hint margin-0 fs-12px color-text-tertiary line-height-15">
              If you do not have PQC keys yet, leave both fields empty: they will be generated automatically.
            </p>
          </div>

          <div v-if="importModalError" class="navbar-export-error border-radius-sm fs-12px padding-50-62 margin-top-62 bg-ios-red-a10 color-error-red border-05-ios-red-a25">
            {{ importModalError }}
          </div>

    <template #footer>
      <UiButton variant="secondary" class="flex-1" @click="cancelImportModal">
        Cancel
      </UiButton>
      <UiButton
        variant="primary"
        class="flex-1"
        :disabled="importBusy"
        @click="importMode === 'file' ? startFileImport() : confirmManualImport()"
      >
        <span v-if="!importBusy">{{ importMode === 'file' ? 'Choose file…' : 'Import' }}</span>
        <span v-else class="navbar-import-busy-label flex-inline-align-justify-center gap-50"><UiSpinner size="sm" /> Importing…</span>
      </UiButton>
    </template>
  </UiModal>

  <!-- Import Password Modal (for encrypted backups) -->
  <UiModal :model-value="showImportPasswordModal" title="Encrypted Backup" panel-class="min-w-360px max-w-90vw" @update:model-value="cancelImportPasswordModal">
          <p class="navbar-export-modal-desc fs-13px color-text-secondary line-height-15 margin-0 margin-bottom-100">
            This backup is encrypted. Please enter the password to decrypt and import it.
          </p>
          
          <div class="navbar-export-password-fields flex flex-column gap-62 border-radius-md margin-top-75 padding-87 bg-secondary border-05-light">
            <div class="navbar-export-field flex flex-column gap-25">
              <label class="fs-11px txt-weight-light color-text-tertiary text-uppercase navbar-export-field-label">Backup Password</label>
              <input 
                type="password" 
                v-model="importPassword" 
                placeholder="Enter backup password"
                class="navbar-export-input border-radius-sm color-text-primary fs-13px padding-50-62 border-default bg-primary focus-outline-none focus-border-accent focus-ring focus-shadow"
                @keyup.enter="confirmImportEncrypted"
              />
            </div>
          </div>
          
          <div v-if="importError" class="navbar-export-error border-radius-sm fs-12px padding-50-62 margin-top-62 bg-ios-red-a10 color-error-red border-05-ios-red-a25">
            {{ importError }}
          </div>
          
    <template #footer>
      <UiButton variant="secondary" class="flex-1" @click="cancelImportPasswordModal">
        Cancel
      </UiButton>
      <UiButton variant="primary" class="flex-1" @click="confirmImportEncrypted">
        Import
      </UiButton>
    </template>
  </UiModal>

  <!-- Delete Profile Confirm Modal -->
  <UiModal :model-value="showDeleteProfileModal" title="Delete profile?" panel-class="min-w-360px max-w-90vw" @update:model-value="cancelDeleteProfileModal">
    <p class="navbar-export-modal-desc fs-13px color-text-secondary line-height-15 margin-0 margin-bottom-100">
      You are about to permanently delete <strong>{{ pendingDeleteProfileName }}</strong>.
      This cannot be recovered.
    </p>
    <template #footer>
      <UiButton variant="secondary" class="flex-1" @click="cancelDeleteProfileModal">
        Cancel
      </UiButton>
      <UiButton variant="danger" class="flex-1" @click="confirmDeleteProfile">
        Delete
      </UiButton>
    </template>
  </UiModal>

  <!-- PQC Link Notice -->
  <UiModal :model-value="showPqcLinkedModal" title="Post-quantum security enabled" panel-class="min-w-360px max-w-90vw" @update:model-value="dismissPqcLinkedModal">
    <p class="navbar-export-modal-desc fs-13px color-text-secondary line-height-15 margin-0 margin-bottom-100">
      Re-export <strong>{{ pqcLinkedProfileDisplay }}</strong>.
      Your wallet is now linked on-chain and uses post-quantum security.
    </p>
    <template #footer>
      <UiButton variant="secondary" class="flex-1" @click="dismissPqcLinkedModal">
        Ignore
      </UiButton>
      <UiButton variant="primary" class="flex-1" @click="exportAfterPqcLinked">
        Export
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiInput from '../ui/UiInput.vue';
import UiCard from '../ui/UiCard.vue';
import UiModal from '../ui/UiModal.vue';
import { computed, inject, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, RefreshCw, Search, House, Cloud, Trash2, Star, ChevronDown, Puzzle, ExternalLink } from 'lucide-vue-next';
import ActiveProfileCard from '../components/ActiveProfileCard.vue';
import ProfileAvatar from '../components/ProfileAvatar.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import { useInternalLumen } from '../composables/useInternalLumen';
import {
  profilesState,
  activeProfileId,
  setActiveProfile,
  createProfile,
  deleteProfile,
  initProfiles,
  importProfilesFromBackup,
  importProfileManually,
  pickManualProfileSource,
  pickManualPqcSource
} from '../internal/profilesStore';
import { useFavourites } from '../internal/favouritesStore';
import { buildExtensionTabUrl, normalizeAddressInput } from '../internal/navigationUrl';

type TabHistoryEntry = { url: string; title?: string };
type Tab = {
  id: string;
  history?: TabHistoryEntry[];
  history_position?: number;
  draftUrl?: string;
};

const props = defineProps<{
  tabActive: string;
  tabs: Tab[];
  loading: boolean;
  currentUrl?: string;
  isExtensionTab?: boolean;
}>();

const emit = defineEmits<{
  (e: 'goto', url: string): void;
  (e: 'history-step', payload: { delta: number }): void;
  (e: 'refresh-request'): void;
  (e: 'openSettings'): void;
}>();

const urlField = ref('');
const { toggleFavourite, isFav } = useFavourites();
const favActive = computed(() => {
  if (props.currentUrl == null) return false;
  return isFav(props.currentUrl);
});
function onToggleFavourite() {
  if (props.currentUrl == null) return;
  toggleFavourite(props.currentUrl, { title: currentHistoryTitle.value });
}
const showProfileMenu = ref(false);
const creatingProfile = ref(false);
const newProfileName = ref('');
const profileMessage = ref('');
const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
const openExtensionPopup = inject<((input: any) => void) | null>('openExtensionPopup', null);

type InstalledExtension = {
  id: string;
  name: string;
  version?: string;
  enabled: boolean;
  loaded?: boolean;
  lastError?: string;
  launchUrl?: string;
};

const showExtensionsMenu = ref(false);
const extensions = ref<InstalledExtension[]>([]);
const extensionsBusy = ref(false);
const extensionsMessage = ref('');

// Export modal state
const showExportModal = ref(false);
const exportEncrypted = ref(false);
const exportRequiresPassword = ref(false); // true if keystore/pqc is password-protected
const exportPassword = ref('');
const exportPasswordConfirm = ref('');
const exportError = ref('');

type ImportMode = 'file' | 'manual';

const showImportModal = ref(false);
const importMode = ref<ImportMode>('file');
const importBusy = ref(false);
const importModalError = ref('');
const manualImportName = ref('');
const manualImportMnemonic = ref('');
const manualImportPqcPublicKey = ref('');
const manualImportPqcPrivateKey = ref('');
const manualImportProfileSourceName = ref('');
const manualImportPqcSourceName = ref('');

// Import encrypted modal state
const showImportPasswordModal = ref(false);
const importPassword = ref('');
const importError = ref('');
const pendingEncryptedFile = ref<string | null>(null);

// Delete confirmation modal state
const showDeleteProfileModal = ref(false);
const pendingDeleteProfileId = ref('');
const pendingDeleteProfileName = ref('');

// PQC link notice state
const showPqcLinkedModal = ref(false);
const pqcLinkedProfileId = ref('');
const pqcLinkedSeen = new Set<string>();

const profiles = profilesState;

const hasProfiles = computed(() => profiles.value.length > 0);

const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const isGuestOnly = computed(
  () => activeProfile.value?.role === 'guest' && profiles.value.length === 1
);

const activeProfileDisplay = computed(
  () => activeProfile.value?.name || activeProfile.value?.id || 'Profile'
);

const pqcLinkedProfileDisplay = computed(() => {
  const id = String(pqcLinkedProfileId.value || '').trim();
  if (!id) return 'your profile';
  const p = profiles.value.find((x) => String(x?.id || '') === id) || null;
  return String(p?.name || p?.id || id);
});

const activeTab = computed<Tab | null>(() => {
  const found = props.tabs.find((t) => t.id === props.tabActive) ?? null;
  return found;
});

const currentHistoryTitle = computed(() => {
  const tab = activeTab.value;
  if (!tab || !Array.isArray(tab.history) || !tab.history.length) return "";
  const position = Number.isFinite(Number(tab.history_position))
    ? Math.max(0, Math.min(tab.history.length - 1, Number(tab.history_position)))
    : tab.history.length - 1;
  return String(tab.history[position]?.title || "").trim();
});

const canGoBack = computed(() => {
  const t = activeTab.value;
  if (!t || !Array.isArray(t.history)) return false;
  const pos = t.history_position ?? 0;
  return pos > 0;
});

const canGoForward = computed(() => {
  const t = activeTab.value;
  if (!t || !Array.isArray(t.history)) return false;
  const pos = t.history_position ?? 0;
  return pos < t.history.length - 1;
});

const loading = computed(() => props.loading);
const isExtensionTab = computed(() => !!props.isExtensionTab);

// Sync displayed URL with current tab URL
watch(
  () => [props.currentUrl, props.tabActive],
  ([val]) => {
    const v = String(val || '');
    if (urlField.value !== v) urlField.value = v;
  },
  { immediate: true }
);

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  urlField.value = value;

  // simpan draft ke tab aktif
  const tab = props.tabs.find(t => t.id === props.tabActive);
  if (tab) {
    tab.draftUrl = value;
  }
}

function previous() {
  if (!canGoBack.value) return;
  emit('history-step', { delta: -1 });
  try {
    window.dispatchEvent(
      new CustomEvent('lumen:tab-history-step', {
        detail: { delta: -1, tabId: props.tabActive },
      })
    );
  } catch {
    // ignore
  }
}

function next() {
  if (!canGoForward.value) return;
  emit('history-step', { delta: 1 });
  try {
    window.dispatchEvent(
      new CustomEvent('lumen:tab-history-step', {
        detail: { delta: 1, tabId: props.tabActive },
      })
    );
  } catch {
    // ignore
  }
}

function refresh() {
  emit('refresh-request');
}

function normalizeInput(raw: string): string {
  const builtin = [
    'home',
    'search',
    'drive',
    'wallet',
    'extensions',
    'network',
    'settings',
    'help',
    'domain',
    'explorer',
    'dao',
    'ipfs',
    'gateways',
    'release',
    'newtab',
  ];
  return normalizeAddressInput(raw, builtin);
}

function onEnter(ev: KeyboardEvent) {
  const raw = urlField.value;
  const target = normalizeInput(raw || '');

  const tab = props.tabs.find(t => t.id === props.tabActive);
  if (tab) {
    tab.draftUrl = undefined; // 🔥 clear draft
  }

  urlField.value = target;
  emit('goto', target);
}

function resetProfileUi() {
  creatingProfile.value = false;
  profileMessage.value = '';
  newProfileName.value = '';
}

function normalizeExtensionPayload(payload: any): InstalledExtension[] {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.extensions)
      ? payload.extensions
      : [];
  return items
    .map((entry: any) => ({
      id: String(entry?.id || '').trim(),
      name: String(entry?.name || 'Unnamed extension').trim() || 'Unnamed extension',
      version: String(entry?.version || '').trim(),
      enabled: !!entry?.enabled,
      loaded: !!entry?.loaded,
      lastError: String(entry?.lastError || '').trim(),
      launchUrl: String(entry?.launchUrl || '').trim()
    }))
    .filter((entry: InstalledExtension) => !!entry.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function refreshExtensions() {
  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.listExtensions !== 'function') return;
    const result = await api.listExtensions();
    if (result?.ok === false) {
      extensionsMessage.value = result?.error || 'Failed to load extensions.';
      return;
    }
    extensions.value = normalizeExtensionPayload(result);
  } catch {
    extensionsMessage.value = 'Failed to load extensions.';
  }
}

function extensionStateLabel(ext: InstalledExtension) {
  if (ext.lastError) return 'Unavailable';
  if (!ext.enabled) return 'Disabled';
  if (ext.loaded) return 'Enabled';
  return 'Pending';
}

function toggleExtensionsMenu() {
  showExtensionsMenu.value = !showExtensionsMenu.value;
  if (showExtensionsMenu.value) {
    extensionsMessage.value = '';
    void refreshExtensions();
  }
}

async function runExtensionAction(action: () => Promise<any>, successMessage = '') {
  if (extensionsBusy.value) return;
  extensionsBusy.value = true;
  extensionsMessage.value = '';
  try {
    const result = await action();
    if (!result || result.ok === false) {
      const errorMessage = String(result?.error || '').trim();
      extensionsMessage.value = errorMessage;
      return;
    }
    if (successMessage) {
      extensionsMessage.value = successMessage;
    }
    if (result?.extension || result?.extensions) {
      await refreshExtensions();
    }
  } catch (error: any) {
    extensionsMessage.value = String(error?.message || '').trim();
  } finally {
    extensionsBusy.value = false;
  }
}

async function loadUnpackedExtension() {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.loadUnpacked !== 'function') return;
  await runExtensionAction(async () => {
    const result = await api.loadUnpacked();
    if (result?.canceled) {
      return { ok: false, error: '' };
    }
    return result;
  }, 'Extension loaded.');
}

async function toggleExtensionEnabled(ext: InstalledExtension) {
  const api = useInternalLumen()?.extensions;
  if (!api) return;
  if (ext.enabled) {
    await runExtensionAction(() => api.disableExtension(ext.id), 'Extension disabled.');
  } else {
    await runExtensionAction(() => api.enableExtension(ext.id), 'Extension enabled.');
  }
}

async function reloadExtension(id: string) {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.reloadExtension !== 'function') return;
  await runExtensionAction(() => api.reloadExtension(id), 'Extension reloaded.');
}

async function removeExtension(id: string) {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.removeExtension !== 'function') return;
  await runExtensionAction(async () => {
    const result = await api.removeExtension(id);
    if (result?.ok) {
      extensions.value = extensions.value.filter((entry) => entry.id !== id);
    }
    return result;
  }, 'Extension removed.');
}

async function openExtension(ext: InstalledExtension) {
  if (!ext?.enabled) return;
  showExtensionsMenu.value = false;
  if (typeof openExtensionPopup === 'function') {
    openExtensionPopup({
      extensionId: ext.id,
      name: String(ext?.name || '').trim(),
      targetUrl: String(ext?.launchUrl || '').trim(),
      userGesture: true,
    });
    return;
  }
  const target = buildExtensionTabUrl(ext.id, { name: String(ext?.name || '').trim() });
  if (typeof openInNewTab === 'function') {
    openInNewTab(target);
    return;
  }
  emit('goto', target);
}

function openChromeWebStore() {
  showExtensionsMenu.value = false;
  emit('goto', 'lumen://extensions');
}

function toggleProfileMenu() {
  showProfileMenu.value = !showProfileMenu.value;
  if (!showProfileMenu.value) {
    resetProfileUi();
  }
}

function selectProfile(id: string) {
  setActiveProfile(id);
  showProfileMenu.value = false;
  resetProfileUi();
}

function onCreateProfileClick() {
  creatingProfile.value = true;
  profileMessage.value = '';
  newProfileName.value = '';
}

async function onExportProfile() {
  const id = activeProfileId.value;
  if (!id) return;
  
  // Check if profile requires password to decrypt data
  exportRequiresPassword.value = false;
  try {
    const api = useInternalLumen()?.profiles;
    console.log('[NavBar] checkExportRequiresPassword API available:', !!api?.checkExportRequiresPassword);
    if (api?.checkExportRequiresPassword) {
      const check = await api.checkExportRequiresPassword(id);
      console.log('[NavBar] checkExportRequiresPassword result:', check);
      if (check?.ok && check.requiresPassword) {
        exportRequiresPassword.value = true;
      }
    }
  } catch (e) {
    console.error('[NavBar] checkExportRequiresPassword error:', e);
  }
  
  console.log('[NavBar] exportRequiresPassword after check:', exportRequiresPassword.value);
  
  // Show export options modal
  showExportModal.value = true;
  exportEncrypted.value = false;
  exportPassword.value = '';
  exportPasswordConfirm.value = '';
  exportError.value = '';
}

function cancelExportModal() {
  showExportModal.value = false;
  exportEncrypted.value = false;
  exportRequiresPassword.value = false;
  exportPassword.value = '';
  exportPasswordConfirm.value = '';
  exportError.value = '';
}

async function confirmExportProfile() {
  const id = activeProfileId.value;
  if (!id) return;
  
  // Password is required if:
  // 1. User wants encrypted output, OR
  // 2. Profile data is password-protected (needs password to decrypt)
  const needsPassword = exportEncrypted.value || exportRequiresPassword.value;
  
  // Validate password
  if (needsPassword) {
    if (!exportPassword.value) {
      exportError.value = exportRequiresPassword.value 
        ? 'Password is required to decrypt your wallet data for export.'
        : 'Password is required for encrypted export.';
      return;
    }
    if (exportPassword.value.length < 6) {
      exportError.value = 'Password must be at least 6 characters.';
      return;
    }
    // Only require confirm if encrypting output AND NOT using existing wallet password
    // (when exportRequiresPassword is true, user is entering their existing wallet password)
    if (exportEncrypted.value && !exportRequiresPassword.value && exportPassword.value !== exportPasswordConfirm.value) {
      exportError.value = 'Passwords do not match.';
      return;
    }
  }
  
  exportError.value = '';
  
  try {
    // Always pass password if user entered one (either for decryption or encryption)
    // Don't rely on needsPassword flag - if there's a password entered, send it
    const password = exportPassword.value && exportPassword.value.length >= 6 ? exportPassword.value : undefined;
    
    // encryptOutput is true when user explicitly wants to encrypt the backup file
    const encryptOutput = exportEncrypted.value;
    
    // Debug: show an alert with the values before export
    const debugInfo = `Password: ${password ? password.length + ' chars' : 'none'}\nEncrypt output: ${encryptOutput}\nrequiresPassword: ${exportRequiresPassword.value}`;
    console.log('[NavBar] Export debug:', debugInfo);
    
    // Call IPC directly to bypass any module caching issues
    const api = useInternalLumen()?.profiles;
    console.log('[NavBar] Direct IPC call - password:', password ? `${password.length} chars` : 'none', 'encryptOutput:', encryptOutput);
    if (!api || typeof api.exportBackup !== 'function') {
      exportError.value = 'Export API not available';
      return;
    }
    
    const res = await api.exportBackup(id, password, encryptOutput);
    console.log('[NavBar] Direct IPC result:', res);
    
    if (!res || res.ok === false) {
      // Handle specific error messages
      if (res?.error === 'invalid_password') {
        exportError.value = 'Incorrect password. Please try again.';
        return;
      }
      if (res?.error === 'password_required_for_export') {
        exportError.value = 'Password is required to decrypt wallet data.';
        exportRequiresPassword.value = true;
        return;
      }
      exportError.value = res?.error || 'Backup export failed.';
      return;
    }
    
    cancelExportModal();
    profileMessage.value = res.path
      ? `Backup ${exportEncrypted.value ? '(encrypted) ' : ''}created at: ${res.path}`
      : 'Backup folder created for this profile.';
  } catch (e: any) {
    exportError.value = e?.message || 'Backup export failed.';
  }
}

function onImportProfileClick() {
  showImportModal.value = true;
  importMode.value = 'file';
  importBusy.value = false;
  importModalError.value = '';
  manualImportName.value = '';
  manualImportMnemonic.value = '';
  manualImportPqcPublicKey.value = '';
  manualImportPqcPrivateKey.value = '';
  manualImportProfileSourceName.value = '';
  manualImportPqcSourceName.value = '';
}

function cancelImportModal() {
  showImportModal.value = false;
  importBusy.value = false;
  importModalError.value = '';
  manualImportName.value = '';
  manualImportMnemonic.value = '';
  manualImportPqcPublicKey.value = '';
  manualImportPqcPrivateKey.value = '';
  manualImportProfileSourceName.value = '';
  manualImportPqcSourceName.value = '';
}

function setImportMode(mode: ImportMode) {
  importMode.value = mode;
  importModalError.value = '';
}

function getImportErrorMessage(error?: string) {
  const code = String(error || '').trim();
  if (!code) return 'Import failed.';
  if (code === 'backup_api_unavailable') return 'Import API not available.';
  if (code === 'missing_profile_name') return 'Profile name is required.';
  if (code === 'missing_mnemonic') return 'Mnemonic is required.';
  if (code === 'invalid_mnemonic') return 'Invalid mnemonic. Check the words and try again.';
  if (code === 'pqc_keys_incomplete') {
    return 'Enter both PQC public and private keys, or leave both empty.';
  }
  if (code === 'password_required') {
    return 'Unlock the app first to import PQC keys.';
  }
  if (code === 'invalid_password') {
    return 'Unlock the app with the correct password to import PQC keys.';
  }
  if (code === 'invalid_profile_backup') {
    return 'The selected profile backup file is invalid or unsupported.';
  }
  if (code === 'encrypted_backup_source_unsupported') {
    return 'Encrypted backups cannot prefill manual import. Use Via file instead.';
  }
  if (code === 'mnemonic_missing_in_selected_file') {
    return 'The selected file does not contain a mnemonic.';
  }
  if (code === 'pqc_missing_in_selected_file') {
    return 'The selected file does not contain Dilithium key material.';
  }
  if (code === 'invalid_pqc_backup') {
    return 'The selected Dilithium backup is invalid or unsupported.';
  }
  if (code === 'no_valid_backups_found') return 'No valid backup file was found.';
  if (code === 'profile_json_missing') return 'No profile backup file was found.';
  return code;
}

async function startFileImport() {
  if (importBusy.value) return;

  importBusy.value = true;
  importModalError.value = '';

  try {
    const result = await importProfilesFromBackup();
    if (result.ok) {
      cancelImportModal();
      profileMessage.value = `Imported ${result.imported || 1} profile(s) from backup.`;
      return;
    }

    if (result.error === 'encrypted_backup_found' && result.encryptedFiles?.length) {
      pendingEncryptedFile.value = result.encryptedFiles[0];
      importPassword.value = '';
      importError.value = '';
      cancelImportModal();
      showImportPasswordModal.value = true;
      return;
    }

    if (result.error !== 'canceled') {
      importModalError.value = getImportErrorMessage(result.error || 'Backup import failed.');
    }
  } catch {
    importModalError.value = 'Backup import failed.';
  } finally {
    importBusy.value = false;
  }
}

async function loadManualProfileSourceIntoForm() {
  if (importBusy.value) return;

  importModalError.value = '';
  const result = await pickManualProfileSource();
  if (!result.ok) {
    if (result.error && result.error !== 'canceled') {
      importModalError.value = getImportErrorMessage(result.error);
    }
    return;
  }

  if (result.name) {
    manualImportName.value = result.name;
  }
  if (result.mnemonic) {
    manualImportMnemonic.value = result.mnemonic;
  }
  if (result.pqcPublicKey && result.pqcPrivateKey) {
    manualImportPqcPublicKey.value = result.pqcPublicKey;
    manualImportPqcPrivateKey.value = result.pqcPrivateKey;
    manualImportPqcSourceName.value = result.fileName
      ? `${result.fileName} (embedded PQC)`
      : 'Embedded PQC';
  }
  manualImportProfileSourceName.value = result.fileName || 'Loaded profile backup';
}

async function loadManualPqcSourceIntoForm() {
  if (importBusy.value) return;

  importModalError.value = '';
  const result = await pickManualPqcSource();
  if (!result.ok) {
    if (result.error && result.error !== 'canceled') {
      importModalError.value = getImportErrorMessage(result.error);
    }
    return;
  }

  manualImportPqcPublicKey.value = String(result.pqcPublicKey || '');
  manualImportPqcPrivateKey.value = String(result.pqcPrivateKey || '');
  manualImportPqcSourceName.value = result.fileName || 'Loaded Dilithium backup';
}

async function confirmManualImport() {
  if (importBusy.value) return;

  const name = manualImportName.value.trim();
  const mnemonic = manualImportMnemonic.value.trim().replace(/\s+/g, ' ');
  const pqcPublicKey = manualImportPqcPublicKey.value.trim();
  const pqcPrivateKey = manualImportPqcPrivateKey.value.trim();

  if (!name) {
    importModalError.value = 'Profile name is required.';
    return;
  }

  if (!mnemonic) {
    importModalError.value = 'Mnemonic is required.';
    return;
  }

  if ((pqcPublicKey && !pqcPrivateKey) || (!pqcPublicKey && pqcPrivateKey)) {
    importModalError.value = 'Enter both PQC public and private keys, or leave both empty.';
    return;
  }

  importBusy.value = true;
  importModalError.value = '';

  try {
    const result = await importProfileManually({
      name,
      mnemonic,
      pqcPublicKey,
      pqcPrivateKey,
    });

    if (!result.ok) {
      importModalError.value = getImportErrorMessage(result.error);
      return;
    }

    cancelImportModal();
    profileMessage.value =
      pqcPublicKey && pqcPrivateKey
        ? 'Profile imported manually.'
        : 'Profile imported manually. PQC keys will be generated automatically when needed.';
  } catch {
    importModalError.value = 'Manual import failed.';
  } finally {
    importBusy.value = false;
  }
}

function cancelImportPasswordModal() {
  showImportPasswordModal.value = false;
  importPassword.value = '';
  importError.value = '';
  pendingEncryptedFile.value = null;
}

async function confirmImportEncrypted() {
  if (!pendingEncryptedFile.value || !importPassword.value) {
    importError.value = 'Password is required.';
    return;
  }

  importError.value = '';

  try {
    const api = useInternalLumen()?.profiles;
    if (!api || typeof api.importEncryptedBackup !== 'function') {
      importError.value = 'Import API not available.';
      return;
    }

    const res = await api.importEncryptedBackup(pendingEncryptedFile.value, importPassword.value);
    
    if (res && res.ok) {
      cancelImportPasswordModal();
      await initProfiles();
      profileMessage.value = 'Encrypted profile imported successfully.';
    } else if (res?.error === 'invalid_password') {
      importError.value = 'Invalid password. Please try again.';
    } else {
      importError.value = res?.error || 'Import failed.';
    }
  } catch (e: any) {
    importError.value = e?.message || 'Import failed.';
  }
}

async function confirmCreateProfile() {
  const name = newProfileName.value.trim();
  if (!name) {
    profileMessage.value = 'Profile name is required.';
    return;
  }
  try {
    const created = await createProfile(name);
    if (created) {
      creatingProfile.value = false;
      profileMessage.value = 'Profile created.';
    } else {
      profileMessage.value = 'Failed to create profile. (No profile returned)';
      console.error('[NavBar] Failed to create profile: createProfile returned null or undefined');
    }
  } catch (e) {
    profileMessage.value = 'Error creating profile: ' + (e?.message || e || 'Unknown error');
    console.error('[NavBar] Error creating profile:', e);
  }
}

function cancelCreateProfile() {
  creatingProfile.value = false;
  newProfileName.value = '';
}

function requestDeleteProfile(p: any) {
  const id = String(p && p.id ? p.id : '').trim();
  if (!id) return;
  pendingDeleteProfileId.value = id;
  pendingDeleteProfileName.value = String(p && (p.name || p.id) ? (p.name || p.id) : id);
  showDeleteProfileModal.value = true;
}

function cancelDeleteProfileModal() {
  showDeleteProfileModal.value = false;
  pendingDeleteProfileId.value = '';
  pendingDeleteProfileName.value = '';
}

function dismissPqcLinkedModal() {
  showPqcLinkedModal.value = false;
  pqcLinkedProfileId.value = '';
}

async function exportAfterPqcLinked() {
  const id = String(pqcLinkedProfileId.value || activeProfileId.value || '').trim();
  dismissPqcLinkedModal();
  if (!id) return;
  if (id !== activeProfileId.value) {
    await setActiveProfile(id);
  }
  await onExportProfile();
}

async function confirmDeleteProfile() {
  const id = String(pendingDeleteProfileId.value || '').trim();
  if (!id) return;

  const res = await deleteProfile(id);
  if (!res || res.ok !== true) {
    const err = String((res as any)?.error || 'delete_failed');
    if (err === 'password_required') {
      profileMessage.value = 'Unlock your wallet to delete this profile.';
    } else {
      profileMessage.value = 'Failed to delete profile.';
    }
    return;
  }

  cancelDeleteProfileModal();
  profileMessage.value = 'Profile deleted.';
}

function onGlobalClick(e: MouseEvent) {
  if (
    showExportModal.value ||
    showImportModal.value ||
    showImportPasswordModal.value ||
    showDeleteProfileModal.value ||
    showPqcLinkedModal.value
  ) {
    return;
  }

  const el = e.target as HTMLElement | null;
  if (!el) return;
  if (el.closest('.extensions-trigger') || el.closest('.extensions-menu')) return;
  if (el.closest('.profile-trigger') || el.closest('.profile-menu')) return;
  showExtensionsMenu.value = false;
  showProfileMenu.value = false;
  resetProfileUi();
}

let detachPqcLinkedListener: null | (() => void) = null;
let detachExtensionsListener: null | (() => void) = null;
onMounted(() => {
  void initProfiles();
  void refreshExtensions();
  window.addEventListener('click', onGlobalClick);

  try {
    const api = useInternalLumen()?.profiles;
    if (api && typeof api.onPqcLinked === 'function') {
      detachPqcLinkedListener = api.onPqcLinked((payload: any) => {
        try {
          const profileId = String(payload?.profileId || '').trim();
          const address = String(payload?.address || '').trim();
          if (!profileId) return;
          const key = address || profileId;
          if (pqcLinkedSeen.has(key)) return;
          pqcLinkedSeen.add(key);
          pqcLinkedProfileId.value = profileId;
          showPqcLinkedModal.value = true;
        } catch {
          // ignore handler errors
        }
      });
    }
  } catch {
    // ignore
  }

  try {
    const api = useInternalLumen()?.extensions;
    if (api && typeof api.onChanged === 'function') {
      detachExtensionsListener = api.onChanged((payload: any) => {
        extensions.value = normalizeExtensionPayload(payload);
      });
    }
  } catch {
    // ignore
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick);
  try {
    detachPqcLinkedListener?.();
  } catch {
    // ignore
  }
  detachPqcLinkedListener = null;
  try {
    detachExtensionsListener?.();
  } catch {
    // ignore
  }
  detachExtensionsListener = null;
});
</script>
