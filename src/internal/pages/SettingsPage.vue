<template>
  <!-- ####### lumen://settings SETTINGS ####### -->
  <div class="internal-page flex">
    <!-- ####### lumen://settings SIDEBAR ####### -->
    <InternalSidebar title="Settings" :icon="Settings" activeKey="settings">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection title="General">
          <UiSidebarNavItem :active="currentView === 'appearance'" @click="currentView = 'appearance'">
            <Palette :size="18" />
            <span>Appearance</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'content'" @click="currentView = 'content'">
            <EyeOff :size="18" />
            <span>Content</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'network'" @click="currentView = 'network'">
            <Globe :size="18" />
            <span>Network</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'privacy'" @click="currentView = 'privacy'">
            <Shield :size="18" />
            <span>Privacy</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'security'" @click="currentView = 'security'">
            <Lock :size="18" />
            <span>Security</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'profiles'" @click="currentView = 'profiles'">
            <User :size="18" />
            <span>Profiles &amp; backups</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'privatecloud'" @click="currentView = 'privatecloud'">
            <Cloud :size="18" />
            <span>Private Cloud</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>

        <UiSidebarNavSection title="Advanced">
          <UiSidebarNavItem :active="currentView === 'troubleshooting'" @click="currentView = 'troubleshooting'">
            <AlertTriangle :size="18" />
            <span>Troubleshooting</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'advanced'" @click="currentView = 'advanced'">
            <Code2 :size="18" />
            <span>Developer settings</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'about'" @click="currentView = 'about'">
            <Info :size="18" />
            <span>About</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>

    </InternalSidebar>

    <!-- ####### lumen://settings MAIN CONTENT ####### -->
    <main class="flex flex-column flex-1 m-0px min-w-0 overflow-hidden py-32px px-40px bg-secondary border-radius-0">
      <!-- Header -->
      <UiPageHeader :title="getViewTitle()" :subtitle="getViewDescription()" />

      <!-- ####### lumen://settings APPEARANCE VIEW ####### -->
      <div v-if="currentView === 'appearance'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow label="Theme Preference" description="Choose your preferred color scheme">
            <div class="flex gap-8px border-radius-10px bg-secondary border-1 p-4px">
              <UiSegmentedButton :active="theme === 'light'" @click="setTheme('light')">
                <Sun :size="18" />
                <span>Light</span>
              </UiSegmentedButton>
              <UiSegmentedButton :active="theme === 'dark'" @click="setTheme('dark')">
                <Moon :size="18" />
                <span>Dark</span>
              </UiSegmentedButton>
              <UiSegmentedButton :active="theme === 'system'" @click="setTheme('system')">
                <Monitor :size="18" />
                <span>System</span>
              </UiSegmentedButton>
            </div>
          </UiOptionRow>
          <UiOptionRow label="Font Size" description="Adjust the default font size">
            <select class="text-14px color-text-primary cursor-pointer py-8px px-16px bg-secondary border-1 border-radius-8px" v-model="fontSize">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </UiOptionRow>
          <UiOptionRow label="Brightness" :description="`Adjust screen brightness (${brightness}%)`" control-class="gap-16px w-full max-w-320px">
            <Sun :size="16" class="color-text-secondary flex-shrink-0" />
            <input
              type="range"
              min="50"
              max="100"
              v-model="brightness"
              class="slider-thumb-accent flex-1 outline-none border-radius-4px bg-border h-6px appearance-none"
            />
            <span class="text-right text-14px txt-weight-light color-text-secondary min-w-48px">{{ brightness }}%</span>
          </UiOptionRow>
        </div>
      </div>

      <!-- ####### lumen://settings CONTENT VIEW ####### -->
      <div v-else-if="currentView === 'content'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow label="Show sexual content">
            <UiToggle v-model="showSexualContent" />
          </UiOptionRow>

          <UiOptionRow label="Show violent / gore content">
            <UiToggle v-model="showViolentContent" />
          </UiOptionRow>

          <UiOptionRow label="Show disturbing imagery">
            <UiToggle v-model="showDisturbingImagery" />
          </UiOptionRow>

          <UiHintText>
            Sensitive content is blurred by default. You can choose what to reveal.
          </UiHintText>
        </div>
      </div>

      <!-- ####### lumen://settings PRIVACY VIEW ####### -->
      <div v-else-if="currentView === 'privacy'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow label="Save browsing history">
            <template #description>
              Keep recent web, domain, IPFS, and IPNS pages for
              {{ activeHistoryProfileDisplay }}. Internal pages like New Tab, Wallet, Settings,
              and Extensions are excluded automatically.
            </template>
            <UiToggle :model-value="historyEnabled" @update:model-value="onHistoryToggleChange" />
          </UiOptionRow>

          <UiOptionRow label="Saved items">
            <template #description>
              {{ historyEntries.length }} history item{{ historyEntries.length === 1 ? '' : 's' }}
              saved for {{ activeHistoryProfileDisplay }}.
            </template>
            <UiButton variant="secondary" @click="openInNewTabSafe('lumen://history')" class="disabled-fade-50">
              Open history
            </UiButton>
          </UiOptionRow>

          <UiOptionRow label="Clear saved history" description="Permanently remove the saved browsing history for this profile.">
            <UiButton variant="secondary" :disabled="!historyEntries.length" @click="clearProfileHistory" class="disabled-fade-50">
              Clear history
            </UiButton>
          </UiOptionRow>

          <UiHintText>
            Turning history off stops new entries from being saved, but does not delete existing ones.
          </UiHintText>
        </div>
      </div>

      <!-- ####### lumen://settings NETWORK VIEW ####### -->
      <div v-else-if="currentView === 'network'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow label="Kubo connectivity" description="Controls how many peer connections the embedded IPFS node tries to keep." control-class="flex-justify-end">
            <div class="flex gap-8px border-radius-10px flex-wrap-wrap bg-secondary border-1 p-4px">
              <UiSegmentedButton :active="ipfsConnectivityMode === 'light'" :disabled="networkSettingsSaving" extra-class="flex-justify-center min-w-140px" @click="saveIpfsConnectivityMode('light')">
                <span>Light</span>
              </UiSegmentedButton>
              <UiSegmentedButton :active="ipfsConnectivityMode === 'normal'" :disabled="networkSettingsSaving" extra-class="flex-justify-center min-w-140px" @click="saveIpfsConnectivityMode('normal')">
                <span>Normal</span>
              </UiSegmentedButton>
              <UiSegmentedButton :active="ipfsConnectivityMode === 'high'" :disabled="networkSettingsSaving" extra-class="flex-justify-center min-w-140px" @click="saveIpfsConnectivityMode('high')">
                <span>High connectivity</span>
              </UiSegmentedButton>
            </div>
          </UiOptionRow>

          <UiHintText>
            If your network is unstable or your device is resource-constrained, Light is recommended.
          </UiHintText>
          <UiHintText>
            Changes are applied automatically by restarting the embedded Kubo daemon.
          </UiHintText>
          <UiHintText>
            Current idle connection target:
            <span class="break-all mono">{{ networkModeSummary }}</span>
          </UiHintText>
          <UiHintText v-if="networkSettingsError">
            {{ networkSettingsError }}
          </UiHintText>
        </div>
      </div>

      <!-- ####### lumen://settings SECURITY VIEW ####### -->
      <div v-else-if="currentView === 'security'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <!-- Status Display -->
          <UiOptionRow label="Password Protection">
            <template #description>
              {{ securityStatus.enabled
                ? 'Password is required to unlock the app and to sign wallet operations'
                : 'No password set - the app and wallet operations are unprotected' }}
            </template>
            <span
              class="flex-inline-align-center gap-6px border-radius-20px fw-500 inline-flex py-4px px-12px"
              :class="securityStatus.enabled ? 'status-enabled bg-fill-success' : 'bg-fill-tertiary'"
            >
              {{ securityStatus.enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </UiOptionRow>

          <!-- Session Status (only shown when password is enabled) -->
          <UiOptionRow v-if="securityStatus.enabled" label="Session Status" :description="securitySessionStatusText">
            <UiButton variant="secondary" v-if="securitySessionActive"
              @click="lockSecuritySession" class="disabled-fade-50">
              <LockKeyhole :size="16" />
              Lock Now
            </UiButton>
            <span v-else class="bg-warning-a15 color-warning flex-inline-align-center gap-6px border-radius-20px fw-500 inline-flex py-4px px-12px">
              <LockKeyhole :size="14" />
              Locked
            </span>
          </UiOptionRow>

          <UiOptionRow v-if="securityStatus.enabled" label="Password Cache Duration" description="Choose how long the password stays cached before the session locks.">
            <select
              v-model="securitySessionTimeoutValue"
              class="text-14px color-text-primary cursor-pointer py-8px px-16px bg-secondary border-1 border-radius-8px"
              :disabled="securitySessionTimeoutSaving"
              @change="saveSecuritySessionTimeout"
            >
              <option
                v-for="option in SECURITY_SESSION_TIMEOUT_OPTIONS"
                :key="option.serialized"
                :value="option.serialized"
              >
                {{ option.label }}
              </option>
            </select>
          </UiOptionRow>

          <!-- Set Password (when no password is set) -->
          <UiOptionRow v-if="!securityStatus.enabled" label="Set Password" description="Create a password to lock the app and protect wallet signing operations. Your keys will be encrypted with this password." />

          <div v-if="!securityStatus.enabled" class="flex flex-column gap-16px border-radius-12px py-16px px-20px bg-fill-tertiary mt-8px">
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">New Password</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="newPassword"
                placeholder="Enter password (min 8 characters)"
                :disabled="securityLoading"
              />
            </div>
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">Confirm Password</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="confirmPassword"
                placeholder="Confirm password"
                :disabled="securityLoading"
                @keyup.enter="setSecurityPassword"
              />
            </div>
            <div v-if="securityError" class="color-error text-14px p-0px pt-8px pb-8px">
              {{ securityError }}
            </div>
            <UiButton variant="primary" @click="setSecurityPassword"
              :disabled="securityLoading || !newPassword || !confirmPassword" class="disabled-fade-50">
              {{ securityLoading ? 'Setting up...' : 'Enable Password Protection' }}
            </UiButton>
          </div>

          <!-- Change/Remove Password (when password is set) -->
          <UiOptionRow v-if="securityStatus.enabled" label="Change Password" description="Update your security password. You'll need to enter your current password." />

          <div v-if="securityStatus.enabled" class="flex flex-column gap-16px border-radius-12px py-16px px-20px bg-fill-tertiary mt-8px">
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">Current Password</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="currentPassword"
                placeholder="Enter current password"
                :disabled="securityLoading"
              />
            </div>
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">New Password</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="newPassword"
                placeholder="Enter new password (min 8 characters)"
                :disabled="securityLoading"
              />
            </div>
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">Confirm New Password</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="confirmPassword"
                placeholder="Confirm new password"
                :disabled="securityLoading"
                @keyup.enter="changeSecurityPassword"
              />
            </div>
            <div v-if="securityError" class="color-error text-14px p-0px pt-8px pb-8px">
              {{ securityError }}
            </div>
            <div v-if="securitySuccess" class="color-success text-14px p-0px pt-8px pb-8px">
              {{ securitySuccess }}
            </div>
            <div class="flex gap-12px mt-8px">
              <UiButton variant="primary" @click="changeSecurityPassword"
                :disabled="securityLoading || !currentPassword || !newPassword || !confirmPassword" class="disabled-fade-50">
                {{ securityLoading ? 'Changing...' : 'Change Password' }}
              </UiButton>
            </div>
          </div>

          <!-- Remove Password -->
          <UiOptionRow v-if="securityStatus.enabled" label="Remove Password" description="Disable password protection. Your keys will be re-encrypted with app-level encryption only." class="mt-24px">
            <UiButton variant="danger" @click="showRemovePasswordConfirm = true"
              :disabled="securityLoading" class="disabled-fade-50">
              Remove Password
            </UiButton>
          </UiOptionRow>

          <!-- Remove Password Confirmation -->
          <div v-if="showRemovePasswordConfirm" class="flex flex-column gap-12px border-radius-12px py-16px px-20px bg-fill-error mt-12px border-1-error-a25">
            <p class="m-0px text-14px color-text-primary">Enter your current password to disable protection:</p>
            <UiInput
              type="password"
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
              v-model="removePasswordInput"
              placeholder="Current password"
              :disabled="securityLoading"
              @keyup.enter="removeSecurityPassword"
            />
            <div v-if="securityError" class="color-error text-14px p-0px pt-8px pb-8px">
              {{ securityError }}
            </div>
            <div class="flex gap-12px mt-8px">
              <UiButton variant="secondary" @click="cancelRemovePassword"
                :disabled="securityLoading" class="disabled-fade-50">
                Cancel
              </UiButton>
              <UiButton variant="danger" @click="removeSecurityPassword"
                :disabled="securityLoading || !removePasswordInput" class="disabled-fade-50">
                {{ securityLoading ? 'Removing...' : 'Confirm Remove' }}
              </UiButton>
            </div>
          </div>

          <p class="mt-16px color-text-tertiary text-13px">
            <strong>How it works:</strong> When enabled, the entire app locks and requires
            your password whenever the session isn't active - on launch, and again once
            the cache duration below expires from inactivity. Wallet signing operations
            (send tokens, delegate, create domain, etc.) also check for an active session,
            so an expired one re-locks the app instead of prompting inline just for that
            operation. {{ securitySessionHintText }}
          </p>
        </div>
      </div>

      <!-- ####### lumen://settings PROFILES VIEW ####### -->
      <div v-else-if="currentView === 'profiles'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow label="Profiles" description="Select one or more profiles to export." control-class="gap-8px flex-wrap-wrap flex-justify-end">
            <UiButton variant="secondary" type="button"
              @click="selectAllProfiles"
              :disabled="!profiles.length" class="disabled-fade-50">
              Select all
            </UiButton>
            <UiButton variant="secondary" type="button"
              @click="clearSelectedProfiles"
              :disabled="!selectedProfileIds.length" class="disabled-fade-50">
              Clear
            </UiButton>
            <UiButton variant="secondary" type="button"
              @click="onExportSelectedBackups"
              :disabled="!selectedProfileIds.length || exportingBackup" class="disabled-fade-50">
              Export selected ({{ selectedProfileIds.length }})
            </UiButton>
          </UiOptionRow>
          <UiHintText>
            Backups include the encrypted keystore, profile metadata and PQC keys (pqc_keys). Export creates one folder per selected profile.
          </UiHintText>
          <UiHintText v-if="backupExportSummary">{{ backupExportSummary }}</UiHintText>
          <div v-if="backupExportFailures.length" class="flex flex-column gap-4px mt-4px">
            <div v-for="f in backupExportFailures" :key="f.id" class="color-error text-13px">
              {{ f.id }}: {{ f.error || 'failed' }}
            </div>
          </div>

          <UiCard padding="none" :shadow="false" v-if="profiles.length" class="flex flex-column gap-4px p-8px">
            <label
              v-for="p in profiles"
              :key="p.id"
              class="hover-bg-hover transition-bg-fast flex-align-center gap-12px border-radius-12px cursor-pointer py-12px px-16px cursor-select-none"
              :class="{ 'bg-primary-a15': p.id === activeProfileId }"
            >
              <input
                class="w-16px h-16px"
                type="checkbox"
                :value="p.id"
                v-model="selectedProfileIds"
              />
              <ProfileAvatar class="flex-shrink-0" :profile="p" :size="32" :title="p.name || p.id" />
              <div class="flex flex-column gap-4px min-w-0">
                <div class="flex-align-center gap-8px min-w-0">
                  <span class="txt-weight-light color-text-primary text-14px truncate max-w-520px">{{ p.name || p.id }}</span>
                  <span v-if="p.id === activeProfileId" class="border-radius-full color-text-primary text-11px py-0px px-8px bg-primary-a15 border-1-primary-a20">Active</span>
                </div>
                <span class="text-12px color-text-tertiary truncate max-w-520px">{{ p.id }}</span>
              </div>
            </label>
          </UiCard>
          <UiHintText v-else>No profiles found.</UiHintText>

          <UiOptionRow v-if="profiles.length" label="Display name" description="Rename a profile without changing its internal profile ID." control-class="gap-8px">
            <select
              v-model="renameProfileId"
              class="text-14px color-text-primary cursor-pointer py-8px px-16px bg-secondary border-1 border-radius-8px"
              :disabled="profileRenameSaving"
            >
              <option
                v-for="p in profiles"
                :key="`rename-${p.id}`"
                :value="p.id"
              >
                {{ p.name || p.id }}
              </option>
            </select>
            <UiInput
              v-model="renameProfileDraft"
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-320px"
              placeholder="Enter a display name"
              :disabled="profileRenameSaving || !renameProfileId"
              @keyup.enter="saveProfileDisplayName"
            />
            <UiButton variant="secondary" type="button"
              :disabled="profileRenameSaving || !renameProfileId"
              @click="resetProfileDisplayNameDraft" class="disabled-fade-50">
              Reset
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="profileRenameSaving || !renameProfileId"
              @click="saveProfileDisplayName" class="disabled-fade-50">
              {{ profileRenameSaving ? 'Saving...' : 'Save' }}
            </UiButton>
          </UiOptionRow>
          <UiHintText v-if="profileRenameError">
            {{ profileRenameError }}
          </UiHintText>

          <UiOptionRow v-if="profiles.length" label="Profile photo" description="Override the generated profile thumbnail with a local image." control-class="flex-wrap-wrap gap-8px flex-justify-end">
            <select
              v-model="avatarProfileId"
              class="text-14px color-text-primary cursor-pointer py-8px px-16px bg-secondary border-1 border-radius-8px"
              :disabled="profileAvatarSaving"
            >
              <option
                v-for="p in profiles"
                :key="`avatar-${p.id}`"
                :value="p.id"
              >
                {{ p.name || p.id }}
              </option>
            </select>
            <ProfileAvatar
              class="flex-shrink-0"
              :profile="avatarProfileTarget"
              :size="44"
              :title="avatarProfileTarget?.name || avatarProfileTarget?.id || 'Profile'"
            />
            <UiButton variant="secondary" type="button"
              :disabled="profileAvatarSaving || !avatarProfileId"
              @click="chooseProfileAvatar" class="disabled-fade-50">
              {{ profileAvatarSaving ? 'Updating...' : 'Choose image' }}
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="profileAvatarSaving || !avatarProfileTarget?.avatarDataUrl"
              @click="resetProfileAvatar" class="disabled-fade-50">
              Reset
            </UiButton>
          </UiOptionRow>
          <UiHintText v-if="profileAvatarError">
            {{ profileAvatarError }}
          </UiHintText>
          <UiHintText v-if="profiles.length">
            Lumen crops the selected image to a square thumbnail and stores it with the profile.
          </UiHintText>

        </div>
      </div>

      <!-- ####### lumen://settings DEVELOPER SETTINGS VIEW ####### -->
      <div v-else-if="currentView === 'advanced'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiHintText>
            These settings are intended for developers. Most users should not need to change them.
          </UiHintText>

          <div class="flex-align-center gap-8px mt-16px txt-weight-medium color-text-primary mb-8px text-14px">
            <Globe :size="18" />
            <span>Network</span>
          </div>

          <UiOptionRow label="Local IPFS Gateway" description="Used for loading IPFS content in the UI">
            <UiInput
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-320px"
              v-model="localGatewayDraft"
              placeholder="http://127.0.0.1:8080"
            />
          </UiOptionRow>

          <div class="flex-align-center gap-8px mt-16px txt-weight-medium color-text-primary mb-8px text-14px">
            <Database :size="18" />
            <span>IPFS</span>
          </div>

          <UiOptionRow label="IPFS API Endpoint" description="Used by the Electron backend (Kubo API)">
            <UiInput
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-320px"
              v-model="ipfsApiDraft"
              placeholder="http://127.0.0.1:5001"
            />
          </UiOptionRow>

          <UiOptionRow label="Max upload size (local drive)" description="Maximum size per local upload before it is rejected. Default 10 GB." control-class="gap-8px">
            <UiInput
              type="number"
              min="1"
              step="1"
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-96px"
              v-model="localDriveMaxUploadSizeDraft"
              :placeholder="String(DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB)"
            />
            <span class="color-text-secondary text-13px">GB</span>
          </UiOptionRow>

          <UiHintText v-if="devSettingsError">
            {{ devSettingsError }}
          </UiHintText>

          <div class="flex mt-12px gap-8px">
            <UiButton variant="secondary" type="button"
              :disabled="devSettingsSaving"
              @click="resetDevSettings" class="disabled-fade-50">
              Reset
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="devSettingsSaving"
              @click="saveDevSettings" class="disabled-fade-50">
              {{ devSettingsSaving ? 'Saving...' : 'Save' }}
            </UiButton>
          </div>

          <UiHintText>
            Note: the local IPFS daemon must actually be configured to use these ports/addresses. Changes apply automatically here, no restart needed.
          </UiHintText>

          <div class="flex-align-center gap-8px mt-16px txt-weight-medium color-text-primary mb-8px text-14px">
            <FolderOpen :size="18" />
            <span>Lumen data folder</span>
          </div>

          <UiOptionRow label="Custom data folder target" description="Override the default folder used by the Lumen binary for IPFS, profiles, logs and app metadata." control-class="flex-justify-end min-w-420px">
            <div class="flex-align-center-justify-end gap-8px w-full">
              <UiInput
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-min-520px-full"
                v-model="lumenDataFolderDraft"
                :placeholder="defaultUserDataPath || 'D:\\Lumen'"
                :disabled="lumenDataFolderBusy"
              />
              <UiButton variant="secondary" type="button"
                :disabled="lumenDataFolderBusy"
                @click="browseLumenDataFolder" class="disabled-fade-50">
                <FolderOpen :size="16" />
                <span>Browse...</span>
              </UiButton>
            </div>
          </UiOptionRow>

          <UiHintText>
            Next launch target: <span class="break-all mono">{{ effectiveUserDataPath || defaultUserDataPath || 'Unavailable' }}</span>
          </UiHintText>
          <UiHintText v-if="lumenDataFolderError">
            {{ lumenDataFolderError }}
          </UiHintText>

          <div class="flex mt-12px gap-8px">
            <UiButton variant="secondary" type="button"
              :disabled="lumenDataFolderBusy"
              @click="revertLumenDataFolderDraft" class="disabled-fade-50">
              Revert
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="lumenDataFolderBusy"
              @click="useDefaultLumenDataFolderDraft" class="disabled-fade-50">
              Use default
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="lumenDataFolderBusy"
              @click="saveLumenDataFolder" class="disabled-fade-50">
              {{ lumenDataFolderSaving ? 'Applying...' : 'Apply' }}
            </UiButton>
          </div>

          <UiHintText>
            Restart Lumen after changing this target. Existing files are not moved automatically.
          </UiHintText>
          <UiHintText v-if="bootstrapRestartRequired">
            Restart required: the running app is still using <span class="break-all mono">{{ activeUserDataPath }}</span>.
          </UiHintText>
        </div>
      </div>

      <!-- ####### lumen://settings TROUBLESHOOTING VIEW ####### -->
      <div v-else-if="currentView === 'troubleshooting'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiHintText>
            Generate a safe support bundle for remote troubleshooting. Passwords, password hashes, API keys and private keys are excluded.
          </UiHintText>

          <UiOptionRow label="Copy Debug Report" description="Copy app info, sanitized settings, service status, file inventory and recent log excerpts to the clipboard.">
            <UiButton variant="secondary" type="button"
              @click="copyDebugReport"
              :disabled="troubleshootingBusy" class="disabled-fade-50">
              <Copy :size="16" />
              <span>{{ troubleshootingAction === 'copy' ? 'Copying...' : 'Copy Debug Report' }}</span>
            </UiButton>
          </UiOptionRow>

          <UiOptionRow label="Open Logs Folder" description="Open the logs folder containing the live Electron log, the latest debug report and safe copies of known support logs.">
            <UiButton variant="secondary" type="button"
              @click="openLogsFolderAction"
              :disabled="troubleshootingBusy" class="disabled-fade-50">
              <FolderOpen :size="16" />
              <span>{{ troubleshootingAction === 'open' ? 'Opening...' : 'Open Logs Folder' }}</span>
            </UiButton>
          </UiOptionRow>

          <UiHintText>
            The logs folder is regenerated on demand so people can inspect the current support snapshot and share relevant log excerpts.
          </UiHintText>
          <p v-if="troubleshootingDir" class="border-radius-12px color-text-secondary mt-4px py-12px px-16px bg-card border-default text-12px break-all">
            Logs folder: {{ troubleshootingDir }}
          </p>
          <p v-if="troubleshootingReportPath" class="border-radius-12px color-text-secondary mt-4px py-12px px-16px bg-card border-default text-12px break-all">
            Debug report: {{ troubleshootingReportPath }}
          </p>
        </div>
      </div>

      <!-- ####### lumen://settings PRIVATE CLOUD VIEW ####### -->
      <div v-else-if="currentView === 'privatecloud'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <!-- Main Enable Toggle -->
          <UiOptionRow :class="{ 'border-color-success bg-gradient-success-soft': privateCloudEnabled }" class="border-width-2px" description="Use your own private IPFS gateways for content delivery">
            <template #label>
              <Cloud :size="18" class="inline-block align-middle mr-8px" />
              Enable Private Cloud
            </template>
            <UiToggle v-model="privateCloudEnabled" />
          </UiOptionRow>

          <!-- Settings when enabled -->
          <template v-if="privateCloudEnabled">
            <!-- Gateway Preferences -->
            <div class="mt-16px">
              <h3 class="txt-weight-light color-text-primary text-15px m-0px mb-12px">Gateway Preferences</h3>

              <UiOptionRow label="Prefer Private Gateways" description="Try private gateways first before DAO gateways">
                <UiToggle v-model="preferPrivateGateways" />
              </UiOptionRow>

              <UiOptionRow label="Fallback to DAO Gateways" description="Use DAO gateways if private gateways fail">
                <UiToggle v-model="fallbackToDAO" />
              </UiOptionRow>
            </div>

            <!-- Gateway IDs -->
            <div class="mt-16px">
              <div class="flex-align-center-justify-space-between mb-8px">
                <h3 class="txt-weight-light color-text-primary text-15px m-0px mb-12px">Gateway IDs</h3>
                <span class="flex-inline-align-justify-center text-12px txt-weight-light color-primary border-radius-10px h-24px py-0px px-8px bg-primary-a15 min-w-24px">{{ gatewayIds.length }}</span>
              </div>
              <p class="text-14px color-text-secondary m-0px mb-16px">Add gateway IDs to use for private content delivery</p>

              <div class="border-radius-12px p-16px bg-secondary border-1">
                <div v-if="gatewayIds.length > 0" class="flex flex-column gap-8px mb-16px">
                  <div v-for="(id, index) in gatewayIds" :key="index" class="flex-align-center-justify-space-between py-12px px-16px bg-card border-1 border-radius-8px transition-all-02 hover-border-primary">
                    <span class="mono color-text-primary text-14px">{{ id }}</span>
                    <UiButton variant="icon" @click="removeGatewayId(index)">
                      <X :size="16" />
                    </UiButton>
                  </div>
                </div>
                <UiEmptyState v-else title="No gateway IDs configured" description="Add your first gateway ID below">
                  <Server :size="40" class="opacity-40" />
                </UiEmptyState>

                <div class="flex gap-12px">
                  <UiInput
                    v-model="newGatewayId"
                    font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-320px flex-1"
                    placeholder="Enter gateway ID (e.g., gateway-123)"
                    @keyup.enter="addGatewayId"
                  />
                  <UiButton variant="secondary" @click="addGatewayId" :disabled="!newGatewayId.trim()" class="disabled-fade-50">
                    <Plus :size="16" />
                    Add
                  </UiButton>
                </div>
              </div>
            </div>

            <!-- Advanced Settings -->
            <div class="mt-16px">
              <h3 class="txt-weight-light color-text-primary text-15px m-0px mb-12px">Advanced Settings</h3>

              <UiOptionRow label="Request Timeout" :description="`Maximum time to wait for gateway response (${gatewayTimeout / 1000}s)`">
                <input
                  type="range"
                  min="1000"
                  max="30000"
                  step="1000"
                  v-model.number="gatewayTimeout"
                  class="slider-thumb-accent flex-1 outline-none border-radius-4px bg-border h-6px appearance-none"
                />
                <span class="text-right text-14px txt-weight-light color-text-secondary min-w-48px">{{ gatewayTimeout / 1000 }}s</span>
              </UiOptionRow>

              <UiOptionRow label="Max Retries" description="Maximum retry attempts per gateway">
                <UiInput
                  type="number"
                  min="1"
                  max="10"
                  :model-value="String(maxRetries)"
                  @update:model-value="(v: string) => (maxRetries = Math.round(clamp(v, 1, 10)))"
                  font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-80px"
                />
              </UiOptionRow>
            </div>

            <!-- Info Box -->
            <div class="flex gap-16px border-radius-12px mt-16px py-16px px-20px border-15-primary-a20">
              <Info :size="20" class="flex-shrink-0 color-primary" />
              <div>
                <strong class="block text-14px color-text-primary mb-4px">Need to create a gateway?</strong>
                <p class="text-14px color-text-secondary m-0px line-height-15">Visit <a class="color-primary fw-500 hover-underline" href="lumen://my-gateways" @click.prevent="navigate?.('lumen://my-gateways', { push: true })">My Gateways</a> to set up your private gateway server.</p>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ####### lumen://settings ABOUT VIEW ####### -->
      <div v-else-if="currentView === 'about'" class="flex-1 overflow-y-auto">
        <div class="flex-align-center flex-column text-center border-radius-20px bg-card p-48px border-1">
          <div class="mb-24px">
            <div class="flex-align-justify-center size-64px border-radius-20px bg-gradient-primary color-white shadow-primary">
              <Hexagon :size="32" />
            </div>
          </div>
          <h2 class="text-24px txt-weight-medium color-text-primary m-0px mb-8px">Lumen Browser</h2>
          <p class="text-14px color-text-secondary m-0px mb-16px">Version {{ appVersion }}</p>
          <p class="text-14px color-text-secondary m-0px mb-24px">The Decentralized Internet Stack</p>
          <div class="flex gap-16px">
            <a
              href="https://lumen-browser.com/"
              class="color-primary fw-500 text-14px hover-underline"
              @click.prevent="openInNewTabSafe('https://lumen-browser.com/')"
              >Website</a
            >
            <a
              href="https://github.com/network-lumen"
              class="color-primary fw-500 text-14px hover-underline"
              @click.prevent="openInNewTabSafe('https://github.com/network-lumen')"
              >GitHub</a
            >
            <a
              href="lumen://help"
              class="color-primary fw-500 text-14px hover-underline"
              @click.prevent="openInNewTabSafe('lumen://help')"
              >Documentation</a
            >
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import UiCard from '../../ui/UiCard.vue';
import UiOptionRow from '../../ui/UiOptionRow.vue';
import UiSegmentedButton from '../../ui/UiSegmentedButton.vue';
import UiButton from '../../ui/UiButton.vue';
import UiInput from '../../ui/UiInput.vue';
import UiToggle from '../../ui/UiToggle.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiHintText from '../../ui/UiHintText.vue';
import { ref, watch, computed, onMounted } from 'vue';
import { useInternalLumen } from '../../composables/useInternalLumen';

const { currentTabRefresh } = useTabState();
import {
  Settings,
  Palette,
  Shield,
  EyeOff,
  AlertTriangle,
  Globe,
  Database,
  Code2,
  Copy,
  FolderOpen,
  Info,
  Hexagon,
  User,
  Sun,
  Moon,
  Monitor,
  Lock,
  LockKeyhole,
  Cloud,
  Server,
  Plus,
  X
} from 'lucide-vue-next';
import { useTheme } from '../../composables/useTheme';
import { STORAGE_KEYS, readString, writeString } from '../services/storage';
import { clamp, errorMessage } from '../services/coerce';
import { normalizeHttpBaseUrl } from '../navigationUrl';
import { useToast } from '../../composables/useToast';
import ProfileAvatar from '../../components/ProfileAvatar.vue';
import { useHistory } from '../historyStore';
import {
  profilesState,
  activeProfileId,
  exportProfilesBackup,
  updateProfileName,
  updateProfileAvatarFromPath,
  clearProfileAvatar,
} from '../profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import pkg from '../../../package.json';
import {
  appSettingsState,
  DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
  type IpfsConnectivityMode,
  setAppSettings,
} from '../services/appSettings';
import {
  SECURITY_SESSION_TIMEOUT_OPTIONS,
  getSecuritySessionTimeoutCacheText,
  getSecuritySessionTimeoutHelpText,
  parseSecuritySessionTimeoutMs,
  stringifySecuritySessionTimeoutMs,
} from '../services/securitySessionTimeout';
import type { BootstrapPathState } from '../../types/settingsPage';

import { useTabNavigation, useTabState } from '../../composables/useTabNavigation';
import { isPasswordLongEnough } from '../services/passwordPolicy';
const toast = useToast();
const appVersion = String((pkg as any)?.version || '0.0.0');

const { navigate, openInNewTab } = useTabNavigation();

function openInNewTabSafe(url: string) {
  if (openInNewTab) {
    openInNewTab(url);
    return;
  }
  navigate?.(url, { push: true });
}

function onHistoryToggleChange(enabled: boolean) {
  setHistoryEnabled(enabled);
  toast.success(enabled ? 'Browsing history enabled' : 'Browsing history disabled');
}

function clearProfileHistory() {
  if (!historyEntries.value.length) return;
  const confirmed = window.confirm(`Clear the saved history for ${activeHistoryProfileDisplay.value}?`);
  if (!confirmed) return;
  clearHistory();
  toast.success('Browsing history cleared');
}

const currentView = ref<'appearance' | 'content' | 'network' | 'privacy' | 'security' | 'profiles' | 'advanced' | 'troubleshooting' | 'privatecloud' | 'about'>('appearance');
const { theme, setTheme, initTheme } = useTheme();
const fontSize = ref(readString(STORAGE_KEYS.fontSize) || 'medium');
const brightness = ref(parseInt(readString(STORAGE_KEYS.brightness) || '100'));
const { historyEntries, historyEnabled, clearHistory, setHistoryEnabled } = useHistory();
const exportingBackup = ref(false);
const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const activeProfileDisplay = computed(() => activeProfile.value?.name || activeProfile.value?.id || '');
const activeHistoryProfileDisplay = computed(() => activeProfileDisplay.value || 'this profile');
const selectedProfileIds = ref<string[]>([]);
const lastBackupExport = ref<
  | null
  | {
      ok: boolean;
      baseDir?: string;
      results?: { id: string; ok: boolean; path?: string; error?: string }[];
      error?: string;
    }
>(null);
const renameProfileId = ref('');
const renameProfileDraft = ref('');
const profileRenameSaving = ref(false);
const profileRenameError = ref('');
const avatarProfileId = ref('');
const profileAvatarSaving = ref(false);
const profileAvatarError = ref('');

const backupExportSummary = computed(() => {
  const res = lastBackupExport.value;
  if (!res) return '';
  if (!res.ok) return 'Backup export failed.';
  const results = Array.isArray(res.results) ? res.results : [];
  const okCount = results.filter((r) => r && r.ok).length;
  const total = results.length || 0;
  const base = res.baseDir ? ` to ${res.baseDir}` : '';
  if (total <= 1) return `Exported ${okCount ? '1 profile' : '0 profiles'}${base}.`;
  if (!okCount) return `Export failed for ${total} profiles${base}.`;
  if (okCount === total) return `Exported ${okCount} profiles${base}.`;
  return `Exported ${okCount}/${total} profiles${base}.`;
});

const backupExportFailures = computed(() => {
  const res = lastBackupExport.value;
  if (!res || !res.ok) return [];
  const results = Array.isArray(res.results) ? res.results : [];
  return results.filter((r) => r && r.ok === false);
});
const renameProfileTarget = computed(
  () => profiles.value.find((p) => p.id === renameProfileId.value) || null,
);
const avatarProfileTarget = computed(
  () => profiles.value.find((p) => p.id === avatarProfileId.value) || null,
);

const localGatewayDraft = ref('');
const ipfsApiDraft = ref('');
const localDriveMaxUploadSizeDraft = ref(String(DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB));
const ipfsConnectivityMode = ref<IpfsConnectivityMode>('normal');
const networkSettingsSaving = ref(false);
const networkSettingsError = ref('');
const devSettingsSaving = ref(false);
const devSettingsError = ref('');
const lumenDataFolderDraft = ref('');
const lumenDataFolderSaving = ref(false);
const lumenDataFolderLoading = ref(false);
const lumenDataFolderError = ref('');
const defaultUserDataPath = ref('');
const effectiveUserDataPath = ref('');
const activeUserDataPath = ref('');
const activeLogsPath = ref('');
const bootstrapConfigPath = ref('');
const currentCustomUserDataPath = ref('');
const bootstrapRestartRequired = ref(false);
const troubleshootingAction = ref<'' | 'copy' | 'open'>('');
const troubleshootingDir = ref('');
const troubleshootingReportPath = ref('');
const troubleshootingBusy = computed(() => troubleshootingAction.value !== '');
const lumenDataFolderBusy = computed(
  () => lumenDataFolderSaving.value || lumenDataFolderLoading.value,
);

// Private Cloud state
const privateCloudEnabled = ref(false);
const preferPrivateGateways = ref(false);
const fallbackToDAO = ref(true);
const gatewayIds = ref<string[]>([]);
const newGatewayId = ref('');
const gatewayTimeout = ref(5000);
const maxRetries = ref(3);
const privateCloudLoading = ref(false);
const privateCloudInitialized = ref(false);

const showSexualContent = ref(!!appSettingsState.value.showSexualContent);
const showViolentContent = ref(!!appSettingsState.value.showViolentContent);
const showDisturbingImagery = ref(!!appSettingsState.value.showDisturbingImagery);
const contentSaving = ref(false);

watch(
  () => appSettingsState.value,
  (next) => {
    ipfsConnectivityMode.value = next.ipfsConnectivityMode || 'normal';
    showSexualContent.value = !!next.showSexualContent;
    showViolentContent.value = !!next.showViolentContent;
    showDisturbingImagery.value = !!next.showDisturbingImagery;
  },
  { deep: true },
);

const networkModeSummary = computed(() => {
  switch (ipfsConnectivityMode.value) {
    case 'light':
      return 'Light: trims idle peers back to 12 when it reaches 24.';
    case 'high':
      return 'High connectivity: trims idle peers back to 64 when it reaches 192.';
    case 'normal':
    default:
      return 'Normal: trims idle peers back to 32 when it reaches 96.';
  }
});

watch([showSexualContent, showViolentContent, showDisturbingImagery], async () => {
  if (contentSaving.value) return;
  contentSaving.value = true;
  try {
    await setAppSettings({
      showSexualContent: !!showSexualContent.value,
      showViolentContent: !!showViolentContent.value,
      showDisturbingImagery: !!showDisturbingImagery.value,
    });
  } finally {
    contentSaving.value = false;
  }
});

async function saveIpfsConnectivityMode(nextMode: IpfsConnectivityMode) {
  if (networkSettingsSaving.value) return;
  if (ipfsConnectivityMode.value === nextMode) return;

  const previousMode = ipfsConnectivityMode.value;
  networkSettingsSaving.value = true;
  networkSettingsError.value = '';
  ipfsConnectivityMode.value = nextMode;

  try {
    const res = await setAppSettings({ ipfsConnectivityMode: nextMode });
    if (!res.ok) {
      ipfsConnectivityMode.value = previousMode;
      networkSettingsError.value = String(res.error || 'Failed to update Kubo connectivity mode.');
      toast.error(networkSettingsError.value);
      return;
    }
    toast.success('Kubo connectivity mode updated');
  } finally {
    networkSettingsSaving.value = false;
  }
}

// Security state
const securityStatus = ref<{ enabled: boolean }>({ enabled: false });
const securitySessionActive = ref(false);
const securityLoading = ref(false);
const securityError = ref('');
const securitySuccess = ref('');
const securitySessionTimeoutValue = ref(
  stringifySecuritySessionTimeoutMs(appSettingsState.value.securitySessionTimeoutMs),
);
const securitySessionTimeoutSaving = ref(false);
const newPassword = ref('');
const confirmPassword = ref('');
const currentPassword = ref('');
const removePasswordInput = ref('');
const showRemovePasswordConfirm = ref(false);
const securitySessionStatusText = computed(() => {
  if (!securitySessionActive.value) {
    return 'Session locked - password required to unlock the app';
  }
  return `Session unlocked - password cached ${getSecuritySessionTimeoutCacheText(
    appSettingsState.value.securitySessionTimeoutMs,
  )}`;
});
const securitySessionHintText = computed(
  () =>
    `After entering the password, it stays cached ${getSecuritySessionTimeoutHelpText(
      appSettingsState.value.securitySessionTimeoutMs,
    )} for convenience.`,
);

watch(
  () => appSettingsState.value.securitySessionTimeoutMs,
  (next) => {
    securitySessionTimeoutValue.value = stringifySecuritySessionTimeoutMs(next);
  },
  { immediate: true },
);

// Security functions
async function loadSecurityStatus() {
  try {
    const status = await useInternalLumen()?.security.getStatus();
    securityStatus.value = { enabled: !!(status?.passwordEnabled && status?.hasPassword) };
    const session = await useInternalLumen()?.security.checkSession();
    securitySessionActive.value = !!session?.active;
  } catch (e) {
    console.error('Failed to load security status:', e);
  }
}

async function saveSecuritySessionTimeout() {
  if (securitySessionTimeoutSaving.value) return;

  const currentTimeout = appSettingsState.value.securitySessionTimeoutMs;
  const nextTimeout = parseSecuritySessionTimeoutMs(securitySessionTimeoutValue.value);
  if (currentTimeout === nextTimeout) return;

  securitySessionTimeoutSaving.value = true;
  try {
    const res = await setAppSettings({ securitySessionTimeoutMs: nextTimeout });
    if (!res.ok) {
      securitySessionTimeoutValue.value = stringifySecuritySessionTimeoutMs(currentTimeout);
      toast.error(String(res.error || 'Failed to update password cache duration'));
      return;
    }
    toast.success('Password cache duration updated');
  } finally {
    securitySessionTimeoutSaving.value = false;
  }
}

async function setSecurityPassword() {
  securityError.value = '';
  securitySuccess.value = '';
  
  if (!isPasswordLongEnough(newPassword.value)) {
    securityError.value = 'Password must be at least 8 characters.';
    return;
  }
  
  if (newPassword.value !== confirmPassword.value) {
    securityError.value = 'Passwords do not match.';
    return;
  }
  
  securityLoading.value = true;
  try {
    const result = await useInternalLumen()?.security.setPassword({ password: newPassword.value });
    if (result?.ok) {
      securityStatus.value = { enabled: true };
      securitySessionActive.value = true;
      newPassword.value = '';
      confirmPassword.value = '';
      securitySuccess.value = 'Password protection enabled successfully.';
      toast.success('Password protection enabled');
    } else {
      securityError.value = result?.error || 'Failed to set password.';
      toast.error(result?.error || 'Failed to set password');
    }
  } catch (e) {
    securityError.value = errorMessage(e, 'Failed to set password.');
    toast.error(errorMessage(e, 'Failed to set password'));
  } finally {
    securityLoading.value = false;
  }
}

async function changeSecurityPassword() {
  securityError.value = '';
  securitySuccess.value = '';
  
  if (!isPasswordLongEnough(newPassword.value)) {
    securityError.value = 'New password must be at least 8 characters.';
    return;
  }
  
  if (newPassword.value !== confirmPassword.value) {
    securityError.value = 'New passwords do not match.';
    return;
  }
  
  securityLoading.value = true;
  try {
    // Verify current password first
    const verify = await useInternalLumen()?.security.verifyPassword({ password: currentPassword.value });
    if (!verify?.ok) {
      securityError.value = 'Current password is incorrect.';
      securityLoading.value = false;
      return;
    }
    
    // Remove old and set new
    const removeResult = await useInternalLumen()?.security.removePassword({ password: currentPassword.value });
    if (!removeResult?.ok) {
      securityError.value = removeResult?.error || 'Failed to change password.';
      securityLoading.value = false;
      return;
    }
    
    const setResult = await useInternalLumen()?.security.setPassword({ password: newPassword.value });
    if (setResult?.ok) {
      currentPassword.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
      securitySuccess.value = 'Password changed successfully.';
      toast.success('Password changed successfully');
    } else {
      securityError.value = setResult?.error || 'Failed to set new password.';
      toast.error(setResult?.error || 'Failed to set new password');
    }
  } catch (e) {
    securityError.value = errorMessage(e, 'Failed to change password.');
    toast.error(errorMessage(e, 'Failed to change password'));
  } finally {
    securityLoading.value = false;
  }
}

async function removeSecurityPassword() {
  securityError.value = '';
  securitySuccess.value = '';
  securityLoading.value = true;
  
  try {
    const result = await useInternalLumen()?.security.removePassword({ password: removePasswordInput.value });
    if (result?.ok) {
      securityStatus.value = { enabled: false };
      securitySessionActive.value = false;
      removePasswordInput.value = '';
      showRemovePasswordConfirm.value = false;
      securitySuccess.value = 'Password protection removed.';
      toast.success('Password protection removed');
    } else {
      securityError.value = result?.error || 'Failed to remove password.';
      toast.error(result?.error || 'Failed to remove password');
    }
  } catch (e) {
    securityError.value = errorMessage(e, 'Failed to remove password.');
    toast.error(errorMessage(e, 'Failed to remove password'));
  } finally {
    securityLoading.value = false;
  }
}

function cancelRemovePassword() {
  showRemovePasswordConfirm.value = false;
  removePasswordInput.value = '';
  securityError.value = '';
}

async function lockSecuritySession() {
  try {
    await useInternalLumen()?.security.lockSession();
    securitySessionActive.value = false;
  } catch (e) {
    console.error('Failed to lock session:', e);
  }
}

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    loadSecurityStatus();
  }
);

