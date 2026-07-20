<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="overlay-scrim backdrop-blur-4px z-10000"
        @click.self="handleCancel"
      >
        <div class="modal-panel pwd-modal bg-card border-default w-full border-radius-16px padding-175 max-w-360px shadow-modal-strong">
          <div class="pwd-modal-header flex-align-center gap-75 margin-bottom-75">
            <LockKeyhole :size="24" class="color-primary" />
            <h3 class="color-text-primary margin-0 txt-weight-light pwd-modal-header-h3 fs-18px">Password Required</h3>
          </div>

          <p class="pwd-modal-message color-text-secondary fs-14px line-height-14 margin-0 margin-bottom-125">
            {{ message || 'Enter your password to authorize this operation.' }}
          </p>

          <div class="margin-bottom-125">
            <input
              ref="passwordInput"
              type="password"
              class="pwd-modal-input bg-fill-tertiary border-default color-text-primary outline-none w-full border-radius-10px padding-75-100 fs-16px disabled-fade-60 transition-colors-015"
              v-model="password"
              placeholder="Enter password"
              :disabled="loading || busy"
              @keyup.enter="handleSubmit"
              @keyup.escape="handleCancel"
            />

            <div v-if="error" class="pwd-modal-error color-error fs-085rem margin-top-50 padding-50-75 bg-fill-error border-radius-8px">
              {{ error }}
            </div>
          </div>

          <div class="flex-align-center gap-75 flex-justify-end">
            <button
              v-if="cancelable !== false"
              class="pwd-modal-btn-secondary disabled-fade-50 bg-fill-tertiary color-text-primary border-none cursor-pointer border-radius-10px fw-500 fs-14px padding-62-125 transition-opacity-015"
              @click="handleCancel"
              :disabled="loading || busy"
            >
              Cancel
            </button>
            <button
              class="pwd-modal-btn-primary disabled-fade-50 color-white border-none cursor-pointer border-radius-10px fw-500 bg-accent fs-14px padding-62-125 transition-opacity-015"
              @click="handleSubmit"
              :disabled="loading || busy || !password"
            >
              <span v-if="loading">Verifying...</span>
              <span v-else-if="busy" class="flex-inline-align-center gap-50">
                <span class="pwd-modal-spinner border-radius-full w-14px h-14px border-2-white-a45 spinner-white" aria-hidden="true"></span>
                Working...
              </span>
              <span v-else>Confirm</span>
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
import { useInternalLumen } from '../composables/useInternalLumen';

const props = defineProps<{
  visible: boolean;
  message?: string;
  busy?: boolean;
  cancelable?: boolean;
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
  if (!password.value || loading.value || props.busy) return;
  
  error.value = '';
  loading.value = true;
  
  try {
    // Verify password with backend
    const result = await useInternalLumen().security.verifyPassword({ password: password.value });
    
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
  if (props.cancelable === false) return;
  if (loading.value || props.busy) return;
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
