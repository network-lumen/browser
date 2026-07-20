<template>
  <div class="settingspage-settings-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Settings" :icon="Settings" activeKey="settings">
      <nav class="lsb-nav flex flex-column gap-75">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">General</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'appearance' }"
            @click="currentView = 'appearance'"
          >
            <Palette :size="18" />
            <span>Appearance</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'content' }"
            @click="currentView = 'content'"
          >
            <EyeOff :size="18" />
            <span>Content</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'network' }"
            @click="currentView = 'network'"
          >
            <Globe :size="18" />
            <span>Network</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'privacy' }"
            @click="currentView = 'privacy'"
          >
            <Shield :size="18" />
            <span>Privacy</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'security' }"
            @click="currentView = 'security'"
          >
            <Lock :size="18" />
            <span>Security</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'profiles' }"
            @click="currentView = 'profiles'"
          >
            <User :size="18" />
            <span>Profiles &amp; backups</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'privatecloud' }"
            @click="currentView = 'privatecloud'"
          >
            <Cloud :size="18" />
            <span>Private Cloud</span>
          </button>
        </div>

        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Advanced</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'troubleshooting' }"
            @click="currentView = 'troubleshooting'"
          >
            <AlertTriangle :size="18" />
            <span>Troubleshooting</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'advanced' }"
            @click="currentView = 'advanced'"
          >
            <Code2 :size="18" />
            <span>Developer settings</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'about' }"
            @click="currentView = 'about'"
          >
            <Info :size="18" />
            <span>About</span>
          </button>
        </div>
      </nav>

    </InternalSidebar>

    <!-- Main Content -->
    <main class="settingspage-main-content flex flex-column flex-1 margin-0 min-w-0 overflow-hidden padding-200-250 bg-secondary border-radius-0">
      <!-- Header -->
      <header class="settingspage-content-header margin-bottom-200">
        <div>
          <h1 class="settingspage-content-header-h1 fs-175rem txt-weight-medium color-text-primary margin-0">{{ getViewTitle() }}</h1>
          <p class="settingspage-content-header-p fs-14px color-text-secondary margin-0 margin-top-25">{{ getViewDescription() }}</p>
        </div>
      </header>

      <!-- Appearance View -->
      <div v-if="currentView === 'appearance'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Theme Preference</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Choose your preferred color scheme</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <div class="settingspage-theme-selector flex gap-50 border-radius-10px bg-secondary border-1 padding-25">
                <button 
                  class="settingspage-theme-option flex-align-center gap-50 fw-500 color-text-secondary cursor-pointer padding-50-100 bg-transparent border-none border-radius-8px fs-14px transition-all-02 hover-color-text-primary"
                  :class="{ 'active bg-card color-primary': theme === 'light' }"
                  @click="setTheme('light')"
                >
                  <Sun :size="18" />
                  <span>Light</span>
                </button>
                <button 
                  class="settingspage-theme-option flex-align-center gap-50 fw-500 color-text-secondary cursor-pointer padding-50-100 bg-transparent border-none border-radius-8px fs-14px transition-all-02 hover-color-text-primary"
                  :class="{ 'active bg-card color-primary': theme === 'dark' }"
                  @click="setTheme('dark')"
                >
                  <Moon :size="18" />
                  <span>Dark</span>
                </button>
                <button 
                  class="settingspage-theme-option flex-align-center gap-50 fw-500 color-text-secondary cursor-pointer padding-50-100 bg-transparent border-none border-radius-8px fs-14px transition-all-02 hover-color-text-primary"
                  :class="{ 'active bg-card color-primary': theme === 'system' }"
                  @click="setTheme('system')"
                >
                  <Monitor :size="18" />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>
          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Font Size</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Adjust the default font size</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <select class="settingspage-select-control fs-085rem color-text-primary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px" v-model="fontSize">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Brightness</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Adjust screen brightness ({{ brightness }}%)</span>
            </div>
            <div class="settingspage-setting-control settingspage-brightness-control flex-align-center gap-100 w-full">
              <Sun :size="16" class="settingspage-brightness-icon color-text-secondary flex-shrink-0" />
              <input 
                type="range" 
                min="50" 
                max="100" 
                v-model="brightness"
                class="settingspage-brightness-slider flex-1 outline-none border-radius-4px bg-border"
              />
              <span class="settingspage-brightness-value text-right fs-085rem txt-weight-light color-text-secondary min-w-45px">{{ brightness }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Content View -->
      <div v-else-if="currentView === 'content'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Show sexual content</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <label class="settingspage-toggle size-48px relative inline-block">
                <input class="settingspage-toggle-input opacity-0 w-0" type="checkbox" v-model="showSexualContent" />
                <span class="settingspage-toggle-slider cursor-pointer absolute inset-0 bg-border transition-all-02"></span>
              </label>
            </div>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Show violent / gore content</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <label class="settingspage-toggle size-48px relative inline-block">
                <input class="settingspage-toggle-input opacity-0 w-0" type="checkbox" v-model="showViolentContent" />
                <span class="settingspage-toggle-slider cursor-pointer absolute inset-0 bg-border transition-all-02"></span>
              </label>
            </div>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Show disturbing imagery</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <label class="settingspage-toggle size-48px relative inline-block">
                <input class="settingspage-toggle-input opacity-0 w-0" type="checkbox" v-model="showDisturbingImagery" />
                <span class="settingspage-toggle-slider cursor-pointer absolute inset-0 bg-border transition-all-02"></span>
              </label>
            </div>
          </div>

          <div class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Sensitive content is blurred by default. You can choose what to reveal.
          </div>
        </div>
      </div>

      <!-- Privacy View -->
      <div v-else-if="currentView === 'privacy'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Save browsing history</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Keep recent web, domain, IPFS, and IPNS pages for
                {{ activeHistoryProfileDisplay }}. Internal pages like New Tab, Wallet, Settings,
                and Extensions are excluded automatically.
              </span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <label class="settingspage-toggle size-48px relative inline-block">
                <input class="settingspage-toggle-input opacity-0 w-0" type="checkbox" :checked="historyEnabled" @change="onHistoryToggleChange" />
                <span class="settingspage-toggle-slider cursor-pointer absolute inset-0 bg-border transition-all-02"></span>
              </label>
            </div>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Saved items</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                {{ historyEntries.length }} history item{{ historyEntries.length === 1 ? '' : 's' }}
                saved for {{ activeHistoryProfileDisplay }}.
              </span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <button class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary" @click="openInNewTabSafe('lumen://history')">
                Open history
              </button>
            </div>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Clear saved history</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Permanently remove the saved browsing history for this profile.
              </span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <button class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary" :disabled="!historyEntries.length" @click="clearProfileHistory">
                Clear history
              </button>
            </div>
          </div>

          <div class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Turning history off stops new entries from being saved, but does not delete existing ones.
          </div>
        </div>
      </div>

      <!-- Network View -->
      <div v-else-if="currentView === 'network'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Kubo connectivity</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Controls how many peer connections the embedded IPFS node tries to keep.
              </span>
            </div>
            <div class="settingspage-setting-control settingspage-network-mode-control flex-align-center flex-justify-end">
              <div class="settingspage-theme-selector settingspage-network-mode-selector flex gap-50 border-radius-10px flex-wrap-wrap bg-secondary border-1 padding-25">
                <button
                  type="button"
                  class="settingspage-theme-option settingspage-network-mode-option flex-align-center gap-50 fw-500 color-text-secondary cursor-pointer padding-50-100 bg-transparent border-none border-radius-8px fs-14px transition-all-02 flex-justify-center hover-color-text-primary min-w-140px"
                  :class="{ 'active bg-card color-primary': ipfsConnectivityMode === 'light' }"
                  :disabled="networkSettingsSaving"
                  @click="saveIpfsConnectivityMode('light')"
                >
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  class="settingspage-theme-option settingspage-network-mode-option flex-align-center gap-50 fw-500 color-text-secondary cursor-pointer padding-50-100 bg-transparent border-none border-radius-8px fs-14px transition-all-02 flex-justify-center hover-color-text-primary min-w-140px"
                  :class="{ 'active bg-card color-primary': ipfsConnectivityMode === 'normal' }"
                  :disabled="networkSettingsSaving"
                  @click="saveIpfsConnectivityMode('normal')"
                >
                  <span>Normal</span>
                </button>
                <button
                  type="button"
                  class="settingspage-theme-option settingspage-network-mode-option flex-align-center gap-50 fw-500 color-text-secondary cursor-pointer padding-50-100 bg-transparent border-none border-radius-8px fs-14px transition-all-02 flex-justify-center hover-color-text-primary min-w-140px"
                  :class="{ 'active bg-card color-primary': ipfsConnectivityMode === 'high' }"
                  :disabled="networkSettingsSaving"
                  @click="saveIpfsConnectivityMode('high')"
                >
                  <span>High connectivity</span>
                </button>
              </div>
            </div>
          </div>

          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            If your network is unstable or your device is resource-constrained, Light is recommended.
          </p>
          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Changes are applied automatically by restarting the embedded Kubo daemon.
          </p>
          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Current idle connection target:
            <span class="settingspage-mono-path break-all mono">{{ networkModeSummary }}</span>
          </p>
          <p v-if="networkSettingsError" class="settingspage-setting-hint color-red-base fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            {{ networkSettingsError }}
          </p>
        </div>
      </div>

      <!-- Security View -->
      <div v-else-if="currentView === 'security'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <!-- Status Display -->
          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Password Protection</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                {{ securityStatus.enabled 
                  ? 'Password is required for wallet signing operations' 
                  : 'No password set - wallet operations are unprotected' }}
              </span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <span 
                class="settingspage-status-badge flex-inline-align-center gap-35 border-radius-20px fw-500 inline-flex padding-25-75" 
                :class="securityStatus.enabled ? 'status-enabled badge-success' : 'settingspage-status-disabled'"
              >
                {{ securityStatus.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
          </div>

          <!-- Session Status (only shown when password is enabled) -->
          <div v-if="securityStatus.enabled" class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Session Status</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">{{ securitySessionStatusText }}</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <button 
                v-if="securitySessionActive"
                class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                @click="lockSecuritySession"
              >
                <LockKeyhole :size="16" />
                Lock Now
              </button>
              <span v-else class="settingspage-status-badge status-locked badge-warning color-warning flex-inline-align-center gap-35 border-radius-20px fw-500 inline-flex padding-25-75 bg-ios-orange-a15">
                <LockKeyhole :size="14" />
                Locked
              </span>
            </div>
          </div>

          <div v-if="securityStatus.enabled" class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Password Cache Duration</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Choose how long the password stays cached before the session locks.
              </span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <select
                v-model="securitySessionTimeoutValue"
                class="settingspage-select-control fs-085rem color-text-primary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px"
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
            </div>
          </div>

          <!-- Set Password (when no password is set) -->
          <div v-if="!securityStatus.enabled" class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Set Password</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Create a password to protect wallet signing operations. 
                Your keys will be encrypted with this password.
              </span>
            </div>
          </div>

          <div v-if="!securityStatus.enabled" class="settingspage-security-form flex flex-column gap-100 border-radius-12px padding-100-125 bg-fill-tertiary margin-top-50">
            <div class="form-row flex flex-column gap-35">
              <label class="settingspage-form-label fw-500 color-text-secondary fs-13px">New Password</label>
              <input 
                type="password" 
                class="settingspage-input-control fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
                v-model="newPassword"
                placeholder="Enter password (min 8 characters)"
                :disabled="securityLoading"
              />
            </div>
            <div class="form-row flex flex-column gap-35">
              <label class="settingspage-form-label fw-500 color-text-secondary fs-13px">Confirm Password</label>
              <input 
                type="password" 
                class="settingspage-input-control fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
                v-model="confirmPassword"
                placeholder="Confirm password"
                :disabled="securityLoading"
                @keyup.enter="setSecurityPassword"
              />
            </div>
            <div v-if="securityError" class="settingspage-security-error color-error fs-085rem padding-0 padding-top-50 padding-bottom-50">
              {{ securityError }}
            </div>
            <button 
              class="settingspage-btn-primary disabled-fade-50 color-white border-radius-10px fw-500 cursor-pointer bg-accent border-none fs-14px padding-62-125 transition-opacity-015"
              @click="setSecurityPassword"
              :disabled="securityLoading || !newPassword || !confirmPassword"
            >
              {{ securityLoading ? 'Setting up...' : 'Enable Password Protection' }}
            </button>
          </div>

          <!-- Change/Remove Password (when password is set) -->
          <div v-if="securityStatus.enabled" class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Change Password</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Update your security password. You'll need to enter your current password.
              </span>
            </div>
          </div>

          <div v-if="securityStatus.enabled" class="settingspage-security-form flex flex-column gap-100 border-radius-12px padding-100-125 bg-fill-tertiary margin-top-50">
            <div class="form-row flex flex-column gap-35">
              <label class="settingspage-form-label fw-500 color-text-secondary fs-13px">Current Password</label>
              <input 
                type="password" 
                class="settingspage-input-control fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
                v-model="currentPassword"
                placeholder="Enter current password"
                :disabled="securityLoading"
              />
            </div>
            <div class="form-row flex flex-column gap-35">
              <label class="settingspage-form-label fw-500 color-text-secondary fs-13px">New Password</label>
              <input 
                type="password" 
                class="settingspage-input-control fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
                v-model="newPassword"
                placeholder="Enter new password (min 8 characters)"
                :disabled="securityLoading"
              />
            </div>
            <div class="form-row flex flex-column gap-35">
              <label class="settingspage-form-label fw-500 color-text-secondary fs-13px">Confirm New Password</label>
              <input 
                type="password" 
                class="settingspage-input-control fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
                v-model="confirmPassword"
                placeholder="Confirm new password"
                :disabled="securityLoading"
                @keyup.enter="changeSecurityPassword"
              />
            </div>
            <div v-if="securityError" class="settingspage-security-error color-error fs-085rem padding-0 padding-top-50 padding-bottom-50">
              {{ securityError }}
            </div>
            <div v-if="securitySuccess" class="settingspage-security-success color-success fs-085rem padding-0 padding-top-50 padding-bottom-50">
              {{ securitySuccess }}
            </div>
            <div class="settingspage-security-actions flex gap-75 margin-top-50">
              <button 
                class="settingspage-btn-primary disabled-fade-50 color-white border-radius-10px fw-500 cursor-pointer bg-accent border-none fs-14px padding-62-125 transition-opacity-015"
                @click="changeSecurityPassword"
                :disabled="securityLoading || !currentPassword || !newPassword || !confirmPassword"
              >
                {{ securityLoading ? 'Changing...' : 'Change Password' }}
              </button>
            </div>
          </div>

          <!-- Remove Password -->
          <div v-if="securityStatus.enabled" class="settingspage-setting-item margin-top-150 flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Remove Password</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Disable password protection. Your keys will be re-encrypted with app-level encryption only.
              </span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <button 
                class="settingspage-btn-danger disabled-fade-50 color-white border-radius-10px fs-085rem fw-500 cursor-pointer padding-50-100 border-none transition-opacity-015"
                @click="showRemovePasswordConfirm = true"
                :disabled="securityLoading"
              >
                Remove Password
              </button>
            </div>
          </div>

          <!-- Remove Password Confirmation -->
          <div v-if="showRemovePasswordConfirm" class="settingspage-security-confirm-box flex flex-column gap-75 border-radius-12px padding-100-125 bg-fill-error margin-top-75 border-1-ios-red-a2">
            <p class="settingspage-security-confirm-box-p margin-0 fs-14px color-text-primary">Enter your current password to disable protection:</p>
            <input 
              type="password" 
              class="settingspage-input-control fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
              v-model="removePasswordInput"
              placeholder="Current password"
              :disabled="securityLoading"
              @keyup.enter="removeSecurityPassword"
            />
            <div v-if="securityError" class="settingspage-security-error color-error fs-085rem padding-0 padding-top-50 padding-bottom-50">
              {{ securityError }}
            </div>
            <div class="settingspage-security-actions flex gap-75 margin-top-50">
              <button 
                class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                @click="cancelRemovePassword"
                :disabled="securityLoading"
              >
                Cancel
              </button>
              <button 
                class="settingspage-btn-danger disabled-fade-50 color-white border-radius-10px fs-085rem fw-500 cursor-pointer padding-50-100 border-none transition-opacity-015"
                @click="removeSecurityPassword"
                :disabled="securityLoading || !removePasswordInput"
              >
                {{ securityLoading ? 'Removing...' : 'Confirm Remove' }}
              </button>
            </div>
          </div>

          <p class="settingspage-setting-hint margin-top-100 fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            <strong>How it works:</strong> When enabled, every wallet signing operation 
            (send tokens, delegate, create domain, etc.) will require your password. 
            {{ securitySessionHintText }}
          </p>
        </div>
      </div>

      <!-- Profiles View -->
      <div v-else-if="currentView === 'profiles'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <div class="settingspage-setting-item profiles-header flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Profiles</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Select one or more profiles to export.</span>
            </div>
            <div class="settingspage-setting-control settingspage-profile-select-actions flex-align-center gap-50">
              <button
                class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                type="button"
                @click="selectAllProfiles"
                :disabled="!profiles.length"
              >
                Select all
              </button>
              <button
                class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                type="button"
                @click="clearSelectedProfiles"
                :disabled="!selectedProfileIds.length"
              >
                Clear
              </button>
            </div>
          </div>

          <div v-if="profiles.length" class="settingspage-profiles-list flex flex-column gap-25 border-radius-lg padding-50 bg-card border-default">
            <label
              v-for="p in profiles"
              :key="p.id"
              class="settingspage-profile-row flex-align-center gap-75 border-radius-md cursor-pointer padding-75-100 cursor-select-none"
              :class="{ active: p.id === activeProfileId }"
            >
              <input
                class="settingspage-profile-checkbox"
                type="checkbox"
                :value="p.id"
                v-model="selectedProfileIds"
              />
              <ProfileAvatar class="settingspage-profile-row-avatar flex-shrink-0" :profile="p" :size="32" :title="p.name || p.id" />
              <div class="settingspage-profile-row-main flex flex-column gap-20 min-w-0">
                <div class="settingspage-profile-row-title flex-align-center gap-50 min-w-0">
                  <span class="settingspage-profile-title txt-weight-light color-text-primary fs-14px overflow-hidden txt-overflow-ellipsis nowrap max-w-520px">{{ p.name || p.id }}</span>
                  <span v-if="p.id === activeProfileId" class="settingspage-profile-badge border-radius-full color-text-primary fs-11px padding-0-50 bg-ios-blue-a18 border-1-ios-blue-a25">Active</span>
                </div>
                <span class="settingspage-profile-id fs-075rem color-text-tertiary overflow-hidden txt-overflow-ellipsis nowrap max-w-520px">{{ p.id }}</span>
              </div>
            </label>
          </div>
          <p v-else class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">No profiles found.</p>

          <div v-if="profiles.length" class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Display name</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Rename a profile without changing its internal profile ID.</span>
            </div>
            <div class="settingspage-setting-control settingspage-profile-select-actions flex-align-center gap-50">
              <select
                v-model="renameProfileId"
                class="settingspage-select-control fs-085rem color-text-primary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px"
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
              <input
                v-model="renameProfileDraft"
                type="text"
                class="settingspage-input-control settingspage-wide fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px settingspage-input-control-settingspage-wide"
                placeholder="Enter a display name"
                :disabled="profileRenameSaving || !renameProfileId"
                @keyup.enter="saveProfileDisplayName"
              />
              <button
                class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                type="button"
                :disabled="profileRenameSaving || !renameProfileId"
                @click="resetProfileDisplayNameDraft"
              >
                Reset
              </button>
              <button
                class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                type="button"
                :disabled="profileRenameSaving || !renameProfileId"
                @click="saveProfileDisplayName"
              >
                {{ profileRenameSaving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
          <p v-if="profileRenameError" class="settingspage-setting-hint color-red-base fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            {{ profileRenameError }}
          </p>

          <div v-if="profiles.length" class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Profile photo</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Override the generated profile thumbnail with a local image.</span>
            </div>
            <div class="settingspage-setting-control settingspage-profile-photo-control flex-align-center flex-wrap-wrap gap-50 flex-justify-end">
              <select
                v-model="avatarProfileId"
                class="settingspage-select-control fs-085rem color-text-primary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px"
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
                class="settingspage-profile-photo-preview flex-shrink-0"
                :profile="avatarProfileTarget"
                :size="44"
                :title="avatarProfileTarget?.name || avatarProfileTarget?.id || 'Profile'"
              />
              <button
                class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                type="button"
                :disabled="profileAvatarSaving || !avatarProfileId"
                @click="chooseProfileAvatar"
              >
                {{ profileAvatarSaving ? 'Updating...' : 'Choose image' }}
              </button>
              <button
                class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                type="button"
                :disabled="profileAvatarSaving || !avatarProfileTarget?.avatarDataUrl"
                @click="resetProfileAvatar"
              >
                Reset
              </button>
            </div>
          </div>
          <p v-if="profileAvatarError" class="settingspage-setting-hint color-red-base fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            {{ profileAvatarError }}
          </p>
          <p v-if="profiles.length" class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Lumen crops the selected image to a square thumbnail and stores it with the profile.
          </p>

           <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
             <div class="setting-info flex flex-column gap-20">
               <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Backups</span>
               <span class="settingspage-setting-desc color-text-secondary fs-13px">Export full backup folders (profiles + PQC keys).</span>
             </div>
             <div class="settingspage-setting-control settingspage-profile-backup-actions flex-align-center gap-50">
               <button
                 class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                 type="button"
                 @click="onExportSelectedBackups"
                 :disabled="!selectedProfileIds.length || exportingBackup"
               >
                 Export selected ({{ selectedProfileIds.length }})
               </button>
             </div>
           </div>
           <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
             Backups include the encrypted keystore, profile metadata and PQC keys (pqc_keys). Export creates one folder per selected profile.
           </p>
           <p v-if="backupExportSummary" class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">{{ backupExportSummary }}</p>
           <div v-if="backupExportFailures.length" class="settingspage-backup-failures flex flex-column gap-25 margin-top-25">
             <div v-for="f in backupExportFailures" :key="f.id" class="settingspage-backup-failure color-error fs-13px">
               {{ f.id }}: {{ f.error || 'failed' }}
             </div>
           </div>
         </div>
       </div>

      <!-- Developer settings View -->
      <div v-else-if="currentView === 'advanced'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            These settings are intended for developers. Most users should not need to change them.
          </p>

          <div class="settingspage-advanced-title flex-align-center gap-50 margin-top-100 txt-weight-medium color-text-primary margin-bottom-50 fs-14px">
            <Globe :size="18" />
            <span>Network</span>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Local IPFS Gateway</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Used for loading IPFS content in the UI</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <input
                type="text"
                class="settingspage-input-control settingspage-wide fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px settingspage-input-control-settingspage-wide"
                v-model="localGatewayDraft"
                placeholder="http://127.0.0.1:8080"
              />
            </div>
          </div>

          <div class="settingspage-advanced-title flex-align-center gap-50 margin-top-100 txt-weight-medium color-text-primary margin-bottom-50 fs-14px">
            <Database :size="18" />
            <span>IPFS</span>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">IPFS API Endpoint</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Used by the Electron backend (Kubo API)</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <input
                type="text"
                class="settingspage-input-control settingspage-wide fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px settingspage-input-control-settingspage-wide"
                v-model="ipfsApiDraft"
                placeholder="http://127.0.0.1:5001"
              />
            </div>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Max upload size (local drive)</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Maximum size per local upload before it is rejected. Default 10 GB.
              </span>
            </div>
            <div class="settingspage-setting-control settingspage-setting-number-control flex-align-center gap-50">
              <input
                type="number"
                min="1"
                step="1"
                class="settingspage-input-control w-96px fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
                v-model="localDriveMaxUploadSizeDraft"
                :placeholder="String(DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB)"
              />
              <span class="settingspage-setting-inline-note color-text-secondary fs-13px">GB</span>
            </div>
          </div>

          <div v-if="devSettingsError" class="settingspage-setting-hint color-red-base fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            {{ devSettingsError }}
          </div>

          <div class="settingspage-profile-backup-actions margin-top-75 gap-50">
            <button
              class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
              type="button"
              :disabled="devSettingsSaving"
              @click="resetDevSettings"
            >
              Reset
            </button>
            <button
              class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
              type="button"
              :disabled="devSettingsSaving"
              @click="saveDevSettings"
            >
              {{ devSettingsSaving ? 'Saving...' : 'Save' }}
            </button>
          </div>

          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Note: the local IPFS daemon must actually be configured to use these ports/addresses.
          </p>
          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Network changes are applied automatically (no restart prompt).
          </p>

          <div class="settingspage-advanced-title flex-align-center gap-50 margin-top-100 txt-weight-medium color-text-primary margin-bottom-50 fs-14px">
            <FolderOpen :size="18" />
            <span>Lumen data folder</span>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Custom data folder target</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">
                Override the default folder used by the Lumen binary for IPFS, profiles, logs and app metadata.
              </span>
            </div>
            <div class="settingspage-setting-control settingspage-data-folder-control flex-align-center flex-justify-end min-w-420px">
              <div class="settingspage-data-folder-input-row flex-align-center-justify-end gap-50 w-full">
                <input
                  type="text"
                  class="settingspage-input-control settingspage-data-folder-input fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
                  v-model="lumenDataFolderDraft"
                  :placeholder="defaultUserDataPath || 'D:\\Lumen'"
                  :disabled="lumenDataFolderBusy"
                />
                <button
                  class="settingspage-btn-secondary disabled-fade-50 settingspage-troubleshooting-btn color-text-primary fs-085rem color-text-secondary cursor-pointer flex-inline-align-center gap-50 padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                  type="button"
                  :disabled="lumenDataFolderBusy"
                  @click="browseLumenDataFolder"
                >
                  <FolderOpen :size="16" />
                  <span>Browse...</span>
                </button>
              </div>
            </div>
          </div>

          <div class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Active now: <span class="settingspage-mono-path break-all mono">{{ activeUserDataPath || 'Unavailable' }}</span>
          </div>
          <div class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Next launch target: <span class="settingspage-mono-path break-all mono">{{ effectiveUserDataPath || defaultUserDataPath || 'Unavailable' }}</span>
          </div>
          <div class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Default target: <span class="settingspage-mono-path break-all mono">{{ defaultUserDataPath || 'Unavailable' }}</span>
          </div>
          <div v-if="bootstrapConfigPath" class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Bootstrap config: <span class="settingspage-mono-path break-all mono">{{ bootstrapConfigPath }}</span>
          </div>
          <div v-if="activeLogsPath" class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Active logs folder: <span class="settingspage-mono-path break-all mono">{{ activeLogsPath }}</span>
          </div>
          <div
            v-if="lumenDataFolderError"
            class="settingspage-setting-hint color-red-base fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25"
          >
            {{ lumenDataFolderError }}
          </div>

          <div class="settingspage-profile-backup-actions margin-top-75 gap-50">
            <button
              class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
              type="button"
              :disabled="lumenDataFolderBusy"
              @click="revertLumenDataFolderDraft"
            >
              Revert
            </button>
            <button
              class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
              type="button"
              :disabled="lumenDataFolderBusy"
              @click="useDefaultLumenDataFolderDraft"
            >
              Use default
            </button>
            <button
              class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
              type="button"
              :disabled="lumenDataFolderBusy"
              @click="saveLumenDataFolder"
            >
              {{ lumenDataFolderSaving ? 'Applying...' : 'Apply' }}
            </button>
          </div>

          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Leave the field empty to go back to the default folder target.
          </p>
          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Restart Lumen after changing this target. Existing files are not moved automatically.
          </p>
          <p v-if="bootstrapRestartRequired" class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Restart required: the running app is still using <span class="settingspage-mono-path break-all mono">{{ activeUserDataPath }}</span>.
          </p>
        </div>
      </div>

      <!-- Troubleshooting View -->
      <div v-else-if="currentView === 'troubleshooting'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            Generate a safe support bundle for remote troubleshooting. Passwords, password hashes, API keys and private keys are excluded.
          </p>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Copy Debug Report</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Copy app info, sanitized settings, service status, file inventory and recent log excerpts to the clipboard.</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <button
                class="settingspage-btn-secondary disabled-fade-50 settingspage-troubleshooting-btn color-text-primary fs-085rem color-text-secondary cursor-pointer flex-inline-align-center gap-50 padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                type="button"
                @click="copyDebugReport"
                :disabled="troubleshootingBusy"
              >
                <Copy :size="16" />
                <span>{{ troubleshootingAction === 'copy' ? 'Copying...' : 'Copy Debug Report' }}</span>
              </button>
            </div>
          </div>

          <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Open Logs Folder</span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Open the logs folder containing the live Electron log, the latest debug report and safe copies of known support logs.</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <button
                class="settingspage-btn-secondary disabled-fade-50 settingspage-troubleshooting-btn color-text-primary fs-085rem color-text-secondary cursor-pointer flex-inline-align-center gap-50 padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary"
                type="button"
                @click="openLogsFolderAction"
                :disabled="troubleshootingBusy"
              >
                <FolderOpen :size="16" />
                <span>{{ troubleshootingAction === 'open' ? 'Opening...' : 'Open Logs Folder' }}</span>
              </button>
            </div>
          </div>

          <p class="settingspage-setting-hint fs-075rem color-text-tertiary margin-top-50 fs-13px margin-top-25">
            The logs folder is regenerated on demand so people can inspect the current support snapshot and share relevant log excerpts.
          </p>
          <p v-if="troubleshootingDir" class="settingspage-troubleshooting-path border-radius-md color-text-secondary margin-top-25 padding-75-100 bg-card border-default fs-12px break-all">
            Logs folder: {{ troubleshootingDir }}
          </p>
          <p v-if="troubleshootingReportPath" class="settingspage-troubleshooting-path border-radius-md color-text-secondary margin-top-25 padding-75-100 bg-card border-default fs-12px break-all">
            Debug report: {{ troubleshootingReportPath }}
          </p>
        </div>
      </div>

      <!-- Private Cloud View -->
      <div v-else-if="currentView === 'privatecloud'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="setting-group flex flex-column gap-50">
          <!-- Main Enable Toggle -->
          <div class="settingspage-setting-item settingspage-featured flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm settingspage-setting-item-settingspage-featured" :class="{ active: privateCloudEnabled }">
            <div class="setting-info flex flex-column gap-20">
              <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="inline-block align-middle margin-right-50">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                </svg>
                Enable Private Cloud
              </span>
              <span class="settingspage-setting-desc color-text-secondary fs-13px">Use your own private IPFS gateways for content delivery</span>
            </div>
            <div class="settingspage-setting-control flex-align-center">
              <label class="settingspage-toggle size-48px relative inline-block">
                <input class="settingspage-toggle-input opacity-0 w-0" type="checkbox" v-model="privateCloudEnabled" />
                <span class="settingspage-toggle-slider cursor-pointer absolute inset-0 bg-border transition-all-02"></span>
              </label>
            </div>
          </div>

          <!-- Settings when enabled -->
          <template v-if="privateCloudEnabled">
            <!-- Gateway Preferences -->
            <div class="settingspage-settings-subsection margin-top-100">
              <h3 class="settingspage-subsection-title txt-weight-light color-text-primary fs-15px margin-0 margin-bottom-75">Gateway Preferences</h3>
              
              <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
                <div class="setting-info flex flex-column gap-20">
                  <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Prefer Private Gateways</span>
                  <span class="settingspage-setting-desc color-text-secondary fs-13px">Try private gateways first before DAO gateways</span>
                </div>
                <div class="settingspage-setting-control flex-align-center">
                  <label class="settingspage-toggle size-48px relative inline-block">
                    <input class="settingspage-toggle-input opacity-0 w-0" type="checkbox" v-model="preferPrivateGateways" />
                    <span class="settingspage-toggle-slider cursor-pointer absolute inset-0 bg-border transition-all-02"></span>
                  </label>
                </div>
              </div>

              <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
                <div class="setting-info flex flex-column gap-20">
                  <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Fallback to DAO Gateways</span>
                  <span class="settingspage-setting-desc color-text-secondary fs-13px">Use DAO gateways if private gateways fail</span>
                </div>
                <div class="settingspage-setting-control flex-align-center">
                  <label class="settingspage-toggle size-48px relative inline-block">
                    <input class="settingspage-toggle-input opacity-0 w-0" type="checkbox" v-model="fallbackToDAO" />
                    <span class="settingspage-toggle-slider cursor-pointer absolute inset-0 bg-border transition-all-02"></span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Gateway IDs -->
            <div class="settingspage-settings-subsection margin-top-100">
              <div class="settingspage-subsection-header flex-align-center-justify-space-between margin-bottom-50">
                <h3 class="settingspage-subsection-title txt-weight-light color-text-primary fs-15px margin-0 margin-bottom-75">Gateway IDs</h3>
                <span class="settingspage-count-badge flex-inline-align-justify-center fs-075rem txt-weight-light color-ios-blue border-radius-10px h-22px padding-0-50 bg-ios-blue-a15 min-w-22px">{{ gatewayIds.length }}</span>
              </div>
              <p class="settingspage-subsection-desc fs-085rem color-text-secondary margin-0 margin-bottom-100">Add gateway IDs to use for private content delivery</p>

              <div class="settingspage-gateway-ids-wrapper border-radius-12px padding-100 bg-secondary border-1">
                <div v-if="gatewayIds.length > 0" class="settingspage-gateway-ids-list flex flex-column gap-50 margin-bottom-100">
                  <div v-for="(id, index) in gatewayIds" :key="index" class="settingspage-gateway-id-item flex-align-center-justify-space-between padding-75-100 bg-card border-1 border-radius-8px transition-all-02 hover-border-ios-blue">
                    <span class="settingspage-gateway-id-text mono color-text-primary fs-14px">{{ id }}</span>
                    <button class="settingspage-icon-btn-small flex-align-justify-center size-28px color-text-secondary cursor-pointer bg-transparent border-none border-radius-6px transition-all-02 hover-color-error" @click="removeGatewayId(index)">
                      <X :size="16" />
                    </button>
                  </div>
                </div>
                <div v-else class="settingspage-empty-gateway-ids flex-align-center flex-column text-center color-text-tertiary padding-200-100">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-30 margin-bottom-50">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                    <line x1="6" y1="6" x2="6.01" y2="6"></line>
                    <line x1="6" y1="18" x2="6.01" y2="18"></line>
                  </svg>
                  <p class="settingspage-empty-gateway-ids-p fs-14px fw-500 color-text-secondary margin-0 margin-top-50 margin-bottom-25">No gateway IDs configured</p>
                  <span class="settingspage-empty-gateway-ids-span fs-085rem">Add your first gateway ID below</span>
                </div>

                <div class="settingspage-add-gateway-id flex gap-75">
                  <input
                    v-model="newGatewayId"
                    type="text"
                    class="settingspage-input-control settingspage-wide fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px settingspage-input-control-settingspage-wide"
                    placeholder="Enter gateway ID (e.g., gateway-123)"
                    @keyup.enter="addGatewayId"
                  />
                  <button class="settingspage-btn-secondary disabled-fade-50 color-text-primary fs-085rem color-text-secondary cursor-pointer padding-50-100 bg-secondary border-1 border-radius-8px transition-all-02 hover-color-text-primary" @click="addGatewayId" :disabled="!newGatewayId.trim()">
                    <Plus :size="16" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <!-- Advanced Settings -->
            <div class="settingspage-settings-subsection margin-top-100">
              <h3 class="settingspage-subsection-title txt-weight-light color-text-primary fs-15px margin-0 margin-bottom-75">Advanced Settings</h3>

              <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
                <div class="setting-info flex flex-column gap-20">
                  <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Request Timeout</span>
                  <span class="settingspage-setting-desc color-text-secondary fs-13px">Maximum time to wait for gateway response ({{ gatewayTimeout / 1000 }}s)</span>
                </div>
                <div class="settingspage-setting-control flex-align-center">
                  <input
                    type="range"
                    min="1000"
                    max="30000"
                    step="1000"
                    v-model="gatewayTimeout"
                    class="settingspage-brightness-slider flex-1 outline-none border-radius-4px bg-border"
                  />
                  <span class="settingspage-brightness-value text-right fs-085rem txt-weight-light color-text-secondary min-w-45px">{{ gatewayTimeout / 1000 }}s</span>
                </div>
              </div>

              <div class="settingspage-setting-item flex-align-center-justify-space-between border-radius-lg padding-100-125 bg-card border-default hover-bg-hover hover-border-ios-blue hover-lift-1 hover-shadow-sm">
                <div class="setting-info flex flex-column gap-20">
                  <span class="settingspage-setting-label txt-weight-light color-text-primary fs-14px">Max Retries</span>
                  <span class="settingspage-setting-desc color-text-secondary fs-13px">Maximum retry attempts per gateway</span>
                </div>
                <div class="settingspage-setting-control flex-align-center">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    v-model="maxRetries"
                    class="settingspage-input-control w-80px fs-085rem color-text-primary padding-50-100 bg-secondary border-1 border-radius-8px"
                  />
                </div>
              </div>
            </div>

            <!-- Info Box -->
            <div class="settingspage-info-box flex gap-100 border-radius-12px margin-top-100 padding-100-125 border-15-ios-blue-a2">
              <svg class="settingspage-info-box-svg flex-shrink-0 color-ios-blue" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <div>
                <strong class="settingspage-info-box-strong block fs-14px color-text-primary margin-bottom-25">Need to create a gateway?</strong>
                <p class="settingspage-info-box-p fs-085rem color-text-secondary margin-0 line-height-15">Visit <a class="settingspage-info-box-a color-ios-blue fw-500 hover-underline" href="lumen://my-gateways" @click.prevent="navigate?.('lumen://my-gateways', { push: true })">My Gateways</a> to set up your private gateway server.</p>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- About View -->
      <div v-else-if="currentView === 'about'" class="settingspage-settings-section flex-1 overflow-y-auto">
        <div class="settingspage-about-card flex-align-center flex-column text-center border-radius-20px bg-card padding-300">
          <div class="settingspage-about-logo margin-bottom-150">
            <div class="flex-align-justify-center size-64px border-radius-xl bg-gradient-primary color-white shadow-primary">
              <Hexagon :size="32" />
            </div>
          </div>
          <h2 class="settingspage-about-card-h2 fs-15rem txt-weight-medium color-text-primary margin-0 margin-bottom-50">Lumen Browser</h2>
          <p class="settingspage-version fs-14px color-text-secondary margin-0 margin-bottom-100">Version {{ appVersion }}</p>
          <p class="settingspage-description fs-14px color-text-secondary margin-0 margin-bottom-150">The Decentralized Internet Stack</p>
          <div class="settingspage-about-links flex gap-100">
            <a
              href="https://lumen-browser.com/"
              class="settingspage-about-link color-primary fw-500 fs-14px hover-underline"
              @click.prevent="openInNewTabSafe('https://lumen-browser.com/')"
              >Website</a
            >
            <a
              href="https://github.com/network-lumen"
              class="settingspage-about-link color-primary fw-500 fs-14px hover-underline"
              @click.prevent="openInNewTabSafe('https://github.com/network-lumen')"
              >GitHub</a
            >
            <a
              href="lumen://help"
              class="settingspage-about-link color-primary fw-500 fs-14px hover-underline"
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
import { ref, watch, computed, inject, onMounted } from 'vue';
import { useInternalLumen } from '../../composables/useInternalLumen';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
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
  Plus,
  X
} from 'lucide-vue-next';
import { useTheme } from '../../composables/useTheme';
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

const toast = useToast();
const appVersion = String((pkg as any)?.version || '0.0.0');

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);

function openInNewTabSafe(url: string) {
  if (openInNewTab) {
    openInNewTab(url);
    return;
  }
  navigate?.(url, { push: true });
}

function onHistoryToggleChange(event: Event) {
  const enabled = !!(event.target as HTMLInputElement | null)?.checked;
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
const { theme, effectiveTheme, setTheme, initTheme } = useTheme();
const fontSize = ref(localStorage.getItem('lumen-font-size') || 'medium');
const brightness = ref(parseInt(localStorage.getItem('lumen-brightness') || '100'));
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

type BootstrapPathState = {
  bootstrapConfigPath: string;
  defaultUserDataPath: string;
  customUserDataPath: string;
  usingCustomUserDataPath: boolean;
  effectiveUserDataPath: string;
  activeUserDataPath: string;
  activeLogsPath: string;
  restartRequired: boolean;
};

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
    return 'Session locked - password required for next operation';
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
    const status = await useInternalLumen().security.getStatus();
    securityStatus.value = { enabled: !!(status?.passwordEnabled && status?.hasPassword) };
    const session = await useInternalLumen().security.checkSession();
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
  
  if (newPassword.value.length < 8) {
    securityError.value = 'Password must be at least 8 characters.';
    return;
  }
  
  if (newPassword.value !== confirmPassword.value) {
    securityError.value = 'Passwords do not match.';
    return;
  }
  
  securityLoading.value = true;
  try {
    const result = await useInternalLumen().security.setPassword({ password: newPassword.value });
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
  } catch (e: any) {
    securityError.value = e?.message || 'Failed to set password.';
    toast.error(e?.message || 'Failed to set password');
  } finally {
    securityLoading.value = false;
  }
}

async function changeSecurityPassword() {
  securityError.value = '';
  securitySuccess.value = '';
  
  if (newPassword.value.length < 8) {
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
    const verify = await useInternalLumen().security.verifyPassword({ password: currentPassword.value });
    if (!verify?.ok) {
      securityError.value = 'Current password is incorrect.';
      securityLoading.value = false;
      return;
    }
    
    // Remove old and set new
    const removeResult = await useInternalLumen().security.removePassword({ password: currentPassword.value });
    if (!removeResult?.ok) {
      securityError.value = removeResult?.error || 'Failed to change password.';
      securityLoading.value = false;
      return;
    }
    
    const setResult = await useInternalLumen().security.setPassword({ password: newPassword.value });
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
  } catch (e: any) {
    securityError.value = e?.message || 'Failed to change password.';
    toast.error(e?.message || 'Failed to change password');
  } finally {
    securityLoading.value = false;
  }
}

async function removeSecurityPassword() {
  securityError.value = '';
  securitySuccess.value = '';
  securityLoading.value = true;
  
  try {
    const result = await useInternalLumen().security.removePassword({ password: removePasswordInput.value });
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
  } catch (e: any) {
    securityError.value = e?.message || 'Failed to remove password.';
    toast.error(e?.message || 'Failed to remove password');
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
    await useInternalLumen().security.lockSession();
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
  localStorage.setItem('lumen-font-size', newSize);
  document.documentElement.setAttribute('data-font-size', newSize);
});

watch(brightness, (newBrightness) => {
  localStorage.setItem('lumen-brightness', newBrightness.toString());
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

function validateUrl(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

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
  } catch (e: any) {
    lumenDataFolderError.value = e?.message || 'Failed to load Lumen data folder.';
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
  const localGatewayBase = validateUrl(localGatewayDraft.value);
  const ipfsApiBase = validateUrl(ipfsApiDraft.value);
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
  } catch (e: any) {
    lumenDataFolderError.value = e?.message || 'Failed to open folder picker.';
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
  } catch (e: any) {
    lumenDataFolderError.value = e?.message || 'Failed to save Lumen data folder.';
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
  } catch (e: any) {
    toast.error(e?.message || 'Failed to copy debug report');
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
  } catch (e: any) {
    toast.error(e?.message || 'Failed to open logs folder');
  } finally {
    troubleshootingAction.value = '';
  }
}

// Private Cloud functions
async function loadPrivateCloudConfig() {
  privateCloudLoading.value = true;
  try {
    const config = await useInternalLumen().settingsLoadPrivateCloudConfig();
    console.log('[SettingsPage] Loaded config:', config);
    
    privateCloudEnabled.value = !!config.enabled;
    preferPrivateGateways.value = !!config.preferPrivate;
    fallbackToDAO.value = config.fallbackToDAO !== false;
    gatewayIds.value = Array.isArray(config.gatewayIds) ? config.gatewayIds : [];
    gatewayTimeout.value = typeof config.timeout === 'number' ? config.timeout : 5000;
    maxRetries.value = typeof config.maxRetries === 'number' ? config.maxRetries : 3;
    
    console.log('[SettingsPage] Config loaded successfully');
  } catch (e) {
    console.error('Failed to load private cloud config:', e);
  } finally {
    privateCloudLoading.value = false;
    // Use nextTick to ensure all reactive updates are done before enabling watch
    await new Promise(resolve => setTimeout(resolve, 100));
    privateCloudInitialized.value = true;
    console.log('[SettingsPage] Private cloud initialized');
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
    
    console.log('[SettingsPage] Saving private cloud config:', config);
    const result = await useInternalLumen().settingsSavePrivateCloudConfig(config);
    console.log('[SettingsPage] Save result:', result);
    
    if (!result.ok) {
      console.error('Failed to save private cloud config:', result.error);
      toast.error(result.error || 'Failed to save private cloud settings');
    } else {
      console.log('[SettingsPage] Config saved successfully');
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
    console.log('[SettingsPage] Watch triggered, saving config...');
    savePrivateCloudConfig();
  } else {
    console.log('[SettingsPage] Watch triggered but skipped (loading:', privateCloudLoading.value, 'initialized:', privateCloudInitialized.value, ')');
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