// Load security status on mount
onMounted(() => {
  loadSecurityStatus();
});

// Reload security status when switching to security view
watch(
  () => currentView.value,
  (v) => {
    if (v === 'network') {
      networkSettingsError.value = '';
    }
    if (v === 'security') {
      loadSecurityStatus();
      // Clear form state
      securityError.value = '';
      securitySuccess.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
      currentPassword.value = '';
      removePasswordInput.value = '';
      showRemovePasswordConfirm.value = false;
    }
    if (v === 'privatecloud') {
      loadPrivateCloudConfig();
    }
  },
);

// Initialize theme on mount
initTheme();

watch(fontSize, (newSize) => {
  writeString(STORAGE_KEYS.fontSize, newSize);
  document.documentElement.setAttribute('data-font-size', newSize);
});

watch(brightness, (newBrightness) => {
  writeString(STORAGE_KEYS.brightness, newBrightness.toString());
  document.documentElement.style.setProperty('--screen-brightness', `${newBrightness}%`);
  document.body.style.filter = `brightness(${newBrightness}%)`;
});

// Apply brightness on mount
onMounted(() => {
  document.body.style.filter = `brightness(${brightness.value}%)`;
});

watch(
  () => currentView.value,
  (v) => {
    if (v !== 'advanced') return;
    localGatewayDraft.value = String(appSettingsState.value.localGatewayBase || '').trim();
    ipfsApiDraft.value = String(appSettingsState.value.ipfsApiBase || '').trim();
    localDriveMaxUploadSizeDraft.value = String(
      appSettingsState.value.localDriveMaxUploadSizeGb || DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
    );
    devSettingsError.value = '';
    loadBootstrapPathState();
  },
  { immediate: true },
);

