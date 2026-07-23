<template>
  <UiModal :model-value="visible" panel-class="walletonboard-modal w-90pct max-w-560px" :closable="false" @update:model-value="() => {}">
    <template #header>
      <div class="walletonboard-header text-center">
        <div class="walletonboard-header-icon flex-align-justify-center mb-16px">
          <Shield :size="32" class="color-primary" />
        </div>
        <h2 class="walletonboard-title color-text-primary txt-weight-light text-24px m-0px mb-8px">
          {{ requiresProfileCreation ? "Create Your First Profile" : "Protect Your Wallet" }}
        </h2>
        <p class="walletonboard-subtitle color-text-secondary m-0px text-14px">
          {{
            requiresProfileCreation
              ? "A profile is required to use Drive, Wallet, and personal storage."
              : "Your wallet is local and self-custodial"
          }}
        </p>
      </div>
    </template>
          <div v-if="step === 'intro'" class="walletonboard-step animate-walletonboard-fade-in">
            <div class="walletonboard-warning-box flex gap-12px p-16px mb-24px border-radius-8px bg-ios-orange-a15 border-1-ios-orange-a30">
              <AlertCircle :size="20" class="color-warning" />
              <div class="flex-1 color-text-primary">
                <p class="text-12px line-height-12 txt-weight-strong m-0px">Important: No one can recover your wallet</p>
                <p class="text-11px line-height-12 color-gray-blue mt-4px m-0px">
                  Lumen is a self-custodial wallet. If you lose access to your wallet without backing it up,
                  your funds are permanently lost. We cannot help you recover them.
                </p>
              </div>
            </div>

            <div class="walletonboard-info-cards gap-16px grid grid-cols-1fr-1fr">
              <div class="walletonboard-info-card color-text-primary p-24px border-radius-12px text-center border-default transition-all-02 bg-secondary hover-border-accent shadow-0-4-12-ios-blue-a10-hover">
                <Lock :size="20" class="color-primary" />
                <h4 class="text-12px line-height-12 txt-weight-strong mt-8px m-0px">Set a Password</h4>
                <p class="text-11px line-height-12 color-gray-blue mt-4px m-0px">
                  Protect your wallet with a strong password
                </p>
              </div>
              <div class="walletonboard-info-card color-text-primary p-24px border-radius-12px text-center border-default transition-all-02 bg-secondary hover-border-accent shadow-0-4-12-ios-blue-a10-hover">
                <Download :size="20" class="color-primary" />
                <h4 class="text-12px line-height-12 txt-weight-strong mt-8px m-0px">Backup Your Wallet</h4>
                <p class="text-11px line-height-12 color-gray-blue mt-4px m-0px">
                  Export and save your wallet backup file securely
                </p>
              </div>
            </div>
          </div>

          <div v-else-if="step === 'password'" class="walletonboard-step animate-walletonboard-fade-in">
            <p class="text-12px line-height-12 color-gray-blue mb-16px">
              Create a strong password to protect your wallet. You'll need this password to send transactions.
            </p>

            <div class="walletonboard-group mb-24px">
              <label class="block text-11px line-height-12 txt-weight-strong mb-4px color-text-primary">Password (minimum 8 characters)</label>
              <UiInput bg-class="bg-card" padding-class="p-12px" :focus-ring="false" v-model="password"
               
               
                placeholder="Enter password"
                @keyup.enter="handlePasswordSubmit" class="walletonboard-input border-default focus-ring-blue placeholder-tertiary" />
            </div>

            <div class="walletonboard-group mb-24px">
              <label class="block text-11px line-height-12 txt-weight-strong mb-4px color-text-primary">Confirm Password</label>
              <UiInput bg-class="bg-card" padding-class="p-12px" :focus-ring="false" v-model="confirmPassword"
               
               
                placeholder="Confirm password"
                @keyup.enter="handlePasswordSubmit" class="walletonboard-input border-default focus-ring-blue placeholder-tertiary" />
            </div>

            <div v-if="passwordError" class="walletonboard-error-message block text-11px line-height-12 color-error mt-8px color-text-primary p-12px bg-fill-error border-radius-6px border-1-ios-red-a30">
              {{ passwordError }}
            </div>
          </div>

          <div v-else-if="step === 'profile-name'" class="walletonboard-step animate-walletonboard-fade-in">
            <div class="walletonboard-success-box flex-align-center color-text-primary gap-12px p-16px bg-fill-success border-radius-8px border-1-ios-green-a30" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="text-12px line-height-12 m-0px">Password set successfully!</p>
            </div>

            <p class="text-12px line-height-12 color-gray-blue mt-16px mb-16px">
              Choose a name for your first profile before creating your wallet.
            </p>

            <div class="walletonboard-group mb-24px">
              <label class="block text-11px line-height-12 txt-weight-strong mb-4px color-text-primary">Profile name</label>
              <UiInput bg-class="bg-card" padding-class="p-12px" :focus-ring="false" v-model="profileName"
               
               
                placeholder="Enter a profile name"
                maxlength="64"
                @keyup.enter="handleProfileNameSubmit" class="walletonboard-input border-default focus-ring-blue placeholder-tertiary" />
            </div>

            <div v-if="profileNameError" class="walletonboard-error-message block text-11px line-height-12 color-error mt-8px color-text-primary p-12px bg-fill-error border-radius-6px border-1-ios-red-a30">
              {{ profileNameError }}
            </div>
          </div>

          <div v-else-if="step === 'creating-wallet'" class="walletonboard-step animate-walletonboard-fade-in">
            <div class="walletonboard-success-box flex-align-center color-text-primary gap-12px p-16px bg-fill-success border-radius-8px border-1-ios-green-a30" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="text-12px line-height-12 m-0px">Password set successfully!</p>
            </div>

            <div>
              <div v-if="creatingWallet" class="text-center">
                <UiSpinner size="lg" />
                <h3 class="text-20px line-height-12 txt-weight-strong mt-16px m-0px color-text-primary">Creating Your Wallet</h3>
                <p class="text-12px line-height-12 color-gray-blue mt-8px m-0px">
                  Generating secure keys and wallet address...
                </p>
              </div>

              <div v-else-if="walletCreated" class="text-center">
                <CheckCircle :size="48" class="color-success" />
                <h3 class="text-20px line-height-12 txt-weight-strong mt-16px m-0px color-text-primary">Wallet Created!</h3>
                <p class="text-12px line-height-12 color-gray-blue mt-8px m-0px">
                  Your wallet is ready. Let's back it up to keep it safe.
                </p>
              </div>

              <div v-else-if="walletError" class="text-center">
                <AlertCircle :size="48" class="color-error" />
                <h3 class="text-20px line-height-12 txt-weight-strong mt-16px m-0px color-text-primary">Wallet Creation Failed</h3>
                <p class="text-12px line-height-12 color-gray-blue mt-8px m-0px">
                  {{ walletError }}
                </p>
                <UiButton variant="secondary" @click="createWallet" class="hover-bg-secondary">
                  Try Again
                </UiButton>
              </div>
            </div>
          </div>

          <div v-else-if="step === 'backup'" class="walletonboard-step animate-walletonboard-fade-in">
            <div class="walletonboard-success-box flex-align-center color-text-primary gap-12px p-16px bg-fill-success border-radius-8px border-1-ios-green-a30" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="text-12px line-height-12 m-0px">Password set successfully!</p>
            </div>

            <p class="text-12px line-height-12 color-gray-blue mt-16px mb-16px">
              Now, backup your wallet to a secure location. Keep this backup file safe - you'll need it to restore your wallet if you lose access.
            </p>

            <div class="walletonboard-warning-box flex gap-12px p-16px mb-24px border-radius-8px bg-ios-orange-a15 border-1-ios-orange-a30">
              <AlertCircle :size="20" class="color-warning" />
              <div class="flex-1 color-text-primary">
                <p class="text-11px line-height-12 m-0px">
                  Store your backup in a secure location like an encrypted USB drive or password manager.
                  Never share it with anyone.
                </p>
              </div>
            </div>

            <div v-if="backupError" class="walletonboard-error-message block text-11px line-height-12 color-error mt-8px color-text-primary p-12px bg-fill-error border-radius-6px border-1-ios-red-a30">
              {{ backupError }}
            </div>

            <div v-if="backupSuccess" class="walletonboard-success-message block text-11px line-height-12 color-success mt-8px color-text-primary p-12px bg-fill-success border-radius-6px border-1-ios-green-a30">
              {{ backupSuccess }}
            </div>
          </div>

          <div v-else-if="step === 'complete'" class="walletonboard-step animate-walletonboard-fade-in">
            <div class="walletonboard-success-box-large text-center py-32px px-16px">
              <CheckCircle :size="48" class="color-success" />
              <h3 class="text-20px line-height-12 txt-weight-strong mt-16px m-0px color-text-primary">All Set!</h3>
              <p class="text-12px line-height-12 color-gray-blue mt-8px m-0px">
                Your wallet is now protected. Remember to keep your password and backup file safe.
              </p>
            </div>

            <div class="walletonboard-reminder-box mt-32px p-24px border-radius-12px bg-secondary">
              <p class="text-11px line-height-12 txt-weight-strong m-0px mb-8px color-text-primary">Remember:</p>
              <ul class="text-11px line-height-12 color-gray-blue m-0px pl-24px">
                <li class="mb-8px">Never share your password or backup file</li>
                <li class="mb-8px">Store your backup in multiple secure locations</li>
                <li class="mb-8px">You'll need your password for all transactions</li>
                <li>No one can recover your wallet if you lose both</li>
              </ul>
            </div>
          </div>
    <template #footer>
      <UiButton variant="secondary" v-if="step === 'intro' && !requiresProfileCreation"
        @click="handleSkip" class="hover-bg-secondary">
        Skip for now
      </UiButton>
      <UiButton variant="primary" v-if="step === 'intro'"
        @click="step = 'password'" class="walletonboard-btn-primary disabled-fade-50">
        Get Started
      </UiButton>

      <UiButton variant="secondary" v-if="step === 'password'"
        @click="step = 'intro'" class="hover-bg-secondary">
        Back
      </UiButton>
      <UiButton variant="primary" v-if="step === 'password'"
        :disabled="settingPassword"
        @click="handlePasswordSubmit" class="walletonboard-btn-primary disabled-fade-50">
        <UiSpinner v-if="settingPassword" size="sm" />
        <span>{{ settingPassword ? 'Setting Password...' : 'Set Password' }}</span>
      </UiButton>

      <UiButton variant="primary" v-if="step === 'profile-name'"
        @click="handleProfileNameSubmit" class="walletonboard-btn-primary disabled-fade-50">
        Continue
      </UiButton>

      <UiButton variant="secondary" v-if="step === 'backup'"
        @click="handleSkipBackup" class="hover-bg-secondary">
        Skip Backup
      </UiButton>
      <UiButton variant="primary" v-if="step === 'backup'"
        :disabled="exportingBackup"
        @click="handleExportBackup" class="walletonboard-btn-primary disabled-fade-50">
        <UiSpinner v-if="exportingBackup" size="sm" />
        <span>{{ exportingBackup ? 'Exporting...' : 'Export Backup' }}</span>
      </UiButton>

      <UiButton variant="primary" v-if="step === 'complete'"
        @click="handleComplete" class="walletonboard-btn-primary disabled-fade-50">
        Start Using Lumen
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiInput from '../ui/UiInput.vue';
import UiButton from '../ui/UiButton.vue';
import UiModal from '../ui/UiModal.vue';
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

