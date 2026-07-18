<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content onboarding-modal" @click.stop>
        <div class="modal-header">
          <div class="header-icon">
            <Shield :size="32" class="color-primary" />
          </div>
          <h2 class="modal-title">
            {{ requiresProfileCreation ? "Create Your First Profile" : "Protect Your Wallet" }}
          </h2>
          <p class="modal-subtitle">
            {{
              requiresProfileCreation
                ? "A profile is required to use Drive, Wallet, and personal storage."
                : "Your wallet is local and self-custodial"
            }}
          </p>
        </div>

        <div class="modal-body">
          <div v-if="step === 'intro'" class="onboarding-step">
            <div class="warning-box">
              <AlertCircle :size="20" class="color-warning" />
              <div class="warning-content">
                <p class="txt-sm txt-weight-strong margin-0">Important: No one can recover your wallet</p>
                <p class="txt-xs color-gray-blue margin-top-25 margin-0">
                  Lumen is a self-custodial wallet. If you lose access to your wallet without backing it up, 
                  your funds are permanently lost. We cannot help you recover them.
                </p>
              </div>
            </div>

            <div class="info-cards">
              <div class="info-card">
                <Lock :size="20" class="color-primary" />
                <h4 class="txt-sm txt-weight-strong margin-top-50 margin-0">Set a Password</h4>
                <p class="txt-xs color-gray-blue margin-top-25 margin-0">
                  Protect your wallet with a strong password
                </p>
              </div>
              <div class="info-card">
                <Download :size="20" class="color-primary" />
                <h4 class="txt-sm txt-weight-strong margin-top-50 margin-0">Backup Your Wallet</h4>
                <p class="txt-xs color-gray-blue margin-top-25 margin-0">
                  Export and save your wallet backup file securely
                </p>
              </div>
            </div>
          </div>

          <div v-else-if="step === 'password'" class="onboarding-step">
            <p class="txt-sm color-gray-blue margin-bottom-100">
              Create a strong password to protect your wallet. You'll need this password to send transactions.
            </p>

            <div class="form-group">
              <label class="txt-xs txt-weight-strong margin-bottom-25">Password (minimum 8 characters)</label>
              <input
                v-model="password"
                type="password"
                class="form-input"
                placeholder="Enter password"
                @keyup.enter="handlePasswordSubmit"
              />
            </div>

            <div class="form-group">
              <label class="txt-xs txt-weight-strong margin-bottom-25">Confirm Password</label>
              <input
                v-model="confirmPassword"
                type="password"
                class="form-input"
                placeholder="Confirm password"
                @keyup.enter="handlePasswordSubmit"
              />
            </div>

            <div v-if="passwordError" class="error-message txt-xs color-red-base margin-top-50">
              {{ passwordError }}
            </div>
          </div>

          <div v-else-if="step === 'profile-name'" class="onboarding-step">
            <div class="success-box" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="txt-sm margin-0">Password set successfully!</p>
            </div>

            <p class="txt-sm color-gray-blue margin-top-100 margin-bottom-100">
              Choose a name for your first profile before creating your wallet.
            </p>

            <div class="form-group">
              <label class="txt-xs txt-weight-strong margin-bottom-25">Profile name</label>
              <input
                v-model="profileName"
                type="text"
                class="form-input"
                placeholder="Enter a profile name"
                maxlength="64"
                @keyup.enter="handleProfileNameSubmit"
              />
            </div>

            <div v-if="profileNameError" class="error-message txt-xs color-red-base margin-top-50">
              {{ profileNameError }}
            </div>
          </div>

          <div v-else-if="step === 'creating-wallet'" class="onboarding-step">
            <div class="success-box" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="txt-sm margin-0">Password set successfully!</p>
            </div>

            <div class="creating-wallet-box">
              <div v-if="creatingWallet" class="wallet-creating">
                <UiSpinner size="lg" />
                <h3 class="txt-lg txt-weight-strong margin-top-100 margin-0">Creating Your Wallet</h3>
                <p class="txt-sm color-gray-blue margin-top-50 margin-0">
                  Generating secure keys and wallet address...
                </p>
              </div>

              <div v-else-if="walletCreated" class="wallet-created">
                <CheckCircle :size="48" class="color-success" />
                <h3 class="txt-lg txt-weight-strong margin-top-100 margin-0">Wallet Created!</h3>
                <p class="txt-sm color-gray-blue margin-top-50 margin-0">
                  Your wallet is ready. Let's back it up to keep it safe.
                </p>
              </div>

              <div v-else-if="walletError" class="wallet-error">
                <AlertCircle :size="48" class="color-red-base" />
                <h3 class="txt-lg txt-weight-strong margin-top-100 margin-0">Wallet Creation Failed</h3>
                <p class="txt-sm color-gray-blue margin-top-50 margin-0">
                  {{ walletError }}
                </p>
                <button class="btn-retry margin-top-100" @click="createWallet">
                  Try Again
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="step === 'backup'" class="onboarding-step">
            <div class="success-box" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="txt-sm margin-0">Password set successfully!</p>
            </div>

            <p class="txt-sm color-gray-blue margin-top-100 margin-bottom-100">
              Now, backup your wallet to a secure location. Keep this backup file safe - you'll need it to restore your wallet if you lose access.
            </p>

            <div class="warning-box">
              <AlertCircle :size="20" class="color-warning" />
              <div class="warning-content">
                <p class="txt-xs margin-0">
                  Store your backup in a secure location like an encrypted USB drive or password manager. 
                  Never share it with anyone.
                </p>
              </div>
            </div>

            <div v-if="backupError" class="error-message txt-xs color-red-base margin-top-50">
              {{ backupError }}
            </div>

            <div v-if="backupSuccess" class="success-message txt-xs color-success margin-top-50">
              {{ backupSuccess }}
            </div>
          </div>

          <div v-else-if="step === 'complete'" class="onboarding-step">
            <div class="success-box-large">
              <CheckCircle :size="48" class="color-success" />
              <h3 class="txt-lg txt-weight-strong margin-top-100 margin-0">All Set!</h3>
              <p class="txt-sm color-gray-blue margin-top-50 margin-0">
                Your wallet is now protected. Remember to keep your password and backup file safe.
              </p>
            </div>

            <div class="reminder-box">
              <p class="txt-xs txt-weight-strong margin-0 margin-bottom-50">Remember:</p>
              <ul class="txt-xs color-gray-blue reminder-list">
                <li>Never share your password or backup file</li>
                <li>Store your backup in multiple secure locations</li>
                <li>You'll need your password for all transactions</li>
                <li>No one can recover your wallet if you lose both</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            v-if="step === 'intro' && !requiresProfileCreation"
            class="btn-modal-secondary"
            @click="handleSkip"
          >
            Skip for now
          </button>
          <button
            v-if="step === 'intro'"
            class="btn-modal-primary disabled-fade-60"
            @click="step = 'password'"
          >
            Get Started
          </button>

          <button
            v-if="step === 'password'"
            class="btn-modal-secondary"
            @click="step = 'intro'"
          >
            Back
          </button>
          <button
            v-if="step === 'password'"
            class="btn-modal-primary disabled-fade-60"
            :disabled="settingPassword"
            @click="handlePasswordSubmit"
          >
            <UiSpinner v-if="settingPassword" size="sm" />
            <span>{{ settingPassword ? 'Setting Password...' : 'Set Password' }}</span>
          </button>

          <button
            v-if="step === 'profile-name'"
            class="btn-modal-primary disabled-fade-60"
            @click="handleProfileNameSubmit"
          >
            Continue
          </button>

          <button
            v-if="step === 'backup'"
            class="btn-modal-secondary"
            @click="handleSkipBackup"
          >
            Skip Backup
          </button>
          <button
            v-if="step === 'backup'"
            class="btn-modal-primary disabled-fade-60"
            :disabled="exportingBackup"
            @click="handleExportBackup"
          >
            <UiSpinner v-if="exportingBackup" size="sm" />
            <span>{{ exportingBackup ? 'Exporting...' : 'Export Backup' }}</span>
          </button>

          <button
            v-if="step === 'complete'"
            class="btn-modal-primary disabled-fade-60"
            @click="handleComplete"
          >
            Start Using Lumen
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Shield, Lock, Download, AlertCircle, CheckCircle } from 'lucide-vue-next';
import UiSpinner from '../ui/UiSpinner.vue';
import { activeProfileId, createProfile, initProfiles, profilesState } from '../internal/profilesStore';
import { useInternalLumen } from '../composables/useInternalLumen';

