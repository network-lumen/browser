<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="password-modal-overlay" @click.self="handleCancel">
        <div class="password-modal">
          <div class="modal-header">
            <LockKeyhole :size="24" class="modal-icon" />
            <h3>Password Required</h3>
          </div>
          
          <p class="modal-message">
            {{ message || 'Enter your password to authorize this operation.' }}
          </p>
          
          <div class="modal-form">
            <input
              ref="passwordInput"
              type="password"
              class="password-input"
              v-model="password"
              placeholder="Enter password"
              :disabled="loading"
              @keyup.enter="handleSubmit"
              @keyup.escape="handleCancel"
            />
            
            <div v-if="error" class="modal-error">
              {{ error }}
            </div>
          </div>
          
          <div class="modal-actions">
            <button 
              class="btn-secondary"
              @click="handleCancel"
              :disabled="loading"
            >
              Cancel
            </button>
            <button 
              class="btn-primary"
              @click="handleSubmit"
              :disabled="loading || !password"
            >
              {{ loading ? 'Verifying...' : 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { LockKeyhole } from 'lucide-vue-next';

const props = defineProps<{
  visible: boolean;
  message?: string;
}>();

const emit = defineEmits<{
  (e: 'confirm', password: string): void;
  (e: 'cancel'): void;
}>();

const password = ref('');
const error = ref('');
const loading = ref(false);
const passwordInput = ref<HTMLInputElement | null>(null);

// Focus input when modal opens
watch(() => props.visible, async (isVisible) => {
  if (isVisible) {
    password.value = '';
    error.value = '';
    loading.value = false;
    await nextTick();
    passwordInput.value?.focus();
  }
});

async function handleSubmit() {
  if (!password.value || loading.value) return;
  
  error.value = '';
  loading.value = true;
  
  try {
    // Verify password with backend
    const result = await (window as any).lumen.security.verifyPassword({ password: password.value });
    
    if (result?.ok) {
      emit('confirm', password.value);
      password.value = '';
    } else {
      error.value = 'Incorrect password. Please try again.';
      password.value = '';
      await nextTick();
      passwordInput.value?.focus();
    }
  } catch (e: any) {
    error.value = e?.message || 'Failed to verify password.';
  } finally {
    loading.value = false;
  }
}

function handleCancel() {
  if (loading.value) return;
  password.value = '';
  error.value = '';
  emit('cancel');
}

// Expose methods for external control
defineExpose({
  setError: (msg: string) => { error.value = msg; },
  setLoading: (val: boolean) => { loading.value = val; }
});
</script>

<style scoped>
.password-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.password-modal {
  background: var(--card-bg, #1c1c1e);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  padding: 1.75rem;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.modal-icon {
  color: var(--accent-primary, #007aff);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.modal-message {
  margin: 0 0 1.25rem 0;
  font-size: 0.9rem;
  color: var(--text-secondary, #8e8e93);
  line-height: 1.4;
}

.modal-form {
  margin-bottom: 1.25rem;
}

.password-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--fill-tertiary, rgba(118, 118, 128, 0.12));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  font-size: 1rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.password-input:focus {
  border-color: var(--accent-primary, #007aff);
}

.password-input::placeholder {
  color: var(--text-tertiary, #636366);
}

.password-input:disabled {
  opacity: 0.6;
}

.modal-error {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 59, 48, 0.1);
  border-radius: 8px;
  color: var(--ios-red, #ff3b30);
  font-size: 0.85rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-secondary {
  padding: 0.6rem 1.25rem;
  background: var(--fill-tertiary, rgba(118, 118, 128, 0.12));
  color: var(--text-primary, #fff);
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-secondary:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.6rem 1.25rem;
  background: var(--accent-primary, #007aff);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .password-modal,
.modal-fade-leave-active .password-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .password-modal,
.modal-fade-leave-to .password-modal {
  transform: scale(0.95);
  opacity: 0;
}
</style>