function validatePositiveInteger(raw: string): number | null {
  const value = String(raw || '').trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function normalizeFolderDraft(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value === '/') return value;
  if (/^[a-zA-Z]:[\\/]?$/.test(value)) {
    return `${value.slice(0, 2)}\\`;
  }
  const trimmed = value.replace(/[\\/]+$/, '');
  const platform = String(useInternalLumen()?.appPlatform || '').toLowerCase();
  return platform === 'win32' ? trimmed.toLowerCase() : trimmed;
}

function applyBootstrapPathState(state: Partial<BootstrapPathState> | null | undefined) {
  const next = state || {};
  defaultUserDataPath.value = String(next.defaultUserDataPath || '').trim();
  currentCustomUserDataPath.value = String(next.customUserDataPath || '').trim();
  effectiveUserDataPath.value = String(next.effectiveUserDataPath || '').trim();
  activeUserDataPath.value = String(next.activeUserDataPath || '').trim();
  activeLogsPath.value = String(next.activeLogsPath || '').trim();
  bootstrapConfigPath.value = String(next.bootstrapConfigPath || '').trim();
  bootstrapRestartRequired.value = !!next.restartRequired;
  lumenDataFolderDraft.value = currentCustomUserDataPath.value;
}

async function loadBootstrapPathState() {
  const api = useInternalLumen();
  if (!api || typeof api.bootstrapPathGetState !== 'function') {
    lumenDataFolderError.value = 'Lumen data folder controls are unavailable.';
    return;
  }
  lumenDataFolderLoading.value = true;
  lumenDataFolderError.value = '';
  try {
    const result = await api.bootstrapPathGetState();
    if (!result?.ok || !result?.state) {
      lumenDataFolderError.value = String(result?.error || 'Failed to load Lumen data folder.');
      return;
    }
    applyBootstrapPathState(result.state);
  } catch (e) {
    lumenDataFolderError.value = errorMessage(e, 'Failed to load Lumen data folder.');
  } finally {
    lumenDataFolderLoading.value = false;
  }
}