type OnboardingStep = 'intro' | 'password' | 'profile-name' | 'creating-wallet' | 'backup' | 'complete';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  complete: [];
  skip: [];
}>();

const step = ref<OnboardingStep>('intro');
const password = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const profileName = ref('');
const profileNameError = ref('');
const passwordSet = ref(false);
const settingPassword = ref(false);
const creatingWallet = ref(false);
const walletCreated = ref(false);
const walletError = ref('');
const backupError = ref('');
const backupSuccess = ref('');
const exportingBackup = ref(false);
const requiresProfileCreation = computed(
  () => !profilesState.value.some((profile) => profile && profile.role !== 'guest'),
);

function handleOverlayClick() {
  // Prevent closing by clicking overlay during onboarding
}

function handleSkip() {
  emit('skip');
}

function handleSkipBackup() {
  step.value = 'complete';
}

async function handlePasswordSubmit() {
  passwordError.value = '';

  if (password.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match.';
    return;
  }

  settingPassword.value = true;

  try {
    const result = await useInternalLumen().security.setPassword({ 
      password: password.value 
    });

    if (result?.ok) {
      passwordSet.value = true;
      password.value = '';
      confirmPassword.value = '';

      await moveToPostPasswordStep();
    } else {
      passwordError.value = result?.error || 'Failed to set password.';
    }
  } catch (e: any) {
    passwordError.value = e?.message || 'Failed to set password.';
  } finally {
    settingPassword.value = false;
  }
}

