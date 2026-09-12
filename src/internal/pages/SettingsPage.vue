<template>
  <!-- ####### lumen://settings SETTINGS ####### -->
  <div class="internal-page flex">
    <!-- ####### lumen://settings SIDEBAR ####### -->
    <InternalSidebar :title="t('Settings')" :icon="Settings" activeKey="settings">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection :title="t('General')">
          <UiSidebarNavItem :active="currentView === 'appearance'" @click="currentView = 'appearance'">
            <Palette :size="18" />
            <span>{{ t('Appearance') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'content'" @click="currentView = 'content'">
            <EyeOff :size="18" />
            <span>{{ t('Content') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'network'" @click="currentView = 'network'">
            <Globe :size="18" />
            <span>{{ t('Network') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'privacy'" @click="currentView = 'privacy'">
            <Shield :size="18" />
            <span>{{ t('Privacy') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'security'" @click="currentView = 'security'">
            <Lock :size="18" />
            <span>{{ t('Security') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'profiles'" @click="currentView = 'profiles'">
            <User :size="18" />
            <span>{{ t('Profiles & backups') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'privatecloud'" @click="currentView = 'privatecloud'">
            <Cloud :size="18" />
            <span>{{ t('Private cloud') }}</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>

        <UiSidebarNavSection :title="t('Advanced')">
          <UiSidebarNavItem :active="currentView === 'troubleshooting'" @click="currentView = 'troubleshooting'">
            <AlertTriangle :size="18" />
            <span>{{ t('Troubleshooting') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'advanced'" @click="currentView = 'advanced'">
            <Code2 :size="18" />
            <span>{{ t('Developer settings') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'about'" @click="currentView = 'about'">
            <Info :size="18" />
            <span>{{ t('About') }}</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>

    </InternalSidebar>

    <!-- ####### lumen://settings MAIN CONTENT ####### -->
    <main class="flex flex-column flex-1 m-0px min-w-0 overflow-hidden py-32px px-40px bg-secondary border-radius-0">
      <UiPageHeader :title="getViewTitle()" :subtitle="getViewDescription()" />

      <!-- ####### lumen://settings APPEARANCE VIEW ####### -->
      <div v-if="currentView === 'appearance'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow :label="t('Theme preference')" :description="t('Choose your preferred color scheme')">
            <div class="flex gap-8px border-radius-10px bg-secondary border-1 p-4px">
              <UiSegmentedButton :active="theme === 'light'" @click="setTheme('light')">
                <Sun :size="18" />
                <span>{{ t('Light') }}</span>
              </UiSegmentedButton>
              <UiSegmentedButton :active="theme === 'dark'" @click="setTheme('dark')">
                <Moon :size="18" />
                <span>{{ t('Dark') }}</span>
              </UiSegmentedButton>
              <UiSegmentedButton :active="theme === 'system'" @click="setTheme('system')">
                <Monitor :size="18" />
                <span>{{ t('System') }}</span>
              </UiSegmentedButton>
            </div>
          </UiOptionRow>
          <UiOptionRow :label="t('Language')" :description="t('The language Lumen\'s own screens are shown in')">
            <select
              class="text-14px color-text-primary cursor-pointer py-8px px-16px bg-secondary border-1 border-radius-8px"
              :value="locale"
              @change="setLocale(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="option in locales" :key="option.code" :value="option.code">{{ option.flag }} {{ t(option.label) }}</option>
            </select>
          </UiOptionRow>
          <UiOptionRow :label="t('Font size')" :description="t('Adjust the default font size')">
            <select class="text-14px color-text-primary cursor-pointer py-8px px-16px bg-secondary border-1 border-radius-8px" v-model="fontSize">
              <option value="small">{{ t('Small') }}</option>
              <option value="medium">{{ t('Medium') }}</option>
              <option value="large">{{ t('Large') }}</option>
            </select>
          </UiOptionRow>
          <UiOptionRow :label="t('Brightness')" :description="t('Adjust screen brightness ({percent}%)', { percent: brightness })" control-class="gap-16px w-full max-w-320px">
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
          <UiOptionRow :label="t('Show sexual content')">
            <UiToggle v-model="showSexualContent" />
          </UiOptionRow>

          <UiOptionRow :label="t('Show violent / gore content')">
            <UiToggle v-model="showViolentContent" />
          </UiOptionRow>

          <UiOptionRow :label="t('Show disturbing imagery')">
            <UiToggle v-model="showDisturbingImagery" />
          </UiOptionRow>

          <UiHintText>
            {{ t('Sensitive content is blurred by default. You can choose what to reveal.') }}
          </UiHintText>
        </div>
      </div>

      <!-- ####### lumen://settings PRIVACY VIEW ####### -->
      <div v-else-if="currentView === 'privacy'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow :label="t('Save browsing history')">
            <template #description>
              {{ t('Keep recent web, domain, IPFS, and IPNS pages for {profile}. Internal pages like New Tab, Wallet, Settings, and Extensions are excluded automatically.', { profile: activeHistoryProfileDisplay }) }}
            </template>
            <UiToggle :model-value="historyEnabled" @update:model-value="onHistoryToggleChange" />
          </UiOptionRow>

          <UiOptionRow :label="t('Saved items')">
            <template #description>
              {{ historyEntries.length === 1
                ? t('1 history item saved for {profile}.', { profile: activeHistoryProfileDisplay })
                : t('{count} history items saved for {profile}.', { count: historyEntries.length, profile: activeHistoryProfileDisplay }) }}
            </template>
            <UiButton variant="secondary" @click="open('lumen://history', { blank: true })" class="disabled-fade-50">
              {{ t('Open history') }}
            </UiButton>
          </UiOptionRow>

          <UiOptionRow :label="t('Clear saved history')" :description="t('Permanently remove the saved browsing history for this profile.')">
            <UiButton variant="secondary" :disabled="!historyEntries.length" @click="clearProfileHistory" class="disabled-fade-50">
              {{ t('Clear history') }}
            </UiButton>
          </UiOptionRow>

          <UiOptionRow :label="t('Sites data')">
            <template #description>
              {{ siteDataRecords.length === 1
                ? t('1 site keeps its own data record on this device.')
                : t('{count} sites keep their own data record on this device.', { count: siteDataRecords.length }) }}
            </template>
            <UiButton variant="secondary" @click="openSiteDataModal" class="disabled-fade-50">
              {{ t('Manage sites data') }}
            </UiButton>
          </UiOptionRow>

          <UiOptionRow :label="t('Site permissions')">
            <template #description>
              {{ sitePermissionRecords.length === 1
                ? t('1 site may ask Lumen to act on your behalf.')
                : t('{count} sites may ask Lumen to act on your behalf.', { count: sitePermissionRecords.length }) }}
            </template>
            <UiButton variant="secondary" @click="openSitePermissionsModal" class="disabled-fade-50">
              {{ t('Manage site permissions') }}
            </UiButton>
          </UiOptionRow>

          <UiHintText>
            {{ t('Turning history off stops new entries from being saved, but does not delete existing ones.') }}
          </UiHintText>
        </div>
      </div>

      <!-- ####### lumen://settings NETWORK VIEW ####### -->
      <div v-else-if="currentView === 'network'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow :label="t('Lumen network')" :description="t('Which Lumen chain the wallet, the network page and every signature use. Other Cosmos chains are always mainnet.')" control-class="flex-justify-end">
            <div class="flex gap-8px border-radius-10px flex-wrap-wrap bg-secondary border-1 p-4px">
              <UiSegmentedButton
                v-for="option in lumenNetworkOptions"
                :key="option.id"
                :active="lumenNetwork === option.id"
                :disabled="lumenNetworkSaving"
                extra-class="flex-justify-center min-w-140px"
                @click="saveLumenNetwork(option.id)"
              >
                <span>{{ option.label }}</span>
              </UiSegmentedButton>
            </div>
          </UiOptionRow>

          <UiHintText>
            {{ t('Chain id:') }}
            <span class="break-all mono">{{ lumenChainIdSummary }}</span>
          </UiHintText>
          <UiHintText>
            {{ t('Switching forgets every known peer and bootstraps again from that network\'s section of peers.txt. Balances and history are re-read from the chain you switch to.') }}
          </UiHintText>

          <UiOptionRow :label="t('Kubo connectivity')" :description="t('Controls how many peer connections the embedded IPFS node tries to keep.')" control-class="flex-justify-end">
            <div class="flex gap-8px border-radius-10px flex-wrap-wrap bg-secondary border-1 p-4px">
              <UiSegmentedButton :active="ipfsConnectivityMode === 'light'" :disabled="networkSettingsSaving" extra-class="flex-justify-center min-w-140px" @click="saveIpfsConnectivityMode('light')">
                <span>{{ t('Light') }}</span>
              </UiSegmentedButton>
              <UiSegmentedButton :active="ipfsConnectivityMode === 'normal'" :disabled="networkSettingsSaving" extra-class="flex-justify-center min-w-140px" @click="saveIpfsConnectivityMode('normal')">
                <span>{{ t('Normal') }}</span>
              </UiSegmentedButton>
              <UiSegmentedButton :active="ipfsConnectivityMode === 'high'" :disabled="networkSettingsSaving" extra-class="flex-justify-center min-w-140px" @click="saveIpfsConnectivityMode('high')">
                <span>{{ t('High connectivity') }}</span>
              </UiSegmentedButton>
            </div>
          </UiOptionRow>

          <UiHintText>
            {{ t('If your network is unstable or your device is resource-constrained, Light is recommended.') }}
          </UiHintText>
          <UiHintText>
            {{ t('Changes are applied automatically by restarting the embedded Kubo daemon.') }}
          </UiHintText>
          <UiHintText>
            {{ t('Current idle connection target:') }}
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
          <UiOptionRow :label="t('Password protection')">
            <template #description>
              {{ securityStatus.enabled
                ? t('Password is required to unlock the app and to sign wallet operations')
                : t('No password set - the app and wallet operations are unprotected') }}
            </template>
            <span
              class="flex-inline-align-center gap-6px border-radius-20px fw-500 inline-flex py-4px px-12px"
              :class="securityStatus.enabled ? 'status-enabled bg-fill-success' : 'bg-fill-tertiary'"
            >
              {{ securityStatus.enabled ? t('Enabled') : t('Disabled') }}
            </span>
          </UiOptionRow>

          <!-- Session Status (only shown when password is enabled) -->
          <UiOptionRow v-if="securityStatus.enabled" :label="t('Session status')" :description="securitySessionStatusText">
            <UiButton variant="secondary" v-if="securitySessionActive"
              @click="lockSecuritySession" class="disabled-fade-50">
              <LockKeyhole :size="16" />
              {{ t('Lock now') }}
            </UiButton>
            <span v-else class="bg-warning-a15 color-warning flex-inline-align-center gap-6px border-radius-20px fw-500 inline-flex py-4px px-12px">
              <LockKeyhole :size="14" />
              {{ t('Locked') }}
            </span>
          </UiOptionRow>

          <UiOptionRow v-if="securityStatus.enabled" :label="t('Password cache duration')" :description="t('Choose how long the password stays cached before the session locks.')">
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
                {{ t(option.label) }}
              </option>
            </select>
          </UiOptionRow>

          <UiOptionRow v-if="!securityStatus.enabled" :label="t('Set a password')" :description="t('Create a password to lock the app and protect wallet signing operations. Your keys will be encrypted with this password.')" />

          <div v-if="!securityStatus.enabled" class="flex flex-column gap-16px border-radius-12px py-16px px-20px bg-fill-tertiary mt-8px">
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">{{ t('New password') }}</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="newPassword"
                :placeholder="t('Enter a password ({min} characters minimum)', { min: MIN_PASSWORD_LENGTH })"
                :disabled="securityLoading"
              />
            </div>
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">{{ t('Confirm password') }}</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="confirmPassword"
                :placeholder="t('Confirm password')"
                :disabled="securityLoading"
                @keyup.enter="setSecurityPassword"
              />
            </div>
            <div v-if="securityError" class="color-error text-14px p-0px pt-8px pb-8px">
              {{ securityError }}
            </div>
            <UiButton variant="primary" @click="setSecurityPassword"
              :disabled="securityLoading || !newPassword || !confirmPassword" class="disabled-fade-50">
              {{ securityLoading ? t('Setting up…') : t('Enable password protection') }}
            </UiButton>
          </div>

          <!-- Change/Remove Password (when password is set) -->
          <UiOptionRow v-if="securityStatus.enabled" :label="t('Change password')" :description="t('Update your security password. You\'ll need to enter your current password.')" />

          <div v-if="securityStatus.enabled" class="flex flex-column gap-16px border-radius-12px py-16px px-20px bg-fill-tertiary mt-8px">
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">{{ t('Current password') }}</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="currentPassword"
                :placeholder="t('Enter current password')"
                :disabled="securityLoading"
              />
            </div>
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">{{ t('New password') }}</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="newPassword"
                :placeholder="t('Enter a new password ({min} characters minimum)', { min: MIN_PASSWORD_LENGTH })"
                :disabled="securityLoading"
              />
            </div>
            <div class="flex flex-column gap-6px">
              <label class="fw-500 color-text-secondary text-13px">{{ t('Confirm new password') }}</label>
              <UiInput
                type="password"
                font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
                v-model="confirmPassword"
                :placeholder="t('Confirm new password')"
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
                {{ securityLoading ? t('Changing…') : t('Change password') }}
              </UiButton>
            </div>
          </div>

          <UiOptionRow v-if="securityStatus.enabled" :label="t('Remove password')" :description="t('Disable password protection. Your keys will be re-encrypted with app-level encryption only.')" class="mt-24px">
            <UiButton variant="danger" @click="showRemovePasswordConfirm = true"
              :disabled="securityLoading" class="disabled-fade-50">
              {{ t('Remove password') }}
            </UiButton>
          </UiOptionRow>

          <!-- Remove Password Confirmation -->
          <div v-if="showRemovePasswordConfirm" class="flex flex-column gap-12px border-radius-12px py-16px px-20px bg-fill-error mt-12px border-1-error-a25">
            <p class="m-0px text-14px color-text-primary">{{ t('Enter your current password to disable protection:') }}</p>
            <UiInput
              type="password"
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-150px"
              v-model="removePasswordInput"
              :placeholder="t('Current password')"
              :disabled="securityLoading"
              @keyup.enter="removeSecurityPassword"
            />
            <div v-if="securityError" class="color-error text-14px p-0px pt-8px pb-8px">
              {{ securityError }}
            </div>
            <div class="flex gap-12px mt-8px">
              <UiButton variant="secondary" @click="cancelRemovePassword"
                :disabled="securityLoading" class="disabled-fade-50">
                {{ t('Cancel') }}
              </UiButton>
              <UiButton variant="danger" @click="removeSecurityPassword"
                :disabled="securityLoading || !removePasswordInput" class="disabled-fade-50">
                {{ securityLoading ? t('Removing…') : t('Confirm remove') }}
              </UiButton>
            </div>
          </div>

          <p class="mt-16px color-text-tertiary text-13px">
            <strong>{{ t('How it works:') }}</strong>
            {{ t('When enabled, the entire app locks and requires your password whenever the session is not active - on launch, and again once the cache duration below expires from inactivity. Wallet signing operations (send tokens, delegate, create domain, etc.) also check for an active session, so an expired one re-locks the app instead of prompting inline just for that operation.') }}
            {{ securitySessionHintText }}
          </p>
        </div>
      </div>

      <!-- ####### lumen://settings PROFILES VIEW ####### -->
      <div v-else-if="currentView === 'profiles'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiOptionRow :label="t('Profiles')" :description="t('Select one or more profiles to export.')" control-class="gap-8px flex-wrap-wrap flex-justify-end">
            <UiButton variant="secondary" type="button"
              @click="selectAllProfiles"
              :disabled="!profiles.length" class="disabled-fade-50">
              {{ t('Select all') }}
            </UiButton>
            <UiButton variant="secondary" type="button"
              @click="clearSelectedProfiles"
              :disabled="!selectedProfileIds.length" class="disabled-fade-50">
              {{ t('Clear') }}
            </UiButton>
            <UiButton variant="secondary" type="button"
              @click="onExportSelectedBackups"
              :disabled="!selectedProfileIds.length || exportingBackup" class="disabled-fade-50">
              {{ t('Export selected ({count})', { count: selectedProfileIds.length }) }}
            </UiButton>
          </UiOptionRow>
          <UiHintText>
            {{ t('Backups include the encrypted keystore, profile metadata and PQC keys (pqc_keys). Export creates one folder per selected profile.') }}
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
                  <span v-if="p.id === activeProfileId" class="border-radius-full color-text-primary text-11px py-0px px-8px bg-primary-a15 border-1-primary-a20">{{ t('Active') }}</span>
                </div>
                <span class="text-12px color-text-tertiary truncate max-w-520px">{{ p.id }}</span>
              </div>
            </label>
          </UiCard>
          <UiHintText v-else>{{ t('No profiles found.') }}</UiHintText>

          <UiOptionRow v-if="profiles.length" :label="t('Display name')" :description="t('Rename a profile without changing its internal profile ID.')" control-class="gap-8px">
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
              :placeholder="t('Enter a display name')"
              :disabled="profileRenameSaving || !renameProfileId"
              @keyup.enter="saveProfileDisplayName"
            />
            <UiButton variant="secondary" type="button"
              :disabled="profileRenameSaving || !renameProfileId"
              @click="resetProfileDisplayNameDraft" class="disabled-fade-50">
              {{ t('Reset') }}
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="profileRenameSaving || !renameProfileId"
              @click="saveProfileDisplayName" class="disabled-fade-50">
              {{ profileRenameSaving ? t('Saving…') : t('Save') }}
            </UiButton>
          </UiOptionRow>
          <UiHintText v-if="profileRenameError">
            {{ profileRenameError }}
          </UiHintText>

          <UiOptionRow v-if="profiles.length" :label="t('Profile photo')" :description="t('Override the generated profile thumbnail with a local image.')" control-class="flex-wrap-wrap gap-8px flex-justify-end">
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
              :title="avatarProfileTarget?.name || avatarProfileTarget?.id || t('Profile')"
            />
            <UiButton variant="secondary" type="button"
              :disabled="profileAvatarSaving || !avatarProfileId"
              @click="chooseProfileAvatar" class="disabled-fade-50">
              {{ profileAvatarSaving ? t('Updating…') : t('Choose image') }}
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="profileAvatarSaving || !avatarProfileTarget?.avatarDataUrl"
              @click="resetProfileAvatar" class="disabled-fade-50">
              {{ t('Reset') }}
            </UiButton>
          </UiOptionRow>
          <UiHintText v-if="profileAvatarError">
            {{ profileAvatarError }}
          </UiHintText>
          <UiHintText v-if="profiles.length">
            {{ t('Lumen crops the selected image to a square thumbnail and stores it with the profile.') }}
          </UiHintText>

        </div>
      </div>

      <!-- ####### lumen://settings DEVELOPER SETTINGS VIEW ####### -->
      <div v-else-if="currentView === 'advanced'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiHintText>
            {{ t('These settings are intended for developers. Most users should not need to change them.') }}
          </UiHintText>

          <div class="flex-align-center gap-8px mt-16px txt-weight-medium color-text-primary mb-8px text-14px">
            <Globe :size="18" />
            <span>{{ t('Network') }}</span>
          </div>

          <UiOptionRow :label="t('Local IPFS gateway')" :description="t('Used for loading IPFS content in the UI')">
            <UiInput
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-320px"
              v-model="localGatewayDraft"
              placeholder="http://127.0.0.1:8080"
            />
          </UiOptionRow>

          <div class="flex-align-center gap-8px mt-16px txt-weight-medium color-text-primary mb-8px text-14px">
            <Database :size="18" />
            <span>{{ t('IPFS') }}</span>
          </div>

          <UiOptionRow :label="t('IPFS API endpoint')" :description="t('Used by the Electron backend (Kubo API)')">
            <UiInput
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-320px"
              v-model="ipfsApiDraft"
              placeholder="http://127.0.0.1:5001"
            />
          </UiOptionRow>

          <UiOptionRow :label="t('Max upload size (local drive)')" :description="t('Maximum size per local upload before it is rejected. Default 10 GB.')" control-class="gap-8px">
            <UiInput
              type="number"
              min="1"
              step="1"
              font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-96px"
              v-model="localDriveMaxUploadSizeDraft"
              :placeholder="String(DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB)"
            />
            <span class="color-text-secondary text-13px">{{ t('GB') }}</span>
          </UiOptionRow>

          <UiHintText v-if="devSettingsError">
            {{ devSettingsError }}
          </UiHintText>

          <div class="flex mt-12px gap-8px">
            <UiButton variant="secondary" type="button"
              :disabled="devSettingsSaving"
              @click="resetDevSettings" class="disabled-fade-50">
              {{ t('Reset') }}
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="devSettingsSaving"
              @click="saveDevSettings" class="disabled-fade-50">
              {{ devSettingsSaving ? t('Saving…') : t('Save') }}
            </UiButton>
          </div>

          <UiHintText>
            {{ t('Note: the local IPFS daemon must actually be configured to use these ports/addresses. Changes apply automatically here, no restart needed.') }}
          </UiHintText>

          <div class="flex-align-center gap-8px mt-16px txt-weight-medium color-text-primary mb-8px text-14px">
            <FolderOpen :size="18" />
            <span>{{ t('Lumen data folder') }}</span>
          </div>

          <UiOptionRow :label="t('Custom data folder target')" :description="t('Override the default folder used by the Lumen binary for IPFS, profiles, logs and app metadata.')" control-class="flex-justify-end min-w-420px">
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
                <span>{{ t('Browse…') }}</span>
              </UiButton>
            </div>
          </UiOptionRow>

          <UiHintText>
            {{ t('Next launch target:') }} <span class="break-all mono">{{ effectiveUserDataPath || defaultUserDataPath || t('Not available') }}</span>
          </UiHintText>
          <UiHintText v-if="lumenDataFolderError">
            {{ lumenDataFolderError }}
          </UiHintText>

          <div class="flex mt-12px gap-8px">
            <UiButton variant="secondary" type="button"
              :disabled="lumenDataFolderBusy"
              @click="revertLumenDataFolderDraft" class="disabled-fade-50">
              {{ t('Revert') }}
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="lumenDataFolderBusy"
              @click="useDefaultLumenDataFolderDraft" class="disabled-fade-50">
              {{ t('Use default') }}
            </UiButton>
            <UiButton variant="secondary" type="button"
              :disabled="lumenDataFolderBusy"
              @click="saveLumenDataFolder" class="disabled-fade-50">
              {{ lumenDataFolderSaving ? t('Applying…') : t('Apply') }}
            </UiButton>
          </div>

          <UiHintText>
            {{ t('Restart Lumen after changing this target. Existing files are not moved automatically.') }}
          </UiHintText>
          <UiHintText v-if="bootstrapRestartRequired">
            {{ t('Restart required: the running app is still using {path}.', { path: activeUserDataPath }) }}
          </UiHintText>
        </div>
      </div>

      <!-- ####### lumen://settings TROUBLESHOOTING VIEW ####### -->
      <div v-else-if="currentView === 'troubleshooting'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <UiHintText>
            {{ t('Generate a safe support bundle for remote troubleshooting. Passwords, password hashes, API keys and private keys are excluded.') }}
          </UiHintText>

          <UiOptionRow :label="t('Copy debug report')" :description="t('Copy app info, sanitized settings, service status, file inventory and recent log excerpts to the clipboard.')">
            <UiButton variant="secondary" type="button"
              @click="copyDebugReport"
              :disabled="troubleshootingBusy" class="disabled-fade-50">
              <Copy :size="16" />
              <span>{{ troubleshootingAction === 'copy' ? t('Copying…') : t('Copy debug report') }}</span>
            </UiButton>
          </UiOptionRow>

          <UiOptionRow :label="t('Open logs folder')" :description="t('Open the logs folder containing the live Electron log, the latest debug report and safe copies of known support logs.')">
            <UiButton variant="secondary" type="button"
              @click="openLogsFolderAction"
              :disabled="troubleshootingBusy" class="disabled-fade-50">
              <FolderOpen :size="16" />
              <span>{{ troubleshootingAction === 'open' ? t('Opening…') : t('Open logs folder') }}</span>
            </UiButton>
          </UiOptionRow>

          <UiHintText>
            {{ t('The logs folder is regenerated on demand so people can inspect the current support snapshot and share relevant log excerpts.') }}
          </UiHintText>
          <p v-if="troubleshootingDir" class="border-radius-12px color-text-secondary mt-4px py-12px px-16px bg-card border-default text-12px break-all">
            {{ t('Logs folder: {path}', { path: troubleshootingDir }) }}
          </p>
          <p v-if="troubleshootingReportPath" class="border-radius-12px color-text-secondary mt-4px py-12px px-16px bg-card border-default text-12px break-all">
            {{ t('Debug report: {path}', { path: troubleshootingReportPath }) }}
          </p>
        </div>
      </div>

      <!-- ####### lumen://settings PRIVATE CLOUD VIEW ####### -->
      <div v-else-if="currentView === 'privatecloud'" class="flex-1 overflow-y-auto">
        <div class="pt-2px flex flex-column gap-8px">
          <!-- Main Enable Toggle -->
          <UiOptionRow :class="{ 'border-color-success bg-gradient-success-soft': privateCloudEnabled }" class="border-width-2px" :description="t('Use your own private IPFS gateways for content delivery')">
            <template #label>
              <Cloud :size="18" class="inline-block align-middle mr-8px" />
              {{ t('Enable private cloud') }}
            </template>
            <UiToggle v-model="privateCloudEnabled" />
          </UiOptionRow>

          <!-- Settings when enabled -->
          <template v-if="privateCloudEnabled">
            <div class="mt-16px">
              <h3 class="txt-weight-light color-text-primary text-15px m-0px mb-12px">{{ t('Gateway preferences') }}</h3>

              <UiOptionRow :label="t('Prefer private gateways')" :description="t('Try private gateways first before DAO gateways')">
                <UiToggle v-model="preferPrivateGateways" />
              </UiOptionRow>

              <UiOptionRow :label="t('Fallback to DAO Gateways')" :description="t('Use DAO gateways if private gateways fail')">
                <UiToggle v-model="fallbackToDAO" />
              </UiOptionRow>
            </div>

            <div class="mt-16px">
              <div class="flex-align-center-justify-space-between mb-8px">
                <h3 class="txt-weight-light color-text-primary text-15px m-0px mb-12px">{{ t('Gateway IDs') }}</h3>
                <span class="flex-inline-align-justify-center text-12px txt-weight-light color-primary border-radius-10px h-24px py-0px px-8px bg-primary-a15 min-w-24px">{{ gatewayIds.length }}</span>
              </div>
              <p class="text-14px color-text-secondary m-0px mb-16px">{{ t('Add gateway IDs to use for private content delivery') }}</p>

              <div class="border-radius-12px p-16px bg-secondary border-1">
                <div v-if="gatewayIds.length > 0" class="flex flex-column gap-8px mb-16px">
                  <div v-for="(id, index) in gatewayIds" :key="index" class="flex-align-center-justify-space-between py-12px px-16px bg-card border-1 border-radius-8px transition-all-02 hover-border-primary">
                    <span class="mono color-text-primary text-14px">{{ id }}</span>
                    <UiButton variant="icon" @click="removeGatewayId(index)">
                      <X :size="16" />
                    </UiButton>
                  </div>
                </div>
                <UiEmptyState v-else :title="t('No gateway IDs configured')" :description="t('Add your first gateway ID below')">
                  <Server :size="40" class="opacity-40" />
                </UiEmptyState>

                <div class="flex gap-12px">
                  <UiInput
                    v-model="newGatewayId"
                    font-size-class="text-14px" padding-class="py-8px px-16px" bg-class="bg-secondary" :focus-ring="false" class="w-320px flex-1"
                    :placeholder="t('Enter gateway ID (e.g., gateway-123)')"
                    @keyup.enter="addGatewayId"
                  />
                  <UiButton variant="secondary" @click="addGatewayId" :disabled="!newGatewayId.trim()" class="disabled-fade-50">
                    <Plus :size="16" />
                    {{ t('Add') }}
                  </UiButton>
                </div>
              </div>
            </div>

            <div class="mt-16px">
              <h3 class="txt-weight-light color-text-primary text-15px m-0px mb-12px">{{ t('Advanced settings') }}</h3>

              <UiOptionRow :label="t('Request timeout')" :description="t('Maximum time to wait for a gateway response ({seconds}s)', { seconds: gatewayTimeout / 1000 })">
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

              <UiOptionRow :label="t('Max retries')" :description="t('Maximum retry attempts per gateway')">
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

            <div class="flex gap-16px border-radius-12px mt-16px py-16px px-20px border-15-primary-a20">
              <Info :size="20" class="flex-shrink-0 color-primary" />
              <div>
                <strong class="block text-14px color-text-primary mb-4px">{{ t('Need to create a gateway?') }}</strong>
                <p class="text-14px color-text-secondary m-0px line-height-15">
                  {{ t('Set up your private gateway server from the My Gateways page.') }}
                  <a class="color-primary fw-500 hover-underline" href="lumen://my-gateways" @click.prevent="navigate?.('lumen://my-gateways', { push: true })">{{ t('Open My Gateways') }}</a>
                </p>
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
          <h2 class="text-24px txt-weight-medium color-text-primary m-0px mb-8px">{{ t('Lumen Browser') }}</h2>
          <p class="text-14px color-text-secondary m-0px mb-16px">{{ t('Version {version}', { version: appVersion }) }}</p>
          <p class="text-14px color-text-secondary m-0px mb-24px">{{ t('The Decentralized Internet Stack') }}</p>
          <div class="flex gap-16px">
            <a
              href="https://lumen-browser.com/"
              class="color-primary fw-500 text-14px hover-underline"
              @click.prevent="open('https://lumen-browser.com/', { blank: true })"
              >{{ t('Website') }}</a
            >
            <a
              href="https://github.com/network-lumen"
              class="color-primary fw-500 text-14px hover-underline"
              @click.prevent="open('https://github.com/network-lumen', { blank: true })"
              >{{ t('GitHub') }}</a
            >
            <a
              href="lumen://help"
              class="color-primary fw-500 text-14px hover-underline"
              @click.prevent="open('lumen://help', { blank: true })"
              >{{ t('Documentation') }}</a
            >
          </div>
        </div>
      </div>
    </main>

    <SitesDataDialog
      :model-value="showSiteDataModal"
      :records="siteDataRecords"
      :removing-id="removingSiteDataId"
      :loading="siteDataLoading"
      @close="showSiteDataModal = false"
      @remove="removeSiteDataRecord"
    />

    <SitePermissionsDialog
      :model-value="showSitePermissionsModal"
      :records="sitePermissionRecords"
      :revoking-key="revokingSitePermissionKey"
      :loading="sitePermissionsLoading"
      @close="showSitePermissionsModal = false"
      @revoke="revokeSitePermissions"
      @set-action="setSitePermissionAction"
    />
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
import SitesDataDialog from '../../dialogs/SitesDataDialog.vue';
import SitePermissionsDialog from '../../dialogs/SitePermissionsDialog.vue';
import { siteDataRowId, siteDataSiteLabel } from '../services/siteData';
import { sitePermissionSiteLabel } from '../services/sitePermissions';
import type { SiteDataRecord } from '../../types/drivePage';
import type { SitePermissionAction, SitePermissionRecord } from '../../types/sitePermissions';
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
import { t, useI18n } from '../../stores/i18nStore';
import { STORAGE_KEYS, readString, writeString } from '../services/storage';
import { clamp, errorMessage } from '../services/coerce';
import { normalizeHttpBaseUrl } from '../services/navigationUrl';
import { listLumenNetworks, setLumenNetwork } from '../services/lumenNetwork';
import type { LumenNetworkIdentity } from '../../types/lumenNetwork';
import { useToast } from '../../composables/useToast';
import ProfileAvatar from '../../components/ProfileAvatar.vue';
import { useHistory } from '../../stores/historyStore';
import {
  profilesState,
  activeProfileId,
  exportProfilesBackup,
  updateProfileName,
  updateProfileAvatarFromPath,
  clearProfileAvatar,
} from '../../stores/profilesStore';
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
import { MIN_PASSWORD_LENGTH, isPasswordLongEnough } from '../services/passwordPolicy';
const toast = useToast();
const appVersion = String((pkg as any)?.version || '0.0.0');

const { open, navigate } = useTabNavigation();

function onHistoryToggleChange(enabled: boolean) {
  setHistoryEnabled(enabled);
  toast.success(enabled ? t('Browsing history enabled') : t('Browsing history disabled'));
}

function clearProfileHistory() {
  if (!historyEntries.value.length) return;
  const confirmed = window.confirm(t('Clear the saved history for {profile}?', { profile: activeHistoryProfileDisplay.value }));
  if (!confirmed) return;
  clearHistory();
  toast.success(t('Browsing history cleared'));
}

// Sites data - the record a site keeps for itself, one IPNS key per site and
// profile. It lives under Privacy because that is what it is to the user:
// per-site state a browser holds on their behalf, next to history.
const siteDataRecords = ref<SiteDataRecord[]>([]);
const siteDataLoading = ref(false);
const showSiteDataModal = ref(false);
const removingSiteDataId = ref('');

async function loadSiteDataRecords() {
  const api = useInternalLumen()?.siteData;
  if (!api?.list) return;
  siteDataLoading.value = true;
  try {
    const res = await api.list();
    siteDataRecords.value = res?.ok && Array.isArray(res.records) ? res.records : [];
  } catch {
    siteDataRecords.value = [];
  } finally {
    siteDataLoading.value = false;
  }
}

function openSiteDataModal() {
  showSiteDataModal.value = true;
  void loadSiteDataRecords();
}

async function removeSiteDataRecord(record: SiteDataRecord) {
  const api = useInternalLumen()?.siteData;
  if (!api?.delete) return;
  const label = siteDataSiteLabel(record);
  const confirmed = window.confirm(t('Delete this site\'s data ({label})?\n\nThe site will see you as a brand new visitor next time.', { label }));
  if (!confirmed) return;
  const rowId = siteDataRowId(record);
  removingSiteDataId.value = rowId;
  try {
    await api.delete(record?.siteKey, record?.profileId);
    siteDataRecords.value = siteDataRecords.value.filter((r) => siteDataRowId(r) !== rowId);
  } finally {
    removingSiteDataId.value = '';
  }
}

// Site permissions - what each site may ask Lumen to do. Sits with sites data
// because it answers the other half of the same question: what a site holds
// on this device, and what it is allowed to do with it.
const sitePermissionRecords = ref<SitePermissionRecord[]>([]);
const sitePermissionsLoading = ref(false);
const showSitePermissionsModal = ref(false);
const revokingSitePermissionKey = ref('');

async function loadSitePermissions() {
  const api = useInternalLumen()?.sitePermissions;
  if (!api?.list) return;
  sitePermissionsLoading.value = true;
  try {
    const res = await api.list();
    sitePermissionRecords.value = res?.ok && Array.isArray(res.sites) ? res.sites : [];
  } catch {
    sitePermissionRecords.value = [];
  } finally {
    sitePermissionsLoading.value = false;
  }
}

function openSitePermissionsModal() {
  showSitePermissionsModal.value = true;
  void loadSitePermissions();
}

async function setSitePermissionAction(
  record: SitePermissionRecord,
  action: SitePermissionAction,
  allowed: boolean,
) {
  const api = useInternalLumen()?.sitePermissions;
  if (!api?.setAction) return;
  await api.setAction(record.siteKey, action.kind, allowed);
  await loadSitePermissions();
}

async function revokeSitePermissions(record: SitePermissionRecord) {
  const api = useInternalLumen()?.sitePermissions;
  if (!api?.revokeSite) return;
  const label = sitePermissionSiteLabel(record);
  const confirmed = window.confirm(t('Revoke every right granted to {label}?\n\nIt will have to ask again the next time it wants to act on your behalf.', { label }));
  if (!confirmed) return;
  revokingSitePermissionKey.value = record.siteKey;
  try {
    await api.revokeSite(record.siteKey);
    await loadSitePermissions();
  } finally {
    revokingSitePermissionKey.value = '';
  }
}

const currentView = ref<'appearance' | 'content' | 'network' | 'privacy' | 'security' | 'profiles' | 'advanced' | 'troubleshooting' | 'privatecloud' | 'about'>('appearance');
const { theme, setTheme, initTheme } = useTheme();
const { locale, locales, setLocale } = useI18n();
const fontSize = ref(readString(STORAGE_KEYS.fontSize) || 'medium');
const brightness = ref(parseInt(readString(STORAGE_KEYS.brightness) || '100'));
const { historyEntries, historyEnabled, clearHistory, setHistoryEnabled } = useHistory();
const exportingBackup = ref(false);
const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const activeProfileDisplay = computed(() => activeProfile.value?.name || activeProfile.value?.id || '');
const activeHistoryProfileDisplay = computed(() => activeProfileDisplay.value || t('this profile'));
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
  if (!res.ok) return t('Failed to export the backup.');
  const results = Array.isArray(res.results) ? res.results : [];
  const okCount = results.filter((r) => r && r.ok).length;
  const total = results.length || 0;
  const base = res.baseDir ? ` to ${res.baseDir}` : '';
  if (total <= 1) return t('Exported {count}{suffix}.', { count: okCount ? t('1 profile') : t('0 profiles'), suffix: base });
  if (!okCount) return t('Export failed for {count} profiles{suffix}.', { count: total, suffix: base });
  if (okCount === total) return t('Exported {count} profiles{suffix}.', { count: okCount, suffix: base });
  return t('Exported {count}/{total} profiles{suffix}.', { count: okCount, total, suffix: base });
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
// Seeded from the loaded settings, like the content toggles below it. It used
// to start on a literal 'normal' and wait for the watcher, which only fires
// when the settings *change* - and they are loaded once at app start, long
// before this page mounts. So a saved "High connectivity" came back as Normal
// on every restart, and looked like it had not been saved at all.
const ipfsConnectivityMode = ref<IpfsConnectivityMode>(
  appSettingsState.value.ipfsConnectivityMode || 'normal',
);
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

// Which Lumen the app talks to. The list comes from the main process rather
// than from a literal here, so adding a network is a change to
// electron/chain/networks.cjs and nothing else.
const lumenNetwork = ref<string>(appSettingsState.value.lumenNetwork || 'mainnet');
const lumenNetworkOptions = ref<LumenNetworkIdentity[]>([]);
const lumenNetworkSaving = ref(false);

const lumenChainIdSummary = computed(() => {
  const active = lumenNetworkOptions.value.find((option) => option.id === lumenNetwork.value);
  return active?.chainId || t('Unknown');
});

async function loadLumenNetworkOptions() {
  lumenNetworkOptions.value = await listLumenNetworks();
}

async function saveLumenNetwork(nextId: string) {
  if (lumenNetworkSaving.value) return;
  if (lumenNetwork.value === nextId) return;

  const previous = lumenNetwork.value;
  lumenNetworkSaving.value = true;
  networkSettingsError.value = '';
  lumenNetwork.value = nextId;

  try {
    const res = await setLumenNetwork(nextId);
    if (!res.ok) {
      lumenNetwork.value = previous;
      networkSettingsError.value = String(res.error || t('Failed to switch network.'));
      toast.error(networkSettingsError.value);
      return;
    }
    // The pages holding balances read them from the other chain, and nothing
    // short of a reload gets every one of them to ask again.
    toast.success(t('Network switched. Reload open pages to re-read them from the new chain.'));
  } finally {
    lumenNetworkSaving.value = false;
  }
}

watch(
  () => appSettingsState.value,
  (next) => {
    ipfsConnectivityMode.value = next.ipfsConnectivityMode || 'normal';
    lumenNetwork.value = next.lumenNetwork || 'mainnet';
    showSexualContent.value = !!next.showSexualContent;
    showViolentContent.value = !!next.showViolentContent;
    showDisturbingImagery.value = !!next.showDisturbingImagery;
  },
  { deep: true, immediate: true },
);

const networkModeSummary = computed(() => {
  switch (ipfsConnectivityMode.value) {
    case 'light':
      return t('Light: trims idle peers back to 12 when it reaches 24.');
    case 'high':
      return t('High connectivity: trims idle peers back to 64 when it reaches 192.');
    case 'normal':
    default:
      return t('Normal: trims idle peers back to 32 when it reaches 96.');
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
      networkSettingsError.value = String(res.error || t('Failed to update Kubo connectivity mode.'));
      toast.error(networkSettingsError.value);
      return;
    }
    toast.success(t('Kubo connectivity mode updated'));
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
    return t('Session locked - password required to unlock the app');
  }
  return t('Session unlocked - password cached {duration}', {
    duration: getSecuritySessionTimeoutCacheText(appSettingsState.value.securitySessionTimeoutMs)
  });
});
const securitySessionHintText = computed(() =>
  t('After entering the password, it stays cached {duration} for convenience.', {
    duration: getSecuritySessionTimeoutHelpText(appSettingsState.value.securitySessionTimeoutMs)
  })
);

watch(
  () => appSettingsState.value.securitySessionTimeoutMs,
  (next) => {
    securitySessionTimeoutValue.value = stringifySecuritySessionTimeoutMs(next);
  },
  { immediate: true },
);

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
      toast.error(String(res.error || t('Failed to update password cache duration')));
      return;
    }
    toast.success(t('Password cache duration updated'));
  } finally {
    securitySessionTimeoutSaving.value = false;
  }
}

async function setSecurityPassword() {
  securityError.value = '';
  securitySuccess.value = '';
  
  if (!isPasswordLongEnough(newPassword.value)) {
    securityError.value = t('Password must be at least {min} characters.', { min: MIN_PASSWORD_LENGTH });
    return;
  }
  
  if (newPassword.value !== confirmPassword.value) {
    securityError.value = t('Passwords do not match.');
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
      securitySuccess.value = t('Password protection enabled.');
      toast.success(t('Password protection enabled.'));
    } else {
      securityError.value = result?.error || t('Failed to set password.');
      toast.error(result?.error || t('Failed to set password.'));
    }
  } catch (e) {
    securityError.value = errorMessage(e, t('Failed to set password.'));
    toast.error(errorMessage(e, t('Failed to set password.')));
  } finally {
    securityLoading.value = false;
  }
}

async function changeSecurityPassword() {
  securityError.value = '';
  securitySuccess.value = '';
  
  if (!isPasswordLongEnough(newPassword.value)) {
    securityError.value = t('Password must be at least {min} characters.', { min: MIN_PASSWORD_LENGTH });
    return;
  }
  
  if (newPassword.value !== confirmPassword.value) {
    securityError.value = t('Passwords do not match.');
    return;
  }
  
  securityLoading.value = true;
  try {
    // Verify current password first
    const verify = await useInternalLumen()?.security.verifyPassword({ password: currentPassword.value });
    if (!verify?.ok) {
      securityError.value = t('Current password is incorrect.');
      securityLoading.value = false;
      return;
    }
    
    // Remove old and set new
    const removeResult = await useInternalLumen()?.security.removePassword({ password: currentPassword.value });
    if (!removeResult?.ok) {
      securityError.value = removeResult?.error || t('Failed to change password.');
      securityLoading.value = false;
      return;
    }
    
    const setResult = await useInternalLumen()?.security.setPassword({ password: newPassword.value });
    if (setResult?.ok) {
      currentPassword.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
      securitySuccess.value = t('Password changed successfully.');
      toast.success(t('Password changed successfully.'));
    } else {
      securityError.value = setResult?.error || t('Failed to set new password.');
      toast.error(setResult?.error || t('Failed to set new password.'));
    }
  } catch (e) {
    securityError.value = errorMessage(e, t('Failed to change password.'));
    toast.error(errorMessage(e, t('Failed to change password.')));
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
      securitySuccess.value = t('Password protection removed.');
      toast.success(t('Password protection removed.'));
    } else {
      securityError.value = result?.error || t('Failed to remove password.');
      toast.error(result?.error || t('Failed to remove password.'));
    }
  } catch (e) {
    securityError.value = errorMessage(e, t('Failed to remove password.'));
    toast.error(errorMessage(e, t('Failed to remove password.')));
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
  // Unconditional: the network view can be the one the page opens on.
  void loadLumenNetworkOptions();
});

// Reload security status when switching to security view
watch(
  () => currentView.value,
  (v) => {
    if (v === 'network') {
      networkSettingsError.value = '';
      void loadLumenNetworkOptions();
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
    if (v === 'privacy') {
      void loadSiteDataRecords();
      void loadSitePermissions();
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
    lumenDataFolderError.value = t('Lumen data folder controls are not available.');
    return;
  }
  lumenDataFolderLoading.value = true;
  lumenDataFolderError.value = '';
  try {
    const result = await api.bootstrapPathGetState();
    if (!result?.ok || !result?.state) {
      lumenDataFolderError.value = String(result?.error || t('Failed to load Lumen data folder.'));
      return;
    }
    applyBootstrapPathState(result.state);
  } catch (e) {
    lumenDataFolderError.value = errorMessage(e, t('Failed to load Lumen data folder.'));
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
    devSettingsError.value = t('Invalid local IPFS gateway URL.');
    return;
  }
  if (!ipfsApiBase) {
    devSettingsError.value = t('Invalid IPFS API URL.');
    return;
  }
  if (localDriveMaxUploadSizeGb == null) {
    devSettingsError.value = t('Invalid max upload size. Enter a whole number of GB.');
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
      devSettingsError.value = String(res.error || t('Failed to save settings.'));
      return;
    }
    localGatewayDraft.value = String(appSettingsState.value.localGatewayBase || '').trim();
    ipfsApiDraft.value = String(appSettingsState.value.ipfsApiBase || '').trim();
    localDriveMaxUploadSizeDraft.value = String(
      appSettingsState.value.localDriveMaxUploadSizeGb || DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
    );
    toast.success(t('Developer settings saved'));
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
    lumenDataFolderError.value = t('Folder picker not available.');
    return;
  }
  lumenDataFolderError.value = '';
  try {
    const result = await api.dialogOpenFolder({ title: t('Select Lumen data folder') });
    if (!result?.ok || !Array.isArray(result.paths) || !result.paths.length) {
      if (result?.error && result.error !== 'canceled') {
        lumenDataFolderError.value = String(result.error);
      }
      return;
    }
    lumenDataFolderDraft.value = String(result.paths[0] || '').trim();
  } catch (e) {
    lumenDataFolderError.value = errorMessage(e, t('Failed to open folder picker.'));
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
    lumenDataFolderError.value = t('Lumen data folder controls are not available.');
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
      lumenDataFolderError.value = String(result?.error || t('Failed to save Lumen data folder.'));
      return;
    }
    applyBootstrapPathState(result.state);
    if (result.state.restartRequired) {
      toast.success(t('Lumen data folder updated. Restart Lumen to apply the new location.'));
    } else {
      toast.success(t('Lumen data folder updated.'));
    }
  } catch (e) {
    lumenDataFolderError.value = errorMessage(e, t('Failed to save Lumen data folder.'));
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
    toast.error(t('Troubleshooting tools are not available.'));
    return;
  }

  troubleshootingAction.value = 'copy';
  try {
    const result = await api.copyDebugReport();
    applyTroubleshootingPaths(result);
    if (result?.ok) {
      toast.success(t('Debug report copied to clipboard'));
      return;
    }
    toast.error(result?.error || t('Failed to copy debug report'));
  } catch (e) {
    toast.error(errorMessage(e, t('Failed to copy debug report')));
  } finally {
    troubleshootingAction.value = '';
  }
}

async function openLogsFolderAction() {
  if (troubleshootingBusy.value) return;
  const api = useInternalLumen()?.troubleshooting;
  if (!api || typeof api.openLogsFolder !== 'function') {
    toast.error(t('Troubleshooting tools are not available.'));
    return;
  }

  troubleshootingAction.value = 'open';
  try {
    const result = await api.openLogsFolder();
    applyTroubleshootingPaths(result);
    if (result?.ok) {
      toast.success(t('Logs folder opened'));
      return;
    }
    toast.error(result?.error || t('Failed to open logs folder'));
  } catch (e) {
    toast.error(errorMessage(e, t('Failed to open logs folder')));
  } finally {
    troubleshootingAction.value = '';
  }
}

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
      toast.error(result.error || t('Failed to save private cloud settings'));
    }
  } catch (e) {
    console.error('Failed to save private cloud config:', e);
    toast.error(t('Failed to save private cloud settings'));
  }
}

function addGatewayId() {
  const id = newGatewayId.value.trim();
  if (!id) return;
  if (gatewayIds.value.includes(id)) {
    toast.error(t('Gateway ID already added'));
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
    appearance: t('Appearance'),
    content: t('Content settings'),
    network: t('Network'),
    privacy: t('Privacy & security'),
    security: t('Security'),
    profiles: t('Profiles & backups'),
    privatecloud: t('Private cloud'),
    advanced: t('Developer settings'),
    troubleshooting: t('Troubleshooting'),
    about: t('About Lumen')
  };
  return titles[currentView.value] || 'Settings';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    appearance: t('Customize the look and feel'),
    content: t('Control sensitive content visibility'),
    network: t('Tune how aggressively the embedded Kubo node keeps peer connections'),
    privacy: t('Manage your privacy settings'),
    security: t('Password protection for wallet operations'),
    profiles: t('Backup or restore profiles and PQC keys'),
    privatecloud: t('Configure your private IPFS gateways'),
    advanced: t('Advanced network and storage configuration'),
    troubleshooting: t('Collect support info and open safe logs'),
    about: t('Information about Lumen')
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
      return t('Select or create a profile first.');
    case 'missing_avatar_path':
      return t('Select an image file first.');
    case 'avatar_file_not_found':
      return t('Selected image could not be found.');
    case 'invalid_avatar_image':
      return t('Selected file is not a supported image.');
    case 'unsupported_environment':
      return t('File picker not available.');
    case 'avatar_processing_failed':
      return t('Failed to generate the profile thumbnail.');
    case 'profile_not_found':
      return t('No profile found');
    case 'profiles_api_unavailable':
      return t('Profile photo editing is not available in this build.');
    default:
      return t('Failed to update the profile photo.');
  }
}

async function saveProfileDisplayName() {
  if (profileRenameSaving.value) return;
  const profileId = String(renameProfileId.value || '').trim();
  const nextName = String(renameProfileDraft.value || '').trim();
  if (!profileId) {
    profileRenameError.value = t('Select or create a profile first.');
    return;
  }
  if (!nextName) {
    profileRenameError.value = t('Display name is required.');
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
      profileRenameError.value = String(result.error || t('Failed to update display name.'));
      return;
    }
    syncRenameProfileDraft();
    toast.success(t('Profile display name updated'));
  } finally {
    profileRenameSaving.value = false;
  }
}

async function chooseProfileAvatar() {
  if (profileAvatarSaving.value) return;
  const profileId = String(avatarProfileId.value || '').trim();
  if (!profileId) {
    profileAvatarError.value = t('Select or create a profile first.');
    return;
  }

  const dialogApi = useInternalLumen()?.dialogOpenFiles;
  if (typeof dialogApi !== 'function') {
    profileAvatarError.value = t('File picker not available.');
    return;
  }

  profileAvatarSaving.value = true;
  profileAvatarError.value = '';
  try {
    const pick = await dialogApi({
      title: t('Select profile photo'),
      multi: false,
      filters: [
        { name: t('Images'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] },
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
    toast.success(t('Profile photo updated'));
  } catch {
    profileAvatarError.value = t('Failed to update the profile photo.');
    toast.error(t('Failed to update the profile photo.'));
  } finally {
    profileAvatarSaving.value = false;
  }
}

async function resetProfileAvatar() {
  if (profileAvatarSaving.value) return;
  const profileId = String(avatarProfileId.value || '').trim();
  if (!profileId) {
    profileAvatarError.value = t('Select or create a profile first.');
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
    toast.success(t('Profile photo reset'));
  } catch {
    profileAvatarError.value = t('Failed to reset the profile photo.');
    toast.error(t('Failed to reset the profile photo.'));
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