function resetDevSettings() {
  localGatewayDraft.value = String(appSettingsState.value.localGatewayBase || '').trim();
  ipfsApiDraft.value = String(appSettingsState.value.ipfsApiBase || '').trim();
  localDriveMaxUploadSizeDraft.value = String(
    appSettingsState.value.localDriveMaxUploadSizeGb || DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
  );
  devSettingsError.value = '';
}

async function saveDevSettings() {
  if (devSettingsSaving.value) return;
  const localGatewayBase = normalizeHttpBaseUrl(localGatewayDraft.value);
  const ipfsApiBase = normalizeHttpBaseUrl(ipfsApiDraft.value);
  const localDriveMaxUploadSizeGb = validatePositiveInteger(localDriveMaxUploadSizeDraft.value);
  if (!localGatewayBase) {
    devSettingsError.value = 'Invalid Local IPFS Gateway URL.';
    return;
  }
  if (!ipfsApiBase) {
    devSettingsError.value = 'Invalid IPFS API URL.';
    return;
  }
  if (localDriveMaxUploadSizeGb == null) {
    devSettingsError.value = 'Invalid max upload size. Enter a whole number of GB.';
    return;
  }

  devSettingsSaving.value = true;
  devSettingsError.value = '';
  try {
    const res = await setAppSettings({
      localGatewayBase,
      ipfsApiBase,
      localDriveMaxUploadSizeGb,
    });
    if (!res.ok) {
      devSettingsError.value = String(res.error || 'Failed to save settings.');
      return;
    }
    localGatewayDraft.value = String(appSettingsState.value.localGatewayBase || '').trim();
    ipfsApiDraft.value = String(appSettingsState.value.ipfsApiBase || '').trim();
    localDriveMaxUploadSizeDraft.value = String(
      appSettingsState.value.localDriveMaxUploadSizeGb || DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
    );
    toast.success('Developer settings saved');
  } finally {
    devSettingsSaving.value = false;
  }
}