async function moveToPostPasswordStep() {
  const profilesApi = useInternalLumen()?.profiles;
  if (!profilesApi || typeof profilesApi.getActive !== 'function') {
    walletError.value = 'Profiles API not available.';
    step.value = 'creating-wallet';
    return;
  }

  const profile = await profilesApi.getActive();
  if (!profile || profile?.role === 'guest') {
    step.value = 'profile-name';
    if (!profileName.value.trim()) {
      profileName.value = '';
    }
    return;
  }

  step.value = 'creating-wallet';
  await createWallet();
}

async function handleProfileNameSubmit() {
  profileNameError.value = '';
  if (!String(profileName.value || '').trim()) {
    profileNameError.value = 'Profile name is required.';
    return;
  }
  step.value = 'creating-wallet';
  await createWallet();
}

async function createWallet() {
  creatingWallet.value = true;
  walletError.value = '';
  walletCreated.value = false;

  try {
    const profilesApi = useInternalLumen()?.profiles;
    if (!profilesApi) {
      walletError.value = 'Profiles API not available.';
      return;
    }

    let profile = await profilesApi.getActive();
    const needsRealProfile = !profile || profile.role === 'guest';

    // First launch requires a real profile before any wallet or Drive data exists.
    if (needsRealProfile) {
      const requestedName = String(profileName.value || '').trim();
      if (!requestedName) {
        step.value = 'profile-name';
        profileNameError.value = 'Profile name is required.';
        return;
      }
      const created = await createProfile(requestedName);
      if (!created) {
        walletError.value = 'Failed to create a user profile.';
        return;
      }
      await initProfiles();
      profile = await profilesApi.getActive();
      if (!profile || profile.role === 'guest') {
        walletError.value = 'Failed to create the first profile.';
        return;
      }
    }

    const profileId = String(profile.id || '').trim();
    if (!profileId) {
      walletError.value = 'No active profile found.';
      return;
    }

    // Check if wallet already exists
    const walletCheck = await profilesApi.isWalletFullyCreated(profileId);
    
    if (walletCheck?.ok) {
      // Wallet already exists
      walletCreated.value = true;
      step.value = 'backup';
      return;
    }

    // Refresh profile list to trigger wallet creation (ensureWalletForProfile)
    await profilesApi.list();

    // Wait a bit for wallet creation to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify wallet was created
    const verifyCheck = await profilesApi.isWalletFullyCreated(profileId);
    
    if (verifyCheck?.ok) {
      walletCreated.value = true;
      step.value = 'backup';
    } else {
      const errorMessages: Record<string, string> = {
        'guest_profile_no_wallet': 'Guest mode cannot hold a wallet. Please try again.',
        'wallet_address_missing': 'Wallet address was not created.',
        'keystore_missing': 'Wallet keystore was not created.',
        'keystore_invalid': 'Wallet data is invalid.',
        'keystore_read_failed': 'Wallet data could not be read.',
      };
      walletError.value =
        errorMessages[String(verifyCheck?.error || '')] ||
        verifyCheck?.error ||
        'Wallet creation failed. Please try again.';
    }
  } catch (e: any) {
    walletError.value = e?.message || 'Failed to create wallet.';
  } finally {
    creatingWallet.value = false;
  }
}

