<template>
  <UiModal :model-value="visible" panel-class="pwd-modal w-full max-w-360px shadow-lg" :closable="false" @update:model-value="handleCancel">
    <template #header>
      <UiModalHeader title="Password Required" badge-class="color-primary" title-class="text-18px">
        <template #icon><LockKeyhole :size="24" /></template>
      </UiModalHeader>
    </template>
          <p class="color-text-secondary text-14px line-height-14 m-0px mb-20px">
            {{ message || 'Enter your password to authorize this operation.' }}
          </p>

          <div class="mb-20px">
            <UiInput bg-class="bg-fill-tertiary" radius-class="border-radius-10px" font-size-class="text-16px" padding-class="py-12px px-16px" :focus-ring="false" ref="passwordInput"
              type="password"
              v-model="password"
              placeholder="Enter password"
              :disabled="loading || busy"
              @keyup.enter="handleSubmit"
              @keyup.escape="handleCancel" class="focus-border-primary border-default disabled-fade-50 transition-colors-015 placeholder-tertiary" />

            <UiBanner v-if="error" variant="error" class="mt-8px">{{ error }}</UiBanner>
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
          <UiSpinnerRing ring-class="w-14px h-14px border-2-white-a45" />
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
import UiSpinnerRing from '../ui/UiSpinnerRing.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
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