function revertLumenDataFolderDraft() {
  lumenDataFolderDraft.value = currentCustomUserDataPath.value;
  lumenDataFolderError.value = '';
}

function useDefaultLumenDataFolderDraft() {
  lumenDataFolderDraft.value = '';
  lumenDataFolderError.value = '';
}

async function browseLumenDataFolder() {
  const api = useInternalLumen();
  if (!api || typeof api.dialogOpenFolder !== 'function') {
    lumenDataFolderError.value = 'Folder picker is unavailable.';
    return;
  }
  lumenDataFolderError.value = '';
  try {
    const result = await api.dialogOpenFolder({ title: 'Select Lumen data folder' });
    if (!result?.ok || !Array.isArray(result.paths) || !result.paths.length) {
      if (result?.error && result.error !== 'canceled') {
        lumenDataFolderError.value = String(result.error);
      }
      return;
    }
    lumenDataFolderDraft.value = String(result.paths[0] || '').trim();
  } catch (e) {
    lumenDataFolderError.value = errorMessage(e, 'Failed to open folder picker.');
  }
}

async function saveLumenDataFolder() {
  if (lumenDataFolderBusy.value) return;
  const api = useInternalLumen();
  if (
    !api ||
    typeof api.bootstrapPathSetCustomUserDataPath !== 'function' ||
    typeof api.bootstrapPathResetCustomUserDataPath !== 'function'
  ) {
    lumenDataFolderError.value = 'Lumen data folder controls are unavailable.';
    return;
  }

  const nextDraft = String(lumenDataFolderDraft.value || '').trim();
  const currentDraft = String(currentCustomUserDataPath.value || '').trim();
  if (normalizeFolderDraft(nextDraft) === normalizeFolderDraft(currentDraft)) {
    lumenDataFolderError.value = '';
    return;
  }

  lumenDataFolderSaving.value = true;
  lumenDataFolderError.value = '';
  try {
    const result = nextDraft
      ? await api.bootstrapPathSetCustomUserDataPath(nextDraft)
      : await api.bootstrapPathResetCustomUserDataPath();
    if (!result?.ok || !result?.state) {
      lumenDataFolderError.value = String(result?.error || 'Failed to save Lumen data folder.');
      return;
    }
    applyBootstrapPathState(result.state);
    if (result.state.restartRequired) {
      toast.success('Lumen data folder updated. Restart Lumen to apply the new location.');
    } else {
      toast.success('Lumen data folder updated.');
    }
  } catch (e) {
    lumenDataFolderError.value = errorMessage(e, 'Failed to save Lumen data folder.');
  } finally {
    lumenDataFolderSaving.value = false;
  }
}

