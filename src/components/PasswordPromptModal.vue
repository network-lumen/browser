<template>
  <UiModal :model-value="visible" panel-class="pwd-modal w-full max-w-360px shadow-modal-strong" :closable="false" @update:model-value="handleCancel">
    <template #header>
      <div class="pwd-modal-header flex-align-center gap-12px">
        <LockKeyhole :size="24" class="color-primary" />
        <h3 class="color-text-primary m-0px txt-weight-light pwd-modal-header-h3 text-18px">Password Required</h3>
      </div>
    </template>
          <p class="pwd-modal-message color-text-secondary text-14px line-height-14 m-0px mb-20px">
            {{ message || 'Enter your password to authorize this operation.' }}
          </p>

          <div class="mb-20px">
            <UiInput bg-class="bg-fill-tertiary" radius-class="border-radius-10px" font-size-class="text-16px" padding-class="py-12px px-16px" :focus-ring="false" ref="passwordInput"
              type="password"
              v-model="password"
              placeholder="Enter password"
              :disabled="loading || busy"
              @keyup.enter="handleSubmit"
              @keyup.escape="handleCancel" class="pwd-modal-input border-default disabled-fade-60 transition-colors-015 placeholder-tertiary" />

            <div v-if="error" class="pwd-modal-error color-error text-14px mt-8px py-8px px-12px bg-fill-error border-radius-8px">
              {{ error }}
            </div>
          </div>

    <template #footer>
      <UiButton variant="secondary" v-if="cancelable !== false"
        @click="handleCancel"
        :disabled="loading || busy" class="disabled-fade-50">
        Cancel
      </UiButton>
      <UiButton variant="primary" @click="handleSubmit"
        :disabled="loading || busy || !password" class="disabled-fade-50">
        <span v-if="loading">Verifying...</span>
        <span v-else-if="busy" class="flex-inline-align-center gap-8px">
          <span class="pwd-modal-spinner border-radius-full w-14px h-14px border-2-white-a45 spinner-white" aria-hidden="true"></span>
          Working...
        </span>
        <span v-else>Confirm</span>
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiInput from '../ui/UiInput.vue';
import UiButton from '../ui/UiButton.vue';
import UiModal from '../ui/UiModal.vue';
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
