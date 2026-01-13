<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content onboarding-modal" @click.stop>
        <div class="modal-header">
          <div class="header-icon">
            <Shield :size="32" class="color-primary" />
          </div>
          <h2 class="modal-title">Protect Your Wallet</h2>
          <p class="modal-subtitle">Your wallet is local and self-custodial</p>
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
            v-if="step === 'intro'"
            class="btn-modal-secondary"
            @click="handleSkip"
          >
            Skip for now
          </button>
          <button
            v-if="step === 'intro'"
            class="btn-modal-primary"
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
            class="btn-modal-primary"
            :disabled="settingPassword"
            @click="handlePasswordSubmit"
          >
            <UiSpinner v-if="settingPassword" size="sm" />
            <span>{{ settingPassword ? 'Setting Password...' : 'Set Password' }}</span>
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
            class="btn-modal-primary"
            :disabled="exportingBackup"
            @click="handleExportBackup"
          >
            <UiSpinner v-if="exportingBackup" size="sm" />
            <span>{{ exportingBackup ? 'Exporting...' : 'Export Backup' }}</span>
          </button>

          <button
            v-if="step === 'complete'"
            class="btn-modal-primary"
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
import { ref } from 'vue';
import { Shield, Lock, Download, AlertCircle, CheckCircle } from 'lucide-vue-next';
import UiSpinner from '../ui/UiSpinner.vue';
import { activeProfileId } from '../internal/profilesStore';

type OnboardingStep = 'intro' | 'password' | 'backup' | 'complete';

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
const passwordSet = ref(false);
const settingPassword = ref(false);
const backupError = ref('');
const backupSuccess = ref('');
const exportingBackup = ref(false);

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
    const anyWindow = window as any;
    const result = await anyWindow.lumen.security.setPassword({ 
      password: password.value 
    });

    if (result?.ok) {
      passwordSet.value = true;
      password.value = '';
      confirmPassword.value = '';
      step.value = 'backup';
    } else {
      passwordError.value = result?.error || 'Failed to set password.';
    }
  } catch (e: any) {
    passwordError.value = e?.message || 'Failed to set password.';
  } finally {
    settingPassword.value = false;
  }
}

async function handleExportBackup() {
  backupError.value = '';
  backupSuccess.value = '';
  exportingBackup.value = true;

  try {
    const anyWindow = window as any;
    const profileId = activeProfileId.value;

    if (!profileId) {
      backupError.value = 'No active profile found.';
      return;
    }

    const api = anyWindow?.lumen?.profiles;
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
      backupError.value = result?.error || 'Failed to export backup.';
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
  background: white;
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 2rem 2rem 1.5rem;
  text-align: center;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
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
  color: var(--text-primary, #111827);
}

.modal-subtitle {
  font-size: 0.875rem;
  color: var(--gray-blue, #6b7280);
  margin: 0;
}

.modal-body {
  padding: 2rem;
  flex: 1;
  overflow-y: auto;
}

.onboarding-step {
  animation: fadeIn 0.3s ease-in-out;
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
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.warning-content {
  flex: 1;
}

.success-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  border-radius: 8px;
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
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  text-align: center;
  transition: all 0.2s;
}

.info-card:hover {
  border-color: var(--primary, #3b82f6);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: var(--text-primary, #111827);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message {
  display: block;
  padding: 0.75rem;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 6px;
}

.success-message {
  display: block;
  padding: 0.75rem;
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  border-radius: 6px;
}

.reminder-box {
  margin-top: 2rem;
  padding: 1.5rem;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 12px;
}

.reminder-list {
  margin: 0;
  padding-left: 1.5rem;
}

.reminder-list li {
  margin-bottom: 0.5rem;
}

.reminder-list li:last-child {
  margin-bottom: 0;
}

.modal-footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
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
  background: var(--primary, #3b82f6);
  color: white;
}

.btn-modal-primary:hover:not(:disabled) {
  background: var(--primary-dark, #2563eb);
}

.btn-modal-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-modal-secondary {
  background: transparent;
  color: var(--text-secondary, #6b7280);
  border: 1px solid var(--border-color, #e5e7eb);
}

.btn-modal-secondary:hover {
  background: var(--bg-secondary, #f9fafb);
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