function applyTroubleshootingPaths(result: any) {
  if (result?.dir) {
    troubleshootingDir.value = String(result.dir);
  }
  if (result?.reportPath) {
    troubleshootingReportPath.value = String(result.reportPath);
  }
}

async function copyDebugReport() {
  if (troubleshootingBusy.value) return;
  const api = useInternalLumen()?.troubleshooting;
  if (!api || typeof api.copyDebugReport !== 'function') {
    toast.error('Troubleshooting tools are unavailable');
    return;
  }

  troubleshootingAction.value = 'copy';
  try {
    const result = await api.copyDebugReport();
    applyTroubleshootingPaths(result);
    if (result?.ok) {
      toast.success('Debug report copied to clipboard');
      return;
    }
    toast.error(result?.error || 'Failed to copy debug report');
  } catch (e) {
    toast.error(errorMessage(e, 'Failed to copy debug report'));
  } finally {
    troubleshootingAction.value = '';
  }
}

async function openLogsFolderAction() {
  if (troubleshootingBusy.value) return;
  const api = useInternalLumen()?.troubleshooting;
  if (!api || typeof api.openLogsFolder !== 'function') {
    toast.error('Troubleshooting tools are unavailable');
    return;
  }

  troubleshootingAction.value = 'open';
  try {
    const result = await api.openLogsFolder();
    applyTroubleshootingPaths(result);
    if (result?.ok) {
      toast.success('Logs folder opened');
      return;
    }
    toast.error(result?.error || 'Failed to open logs folder');
  } catch (e) {
    toast.error(errorMessage(e, 'Failed to open logs folder'));
  } finally {
    troubleshootingAction.value = '';
  }
}