async function handleExportBackup() {
  backupError.value = '';
  backupSuccess.value = '';
  exportingBackup.value = true;

  try {
    const profileId = activeProfileId.value;

    if (!profileId) {
      backupError.value = 'No active profile found.';
      return;
    }

    // CRITICAL: Validate wallet is fully created before allowing backup
    const walletCheck = await useInternalLumen().profiles.isWalletFullyCreated(profileId);
    
    if (!walletCheck?.ok) {
      const errorMessages: Record<string, string> = {
        'guest_profile_no_wallet': 'Guest profiles cannot be backed up. Please create a user profile.',
        'wallet_address_missing': 'No wallet found. Please create a wallet first.',
        'keystore_missing': 'Wallet not fully created. Please complete wallet setup.',
        'keystore_invalid': 'Wallet data is corrupted. Please create a new wallet.',
        'keystore_read_failed': 'Unable to read wallet data. Please try again.'
      };
      
      backupError.value = errorMessages[walletCheck.error] || 'Wallet is not ready for backup.';
      return;
    }

    const api = useInternalLumen()?.profiles;
    if (!api || typeof api.exportBackup !== 'function') {
      backupError.value = 'Backup API not available.';
      return;
    }

    const result = await api.exportBackup(profileId);

    if (result?.ok) {
      backupSuccess.value = result.path 
        ? `Backup saved to: ${result.path}`
        : 'Backup exported successfully!';
      
      setTimeout(() => {
        step.value = 'complete';
      }, 1500);
    } else {
      // Handle specific error messages from backend
      if (result?.message) {
        backupError.value = result.message;
      } else {
        const errorMessages: Record<string, string> = {
          'wallet_not_created': 'No wallet found. Please create a wallet first.',
          'wallet_incomplete': 'Wallet creation is incomplete. Please try again.',
          'invalid_password': 'Invalid password. Please try again.',
          'password_required_for_export': 'Password is required to export backup.',
          'canceled': 'Backup export was canceled.'
        };
        backupError.value = errorMessages[result?.error] || 'Failed to export backup.';
      }
    }
  } catch (e: any) {
    backupError.value = e?.message || 'Failed to export backup.';
  } finally {
    exportingBackup.value = false;
  }
}

function handleComplete() {
  emit('complete');
}

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return;

    try {
      const securityApi = useInternalLumen()?.security;
      const profilesApi = useInternalLumen()?.profiles;
      if (!securityApi || !profilesApi) return;

      const status = await securityApi.getStatus?.();
      const hasPassword = !!(status?.passwordEnabled && status?.hasPassword);
      if (!hasPassword) return;

      passwordSet.value = true;
      await moveToPostPasswordStep();
    } catch {
      // ignore modal bootstrap errors
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.onboarding-modal {
  width: 90%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 2rem 2rem 1.5rem;
  text-align: center;
  border-bottom: var(--border-width) solid var(--border-color);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.modal-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.modal-body {
  padding: 2rem;
  flex: 1;
  overflow-y: auto;
}

.modal-body p {
  color: var(--text-primary);
}

.onboarding-step {
  animation: fadeIn 0.3s ease-in-out;
}

.onboarding-step p {
  color: var(--text-primary);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.warning-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(var(--ios-orange-rgb), 0.15);
  border: 1px solid rgba(var(--ios-orange-rgb), 0.3);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.warning-content {
  flex: 1;
  color: var(--text-primary);
}

.warning-content p {
  color: var(--text-primary);
}

.success-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--fill-success);
  border: 1px solid rgba(var(--ios-green-rgb), 0.3);
  border-radius: 8px;
  color: var(--text-primary);
}

.success-box p {
  color: var(--text-primary);
}

.success-box-large {
  text-align: center;
  padding: 2rem 1rem;
}

.info-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.info-card {
  padding: 1.5rem;
  border: var(--border-width) solid var(--border-color);
  border-radius: 12px;
  text-align: center;
  transition: all 0.2s;
  background: var(--bg-secondary);
}

.info-card h4,
.info-card p {
  color: var(--text-primary);
}

.info-card:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 4px 12px rgba(var(--ios-blue-rgb), 0.1);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: var(--text-primary);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: var(--border-width) solid var(--border-color);
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
  background: var(--card-bg);
  color: var(--text-primary);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(var(--ios-blue-rgb), 0.1);
}

.error-message {
  display: block;
  padding: 0.75rem;
  background: var(--fill-error);
  border: 1px solid rgba(var(--ios-red-rgb), 0.3);
  border-radius: 6px;
  color: var(--text-primary);
}

.success-message {
  display: block;
  padding: 0.75rem;
  background: var(--fill-success);
  border: 1px solid rgba(var(--ios-green-rgb), 0.3);
  border-radius: 6px;
  color: var(--text-primary);
}

.reminder-box {
  margin-top: 2rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.reminder-box p,
.reminder-list {
  color: var(--text-primary);
}

.reminder-list {
  margin: 0;
  padding-left: 1.5rem;
}

.reminder-list li {
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.reminder-list li:last-child {
  margin-bottom: 0;
}

.modal-footer {
  padding: 1.5rem 2rem;
  border-top: var(--border-width) solid var(--border-color);
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-modal-primary,
.btn-modal-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-modal-primary {
  background: var(--gradient-primary);
  color: white;
}

.btn-modal-primary:hover:not(:disabled) {
  background: var(--gradient-primary-hover);
}


.btn-modal-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: var(--border-width) solid var(--border-color);
}

.btn-modal-secondary:hover {
  background: var(--bg-secondary);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(20px);
}
</style>
