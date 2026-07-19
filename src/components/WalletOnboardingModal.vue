<template>
  <Transition name="walletonboard-transition">
    <div v-if="visible" class="walletonboard-overlay overlay-scrim backdrop-blur-4px" @click="handleOverlayClick">
      <div class="walletonboard-content walletonboard-modal bg-card flex flex-column overflow-y-auto" @click.stop>
        <div class="walletonboard-header text-center">
          <div class="walletonboard-header-icon flex-align-justify-center margin-bottom-100">
            <Shield :size="32" class="color-primary" />
          </div>
          <h2 class="walletonboard-title color-text-primary">
            {{ requiresProfileCreation ? "Create Your First Profile" : "Protect Your Wallet" }}
          </h2>
          <p class="walletonboard-subtitle color-text-secondary">
            {{
              requiresProfileCreation
                ? "A profile is required to use Drive, Wallet, and personal storage."
                : "Your wallet is local and self-custodial"
            }}
          </p>
        </div>

        <div class="walletonboard-body flex-1 overflow-y-auto">
          <div v-if="step === 'intro'" class="walletonboard-step">
            <div class="walletonboard-warning-box flex">
              <AlertCircle :size="20" class="color-warning" />
              <div class="flex-1 color-text-primary">
                <p class="txt-sm txt-weight-strong margin-0">Important: No one can recover your wallet</p>
                <p class="txt-xs color-gray-blue margin-top-25 margin-0">
                  Lumen is a self-custodial wallet. If you lose access to your wallet without backing it up,
                  your funds are permanently lost. We cannot help you recover them.
                </p>
              </div>
            </div>

            <div class="walletonboard-info-cards">
              <div class="walletonboard-info-card color-text-primary">
                <Lock :size="20" class="color-primary" />
                <h4 class="txt-sm txt-weight-strong margin-top-50 margin-0">Set a Password</h4>
                <p class="txt-xs color-gray-blue margin-top-25 margin-0">
                  Protect your wallet with a strong password
                </p>
              </div>
              <div class="walletonboard-info-card color-text-primary">
                <Download :size="20" class="color-primary" />
                <h4 class="txt-sm txt-weight-strong margin-top-50 margin-0">Backup Your Wallet</h4>
                <p class="txt-xs color-gray-blue margin-top-25 margin-0">
                  Export and save your wallet backup file securely
                </p>
              </div>
            </div>
          </div>

          <div v-else-if="step === 'password'" class="walletonboard-step">
            <p class="txt-sm color-gray-blue margin-bottom-100">
              Create a strong password to protect your wallet. You'll need this password to send transactions.
            </p>

            <div class="walletonboard-group">
              <label class="block txt-xs txt-weight-strong margin-bottom-25 color-text-primary">Password (minimum 8 characters)</label>
              <input
                v-model="password"
                type="password"
                class="walletonboard-input w-full color-text-primary outline-none"
                placeholder="Enter password"
                @keyup.enter="handlePasswordSubmit"
              />
            </div>

            <div class="walletonboard-group">
              <label class="block txt-xs txt-weight-strong margin-bottom-25 color-text-primary">Confirm Password</label>
              <input
                v-model="confirmPassword"
                type="password"
                class="walletonboard-input w-full color-text-primary outline-none"
                placeholder="Confirm password"
                @keyup.enter="handlePasswordSubmit"
              />
            </div>

            <div v-if="passwordError" class="walletonboard-error-message block txt-xs color-red-base margin-top-50 color-text-primary">
              {{ passwordError }}
            </div>
          </div>

          <div v-else-if="step === 'profile-name'" class="walletonboard-step">
            <div class="walletonboard-success-box flex-align-center color-text-primary" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="txt-sm margin-0">Password set successfully!</p>
            </div>

            <p class="txt-sm color-gray-blue margin-top-100 margin-bottom-100">
              Choose a name for your first profile before creating your wallet.
            </p>

            <div class="walletonboard-group">
              <label class="block txt-xs txt-weight-strong margin-bottom-25 color-text-primary">Profile name</label>
              <input
                v-model="profileName"
                type="text"
                class="walletonboard-input w-full color-text-primary outline-none"
                placeholder="Enter a profile name"
                maxlength="64"
                @keyup.enter="handleProfileNameSubmit"
              />
            </div>

            <div v-if="profileNameError" class="walletonboard-error-message block txt-xs color-red-base margin-top-50 color-text-primary">
              {{ profileNameError }}
            </div>
          </div>

          <div v-else-if="step === 'creating-wallet'" class="walletonboard-step">
            <div class="walletonboard-success-box flex-align-center color-text-primary" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="txt-sm margin-0">Password set successfully!</p>
            </div>

            <div>
              <div v-if="creatingWallet" class="text-center">
                <UiSpinner size="lg" />
                <h3 class="txt-lg txt-weight-strong margin-top-100 margin-0 color-text-primary">Creating Your Wallet</h3>
                <p class="txt-sm color-gray-blue margin-top-50 margin-0">
                  Generating secure keys and wallet address...
                </p>
              </div>

              <div v-else-if="walletCreated" class="text-center">
                <CheckCircle :size="48" class="color-success" />
                <h3 class="txt-lg txt-weight-strong margin-top-100 margin-0 color-text-primary">Wallet Created!</h3>
                <p class="txt-sm color-gray-blue margin-top-50 margin-0">
                  Your wallet is ready. Let's back it up to keep it safe.
                </p>
              </div>

              <div v-else-if="walletError" class="text-center">
                <AlertCircle :size="48" class="color-red-base" />
                <h3 class="txt-lg txt-weight-strong margin-top-100 margin-0 color-text-primary">Wallet Creation Failed</h3>
                <p class="txt-sm color-gray-blue margin-top-50 margin-0">
                  {{ walletError }}
                </p>
                <button class="walletonboard-btn-secondary flex-align-center margin-top-100 cursor-pointer gap-50 color-text-secondary" @click="createWallet">
                  Try Again
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="step === 'backup'" class="walletonboard-step">
            <div class="walletonboard-success-box flex-align-center color-text-primary" v-if="passwordSet">
              <CheckCircle :size="20" class="color-success" />
              <p class="txt-sm margin-0">Password set successfully!</p>
            </div>

            <p class="txt-sm color-gray-blue margin-top-100 margin-bottom-100">
              Now, backup your wallet to a secure location. Keep this backup file safe - you'll need it to restore your wallet if you lose access.
            </p>

            <div class="walletonboard-warning-box flex">
              <AlertCircle :size="20" class="color-warning" />
              <div class="flex-1 color-text-primary">
                <p class="txt-xs margin-0">
                  Store your backup in a secure location like an encrypted USB drive or password manager.
                  Never share it with anyone.
                </p>
              </div>
            </div>

            <div v-if="backupError" class="walletonboard-error-message block txt-xs color-red-base margin-top-50 color-text-primary">
              {{ backupError }}
            </div>

            <div v-if="backupSuccess" class="walletonboard-success-message block txt-xs color-success margin-top-50 color-text-primary">
              {{ backupSuccess }}
            </div>
          </div>

          <div v-else-if="step === 'complete'" class="walletonboard-step">
            <div class="walletonboard-success-box-large">
              <CheckCircle :size="48" class="color-success" />
              <h3 class="txt-lg txt-weight-strong margin-top-100 margin-0 color-text-primary">All Set!</h3>
              <p class="txt-sm color-gray-blue margin-top-50 margin-0">
                Your wallet is now protected. Remember to keep your password and backup file safe.
              </p>
            </div>

            <div class="walletonboard-reminder-box">
              <p class="txt-xs txt-weight-strong margin-0 margin-bottom-50 color-text-primary">Remember:</p>
              <ul class="walletonboard-reminder-list txt-xs color-gray-blue">
                <li>Never share your password or backup file</li>
                <li>Store your backup in multiple secure locations</li>
                <li>You'll need your password for all transactions</li>
                <li>No one can recover your wallet if you lose both</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="walletonboard-footer flex">
          <button
            v-if="step === 'intro' && !requiresProfileCreation"
            class="walletonboard-btn-secondary flex-align-center cursor-pointer gap-50 color-text-secondary"
            @click="handleSkip"
          >
            Skip for now
          </button>
          <button
            v-if="step === 'intro'"
            class="walletonboard-btn-primary disabled-fade-60 flex-align-center cursor-pointer border-none gap-50"
            @click="step = 'password'"
          >
            Get Started
          </button>

          <button
            v-if="step === 'password'"
            class="walletonboard-btn-secondary flex-align-center cursor-pointer gap-50 color-text-secondary"
            @click="step = 'intro'"
          >
            Back
          </button>
          <button
            v-if="step === 'password'"
            class="walletonboard-btn-primary disabled-fade-60 flex-align-center cursor-pointer border-none gap-50"
            :disabled="settingPassword"
            @click="handlePasswordSubmit"
          >
            <UiSpinner v-if="settingPassword" size="sm" />
            <span>{{ settingPassword ? 'Setting Password...' : 'Set Password' }}</span>
          </button>

          <button
            v-if="step === 'profile-name'"
            class="walletonboard-btn-primary disabled-fade-60 flex-align-center cursor-pointer border-none gap-50"
            @click="handleProfileNameSubmit"
          >
            Continue
          </button>

          <button
            v-if="step === 'backup'"
            class="walletonboard-btn-secondary flex-align-center cursor-pointer gap-50 color-text-secondary"
            @click="handleSkipBackup"
          >
            Skip Backup
          </button>
          <button
            v-if="step === 'backup'"
            class="walletonboard-btn-primary disabled-fade-60 flex-align-center cursor-pointer border-none gap-50"
            :disabled="exportingBackup"
            @click="handleExportBackup"
          >
            <UiSpinner v-if="exportingBackup" size="sm" />
            <span>{{ exportingBackup ? 'Exporting...' : 'Export Backup' }}</span>
          </button>

          <button
            v-if="step === 'complete'"
            class="walletonboard-btn-primary disabled-fade-60 flex-align-center cursor-pointer border-none gap-50"
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

