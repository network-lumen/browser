<template>
  <UiModal :model-value="modelValue" title="Post-quantum security enabled" panel-class="min-w-360px max-w-90vw" @update:model-value="$emit('dismiss')">
    <p class="text-13px color-text-secondary line-height-15 m-0px mb-16px">
      Re-export <strong>{{ profileName }}</strong>.
      Your wallet is now linked on-chain and uses post-quantum security.
    </p>
    <template #footer>
      <UiButton variant="secondary" class="flex-1" @click="$emit('dismiss')">
        Ignore
      </UiButton>
      <UiButton variant="primary" class="flex-1" @click="$emit('export')">
        Export
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';

/**
 * Shown once a profile gains its post-quantum key, offering to back the
 * profile up now that there is something new worth backing up.
 */
defineProps<{ modelValue: boolean; profileName?: string }>();
defineEmits<{ (e: 'dismiss'): void; (e: 'export'): void }>();
</script>
