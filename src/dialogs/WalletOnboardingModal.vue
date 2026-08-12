<template>
  <UiModal :model-value="visible" panel-class="walletonboard-modal w-90pct max-w-560px" :closable="false" @update:model-value="() => {}">
    <template #header>
      <div class="text-center w-full">
        <UiIconBadge size-class="size-64px mx-auto" badge-class="bg-gradient-primary color-white shadow-primary mb-16px">
          <Shield :size="30" />
        </UiIconBadge>
        <h2 class="color-text-primary txt-weight-light text-24px m-0px mb-8px">
          {{ step === 'language'
            ? t('Choose your language')
            : requiresProfileCreation ? t('Create your first profile') : t('Protect your wallet') }}
        </h2>
        <p class="color-text-secondary m-0px text-14px">
          {{
            step === 'language'
              ? t('You can change this later in Settings.')
              : requiresProfileCreation
                ? t('A profile is required to use Drive, Wallet, and personal storage.')
                : t('Your wallet is local and self-custodial')
          }}
        </p>
      </div>
    </template>
          <div v-if="step === 'language'" class="animate-walletonboard-fade-in">
            <div class="grid grid-cols-1fr-1fr gap-8px overflow-y-auto max-h-280px pr-4px">
              <button
                v-for="option in locales"
                :key="option.code"
                type="button"
                class="w-full text-left cursor-pointer border-1 border-radius-10px bg-secondary color-text-primary text-14px py-10px px-12px transition-all-fast hover-bg-hover"
                :class="{ 'bg-primary-a10 border-color-primary': option.code === pendingLocale }"
                @click="pendingLocale = option.code"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div v-else-if="step === 'intro'" class="animate-walletonboard-fade-in">
            <UiWarningBox>
              <p class="text-14px txt-weight-medium m-0px">{{ t('Important: no one can recover your wallet') }}</p>
              <p class="text-13px line-height-15 color-text-tertiary mt-4px m-0px">
                {{ t('Lumen is a self-custodial wallet. If you lose access to your wallet without backing it up, your funds are permanently lost. We cannot help you recover them.') }}
              </p>
            </UiWarningBox>

            <div class="gap-16px grid grid-cols-1fr-1fr">
              <UiCenteredInfoCard :title="t('Set a password')" :description="t('Protect your wallet with a strong password')">
                <template #icon><Lock :size="20" class="color-primary" /></template>
              </UiCenteredInfoCard>
              <UiCenteredInfoCard :title="t('Back up your wallet')" :description="t('Export and save your wallet backup file securely')">
                <template #icon><Download :size="20" class="color-primary" /></template>
              </UiCenteredInfoCard>
            </div>
          </div>

          <div v-else-if="step === 'password'" class="animate-walletonboard-fade-in">
            <p class="text-14px line-height-15 color-text-tertiary mb-16px">
              {{ t("Create a strong password to protect your wallet. You'll need it to unlock Lumen - when you start the app, and again if your session times out from inactivity.") }}
            </p>

            <UiFormGroup :label="t('Password ({min} characters minimum)', { min: MIN_PASSWORD_LENGTH })" wrapper-class="mb-24px">
              <UiInput type="password" bg-class="bg-card" padding-class="p-12px" :focus-ring="false" v-model="password"
                :placeholder="t('Enter password')"
                @keyup.enter="handlePasswordSubmit" class="border-default focus-ring-blue placeholder-tertiary" />
            </UiFormGroup>

            <UiFormGroup :label="t('Confirm password')" wrapper-class="mb-24px">
              <UiInput type="password" bg-class="bg-card" padding-class="p-12px" :focus-ring="false" v-model="confirmPassword"
                :placeholder="t('Confirm password')"
                @keyup.enter="handlePasswordSubmit" class="border-default focus-ring-blue placeholder-tertiary" />
            </UiFormGroup>

            <UiBanner v-if="passwordError" variant="error" class="mt-8px">{{ passwordError }}</UiBanner>
          </div>

          <div v-else-if="step === 'profile-name'" class="animate-walletonboard-fade-in">
            <UiSuccessBanner v-if="passwordSet" :message="t('Password set successfully.')" />

            <p class="text-14px line-height-15 color-text-tertiary mt-16px mb-16px">
              {{ t('Choose a name for your first profile before creating your wallet.') }}
            </p>

            <UiFormGroup :label="t('Profile name')" wrapper-class="mb-24px">
              <UiInput bg-class="bg-card" padding-class="p-12px" :focus-ring="false" v-model="profileName"
                :placeholder="t('Enter a profile name')"
                maxlength="64"
                @keyup.enter="handleProfileNameSubmit" class="border-default focus-ring-blue placeholder-tertiary" />
            </UiFormGroup>

            <UiBanner v-if="profileNameError" variant="error" class="mt-8px">{{ profileNameError }}</UiBanner>
          </div>

          <div v-else-if="step === 'creating-wallet'" class="animate-walletonboard-fade-in">
            <UiSuccessBanner v-if="passwordSet" :message="t('Password set successfully.')" />

            <div>
              <UiResultState v-if="creatingWallet" :title="t('Creating your wallet')" :description="t('Generating secure keys and wallet address…')">
                <template #icon><UiSpinner size="lg" /></template>
              </UiResultState>

              <UiResultState v-else-if="walletCreated" :title="t('Wallet created')" :description="t('Your wallet is ready. Let\'s back it up to keep it safe.')">
                <template #icon><CheckCircle :size="48" class="color-success" /></template>
              </UiResultState>

              <UiResultState v-else-if="walletError" :title="t('Wallet creation failed')" :description="walletError">
                <template #icon><AlertCircle :size="48" class="color-error" /></template>
                <template #action>
                  <UiButton variant="secondary" @click="createWallet" class="hover-bg-secondary">
                    {{ t('Try again') }}
                  </UiButton>
                </template>
              </UiResultState>
            </div>
          </div>

          <div v-else-if="step === 'backup'" class="animate-walletonboard-fade-in">
            <UiSuccessBanner v-if="passwordSet" :message="t('Password set successfully.')" />

            <p class="text-14px line-height-15 color-text-tertiary mt-16px mb-16px">
              {{ t("Now, backup your wallet to a secure location. Keep this backup file safe - you'll need it to restore your wallet if you lose access.") }}
            </p>

            <UiWarningBox>
              <p class="text-13px line-height-15 m-0px">
                {{ t('Store your backup in a secure location like an encrypted USB drive or password manager. Never share it with anyone.') }}
              </p>
            </UiWarningBox>

            <UiBanner v-if="backupError" variant="error" class="mt-8px">{{ backupError }}</UiBanner>

            <UiBanner v-if="backupSuccess" variant="success" class="mt-8px">{{ backupSuccess }}</UiBanner>
          </div>

          <div v-else-if="step === 'complete'" class="animate-walletonboard-fade-in">
            <UiResultState :title="t('All set')" :description="t('Your wallet is now protected. Remember to keep your password and backup file safe.')" wrapper-class="py-32px px-16px">
              <template #icon><CheckCircle :size="48" class="color-success" /></template>
            </UiResultState>

            <div class="mt-32px p-24px border-radius-12px bg-secondary">
              <p class="text-14px txt-weight-medium m-0px mb-12px color-text-primary">{{ t('Remember:') }}</p>
              <div class="flex flex-column gap-8px">
                <div v-for="item in completeReminders" :key="item" class="flex-align-start gap-8px text-13px line-height-14 color-text-tertiary">
                  <Check :size="14" class="color-success flex-shrink-0 mt-2px" />
                  <span>{{ item }}</span>
                </div>
              </div>
            </div>
          </div>
    <template #footer>
      <UiButton variant="primary" v-if="step === 'language'"
        @click="confirmLanguage" class="disabled-fade-50">
        {{ t('Continue') }}
      </UiButton>

      <UiButton variant="secondary" v-if="step === 'intro' && !requiresProfileCreation"
        @click="handleSkip" class="hover-bg-secondary">
        {{ t('Skip for now') }}
      </UiButton>
      <UiButton variant="primary" v-if="step === 'intro'"
        @click="step = 'password'" class="disabled-fade-50">
        {{ t('Get started') }}
      </UiButton>

      <UiButton variant="secondary" v-if="step === 'password'"
        @click="step = 'intro'" class="hover-bg-secondary">
        {{ t('Back') }}
      </UiButton>
      <UiButton variant="primary" v-if="step === 'password'"
        :disabled="settingPassword"
        @click="handlePasswordSubmit" class="disabled-fade-50">
        <UiSpinner v-if="settingPassword" size="sm" />
        <span>{{ settingPassword ? t('Setting password…') : t('Set a password') }}</span>
      </UiButton>

      <UiButton variant="primary" v-if="step === 'profile-name'"
        @click="handleProfileNameSubmit" class="disabled-fade-50">
        {{ t('Continue') }}
      </UiButton>

      <UiButton variant="secondary" v-if="step === 'backup'"
        @click="handleSkipBackup" class="hover-bg-secondary">
        {{ t('Skip backup') }}
      </UiButton>
      <UiButton variant="primary" v-if="step === 'backup'"
        :disabled="exportingBackup"
        @click="handleExportBackup" class="disabled-fade-50">
        <UiSpinner v-if="exportingBackup" size="sm" />
        <span>{{ exportingBackup ? t('Exporting…') : t('Export backup') }}</span>
      </UiButton>

      <UiButton variant="primary" v-if="step === 'complete'"
        @click="handleComplete" class="disabled-fade-50">
        {{ t('Start using Lumen') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { LOCALES, hasChosenLocale, setLocale, suggestedLocale, t } from '../stores/i18nStore';
import UiInput from '../ui/UiInput.vue';
import UiButton from '../ui/UiButton.vue';
import UiModal from '../ui/UiModal.vue';
import { computed, ref, watch } from 'vue';
import { Shield, Lock, Download, AlertCircle, CheckCircle, Check } from 'lucide-vue-next';
import UiSpinner from '../ui/UiSpinner.vue';
import UiSuccessBanner from '../ui/UiSuccessBanner.vue';
import UiResultState from '../ui/UiResultState.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiWarningBox from '../ui/UiWarningBox.vue';
import UiCenteredInfoCard from '../ui/UiCenteredInfoCard.vue';
import UiIconBadge from '../ui/UiIconBadge.vue';
import { activeProfileId, createProfile, initProfiles, profilesState } from '../stores/profilesStore';
import { useInternalLumen } from '../composables/useInternalLumen';
import type { OnboardingStep } from '../types/walletOnboardingModal';

import { errorMessage } from '../internal/services/coerce';
import { MIN_PASSWORD_LENGTH, isPasswordLongEnough } from '../internal/services/passwordPolicy';
const completeReminders = [
  t('Never share your password or backup file'),
  t('Store your backup in multiple secure locations'),
  t("You'll need your password for all transactions"),
  t('No one can recover your wallet if you lose both'),
];

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  complete: [];
  skip: [];
}>();

/**
 * The language question is skipped on every start after the first: a profile
 * inherits the language of the profile it was created from, so asking again
 * would be asking someone to repeat an answer the app already has.
 */
const step = ref<OnboardingStep>(hasChosenLocale() ? 'intro' : 'language');
const locales = LOCALES;
const pendingLocale = ref(suggestedLocale());

function confirmLanguage() {
  setLocale(pendingLocale.value, { chosen: true });
  step.value = 'intro';
}
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

function handleSkip() {
  emit('skip');
}

function handleSkipBackup() {
  step.value = 'complete';
}

async function handlePasswordSubmit() {
  passwordError.value = '';

  if (!isPasswordLongEnough(password.value)) {
    passwordError.value = t('Password must be at least {min} characters.', { min: MIN_PASSWORD_LENGTH });
    return;
  }

  if (password.value !== confirmPassword.value) {
    passwordError.value = t('Passwords do not match.');
    return;
  }

  settingPassword.value = true;

  try {
    const result = await useInternalLumen()?.security.setPassword({ 
      password: password.value 
    });

    if (result?.ok) {
      passwordSet.value = true;
      password.value = '';
      confirmPassword.value = '';

      await moveToPostPasswordStep();
    } else {
      passwordError.value = result?.error || t('Failed to set password.');
    }
  } catch (e) {
    passwordError.value = errorMessage(e, t('Failed to set password.'));
  } finally {
    settingPassword.value = false;
  }
}

async function moveToPostPasswordStep() {
  const profilesApi = useInternalLumen()?.profiles;
  if (!profilesApi || typeof profilesApi.getActive !== 'function') {
    walletError.value = t('Profiles API not available.');
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
    profileNameError.value = t('Profile name is required.');
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
      walletError.value = t('Profiles API not available.');
      return;
    }

    let profile = await profilesApi.getActive();
    const needsRealProfile = !profile || profile.role === 'guest';

    // First launch requires a real profile before any wallet or Drive data exists.
    if (needsRealProfile) {
      const requestedName = String(profileName.value || '').trim();
      if (!requestedName) {
        step.value = 'profile-name';
        profileNameError.value = t('Profile name is required.');
        return;
      }
      const created = await createProfile(requestedName);
      if (!created) {
        walletError.value = t('Failed to create a user profile.');
        return;
      }
      await initProfiles();
      profile = await profilesApi.getActive();
      if (!profile || profile.role === 'guest') {
        walletError.value = t('Failed to create the first profile.');
        return;
      }
    }

    const profileId = String(profile.id || '').trim();
    if (!profileId) {
      walletError.value = t('No active profile.');
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

    const verifyCheck = await profilesApi.isWalletFullyCreated(profileId);
    
    if (verifyCheck?.ok) {
      walletCreated.value = true;
      step.value = 'backup';
    } else {
      const errorMessages: Record<string, string> = {
        'guest_profile_no_wallet': t('Guest mode cannot hold a wallet. Please try again.'),
        'wallet_address_missing': t('Wallet address was not created.'),
        'keystore_missing': t('Wallet keystore was not created.'),
        'keystore_invalid': t('Wallet data is invalid.'),
        'keystore_read_failed': t('Wallet data could not be read.'),
      };
      walletError.value =
        errorMessages[String(verifyCheck?.error || '')] ||
        verifyCheck?.error ||
        t('Wallet creation failed. Please try again.');
    }
  } catch (e) {
    walletError.value = errorMessage(e, t('Failed to create wallet.'));
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
      backupError.value = t('No active profile.');
      return;
    }

    // CRITICAL: Validate wallet is fully created before allowing backup
    const walletCheck = await useInternalLumen()?.profiles.isWalletFullyCreated(profileId);
    
    if (!walletCheck?.ok) {
      const errorMessages: Record<string, string> = {
        'guest_profile_no_wallet': t('Guest profiles cannot be backed up. Please create a user profile.'),
        'wallet_address_missing': t('No wallet found. Please create a wallet first.'),
        'keystore_missing': t('Wallet not fully created. Please complete wallet setup.'),
        'keystore_invalid': t('Wallet data is corrupted. Please create a new wallet.'),
        'keystore_read_failed': t('Failed to read wallet data. Please try again.')
      };
      
      backupError.value = errorMessages[walletCheck.error] || t('Wallet is not ready for backup.');
      return;
    }

    const api = useInternalLumen()?.profiles;
    if (!api || typeof api.exportBackup !== 'function') {
      backupError.value = t('Backup API not available.');
      return;
    }

    const result = await api.exportBackup(profileId);

    if (result?.ok) {
      backupSuccess.value = result.path 
        ? `Backup saved to: ${result.path}`
        : t('Backup exported successfully.');
      
      setTimeout(() => {
        step.value = 'complete';
      }, 1500);
    } else {
      // Handle specific error messages from backend
      if (result?.message) {
        backupError.value = result.message;
      } else {
        const errorMessages: Record<string, string> = {
          'wallet_not_created': t('No wallet found. Please create a wallet first.'),
          'wallet_incomplete': t('Wallet creation is incomplete. Please try again.'),
          'invalid_password': t('Invalid password. Please try again.'),
          'password_required_for_export': t('Password is required to export backup.'),
          'canceled': t('Backup export was canceled.')
        };
        backupError.value = errorMessages[result?.error] || t('Failed to export the backup.');
      }
    }
  } catch (e) {
    backupError.value = errorMessage(e, t('Failed to export the backup.'));
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