// Private Cloud functions
async function loadPrivateCloudConfig() {
  privateCloudLoading.value = true;
  try {
    const config = await useInternalLumen()?.settingsLoadPrivateCloudConfig();

    privateCloudEnabled.value = !!config.enabled;
    preferPrivateGateways.value = !!config.preferPrivate;
    fallbackToDAO.value = config.fallbackToDAO !== false;
    gatewayIds.value = Array.isArray(config.gatewayIds) ? config.gatewayIds : [];
    gatewayTimeout.value = typeof config.timeout === 'number' ? config.timeout : 5000;
    maxRetries.value = typeof config.maxRetries === 'number' ? config.maxRetries : 3;
  } catch (e) {
    console.error('Failed to load private cloud config:', e);
  } finally {
    privateCloudLoading.value = false;
    // Use nextTick to ensure all reactive updates are done before enabling watch
    await new Promise(resolve => setTimeout(resolve, 100));
    privateCloudInitialized.value = true;
  }
}

async function savePrivateCloudConfig() {
  try {
    const config = {
      enabled: privateCloudEnabled.value,
      gatewayIds: [...gatewayIds.value], // Convert Proxy to plain array
      preferPrivate: preferPrivateGateways.value,
      fallbackToDAO: fallbackToDAO.value,
      timeout: gatewayTimeout.value,
      maxRetries: maxRetries.value
    };
    
    const result = await useInternalLumen()?.settingsSavePrivateCloudConfig(config);

    if (!result.ok) {
      console.error('Failed to save private cloud config:', result.error);
      toast.error(result.error || 'Failed to save private cloud settings');
    }
  } catch (e) {
    console.error('Failed to save private cloud config:', e);
    toast.error('Failed to save private cloud settings');
  }
}

function addGatewayId() {
  const id = newGatewayId.value.trim();
  if (!id) return;
  if (gatewayIds.value.includes(id)) {
    toast.error('Gateway ID already added');
    return;
  }
  gatewayIds.value.push(id);
  newGatewayId.value = '';
  savePrivateCloudConfig();
}

function removeGatewayId(index: number) {
  gatewayIds.value.splice(index, 1);
  savePrivateCloudConfig();
}

// Watch for changes to save automatically
watch([privateCloudEnabled, preferPrivateGateways, fallbackToDAO, gatewayTimeout, maxRetries], () => {
  // Only auto-save if not loading and has been initialized (prevents save on initial load)
  if (!privateCloudLoading.value && privateCloudInitialized.value) {
    savePrivateCloudConfig();
  }
});

function getViewTitle(): string {
  const titles: Record<string, string> = {
    appearance: 'Appearance',
    content: 'Content Settings',
    network: 'Network',
    privacy: 'Privacy & Security',
    security: 'Security',
    profiles: 'Profiles & backups',
    privatecloud: 'Private Cloud',
    advanced: 'Developer settings',
    troubleshooting: 'Troubleshooting',
    about: 'About Lumen'
  };
  return titles[currentView.value] || 'Settings';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    appearance: 'Customize the look and feel',
    content: 'Control sensitive content visibility',
    network: 'Tune how aggressively the embedded Kubo node keeps peer connections',
    privacy: 'Manage your privacy settings',
    security: 'Password protection for wallet operations',
    profiles: 'Backup or restore profiles and PQC keys',
    privatecloud: 'Configure your private IPFS gateways',
    advanced: 'Advanced network and storage configuration',
    troubleshooting: 'Collect support info and open safe logs',
    about: 'Information about Lumen'
  };
  return descs[currentView.value] || '';
}

function selectAllProfiles() {
  selectedProfileIds.value = profiles.value.map((p) => p.id);
}

function clearSelectedProfiles() {
  selectedProfileIds.value = [];
  lastBackupExport.value = null;
}

function syncRenameProfileDraft() {
  const target = renameProfileTarget.value;
  renameProfileDraft.value = String(target?.name || target?.id || '').trim();
  profileRenameError.value = '';
}

function resetProfileDisplayNameDraft() {
  syncRenameProfileDraft();
}

function mapProfileAvatarError(error: string) {
  switch (String(error || '').trim()) {
    case 'missing_profile_id':
      return 'Select a profile first.';
    case 'missing_avatar_path':
      return 'Select an image file first.';
    case 'avatar_file_not_found':
      return 'Selected image could not be found.';
    case 'invalid_avatar_image':
      return 'Selected file is not a supported image.';
    case 'unsupported_environment':
      return 'File picker is not available in this environment.';
    case 'avatar_processing_failed':
      return 'Could not generate the profile thumbnail.';
    case 'profile_not_found':
      return 'Profile not found.';
    case 'profiles_api_unavailable':
      return 'Profile photo editing is unavailable in this build.';
    default:
      return 'Failed to update the profile photo.';
  }
}

async function saveProfileDisplayName() {
  if (profileRenameSaving.value) return;
  const profileId = String(renameProfileId.value || '').trim();
  const nextName = String(renameProfileDraft.value || '').trim();
  if (!profileId) {
    profileRenameError.value = 'Select a profile first.';
    return;
  }
  if (!nextName) {
    profileRenameError.value = 'Display name is required.';
    return;
  }

  const currentName = String(renameProfileTarget.value?.name || renameProfileTarget.value?.id || '').trim();
  if (nextName === currentName) {
    profileRenameError.value = '';
    return;
  }

  profileRenameSaving.value = true;
  profileRenameError.value = '';
  try {
    const result = await updateProfileName(profileId, nextName);
    if (!result.ok) {
      profileRenameError.value = String(result.error || 'Failed to update display name.');
      return;
    }
    syncRenameProfileDraft();
    toast.success('Profile display name updated');
  } finally {
    profileRenameSaving.value = false;
  }
}

async function chooseProfileAvatar() {
  if (profileAvatarSaving.value) return;
  const profileId = String(avatarProfileId.value || '').trim();
  if (!profileId) {
    profileAvatarError.value = 'Select a profile first.';
    return;
  }

  const dialogApi = useInternalLumen()?.dialogOpenFiles;
  if (typeof dialogApi !== 'function') {
    profileAvatarError.value = 'File picker unavailable.';
    return;
  }

  profileAvatarSaving.value = true;
  profileAvatarError.value = '';
  try {
    const pick = await dialogApi({
      title: 'Select profile photo',
      multi: false,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] },
      ],
    });
    if (!pick?.ok) {
      if (pick?.error && pick.error !== 'canceled') {
        const message = mapProfileAvatarError(String(pick.error || ''));
        profileAvatarError.value = message;
        toast.error(message);
      }
      return;
    }

    const sourcePath = Array.isArray(pick.paths) ? String(pick.paths[0] || '').trim() : '';
    if (!sourcePath) return;

    const result = await updateProfileAvatarFromPath(profileId, sourcePath);
    if (!result.ok) {
      const message = mapProfileAvatarError(String(result.error || ''));
      profileAvatarError.value = message;
      toast.error(message);
      return;
    }

    profileAvatarError.value = '';
    toast.success('Profile photo updated');
  } catch {
    profileAvatarError.value = 'Failed to update the profile photo.';
    toast.error('Failed to update the profile photo');
  } finally {
    profileAvatarSaving.value = false;
  }
}

async function resetProfileAvatar() {
  if (profileAvatarSaving.value) return;
  const profileId = String(avatarProfileId.value || '').trim();
  if (!profileId) {
    profileAvatarError.value = 'Select a profile first.';
    return;
  }

  profileAvatarSaving.value = true;
  profileAvatarError.value = '';
  try {
    const result = await clearProfileAvatar(profileId);
    if (!result.ok) {
      const message = mapProfileAvatarError(String(result.error || ''));
      profileAvatarError.value = message;
      toast.error(message);
      return;
    }

    profileAvatarError.value = '';
    toast.success('Profile photo reset');
  } catch {
    profileAvatarError.value = 'Failed to reset the profile photo.';
    toast.error('Failed to reset the profile photo');
  } finally {
    profileAvatarSaving.value = false;
  }
}

watch(
  () => profiles.value,
  (next) => {
    const valid = new Set(Array.isArray(next) ? next.map((p) => p.id) : []);
    selectedProfileIds.value = selectedProfileIds.value.filter((id) => valid.has(id));
    if (!selectedProfileIds.value.length && activeProfileId.value && valid.has(activeProfileId.value)) {
      selectedProfileIds.value = [activeProfileId.value];
    }
    if (!renameProfileId.value || !valid.has(renameProfileId.value)) {
      if (activeProfileId.value && valid.has(activeProfileId.value)) {
        renameProfileId.value = activeProfileId.value;
      } else {
        renameProfileId.value = Array.isArray(next) && next.length ? next[0].id : '';
      }
    }
    syncRenameProfileDraft();

    if (!avatarProfileId.value || !valid.has(avatarProfileId.value)) {
      if (activeProfileId.value && valid.has(activeProfileId.value)) {
        avatarProfileId.value = activeProfileId.value;
      } else {
        avatarProfileId.value = Array.isArray(next) && next.length ? next[0].id : '';
      }
    }
  },
  { immediate: true, deep: true },
);

watch(
  () => currentView.value,
  (v) => {
    if (v !== 'profiles') return;
    if (selectedProfileIds.value.length) return;
    const activeId = activeProfileId.value;
    if (!activeId) return;
    if (profiles.value.some((p) => p.id === activeId)) {
      selectedProfileIds.value = [activeId];
    }
  },
);

watch(
  () => renameProfileId.value,
  () => {
    syncRenameProfileDraft();
  },
);

watch(
  () => avatarProfileId.value,
  () => {
    profileAvatarError.value = '';
  },
);

async function onExportSelectedBackups() {
  if (exportingBackup.value) return;
  const uniqueIds = Array.from(
    new Set(selectedProfileIds.value.map((x) => String(x || '').trim()).filter(Boolean)),
  );
  if (!uniqueIds.length) return;

  exportingBackup.value = true;
  lastBackupExport.value = null;
  try {
    lastBackupExport.value = await exportProfilesBackup(uniqueIds);
  } catch {
    lastBackupExport.value = { ok: false, error: 'backup_failed' };
  } finally {
    exportingBackup.value = false;
  }
}

// Initialize font size on mount
document.documentElement.setAttribute('data-font-size', fontSize.value);
</script>
