<template>
    <UiDialog
    :model-value="modelValue"
    :title="t('Post-quantum security enabled')"
    panel-class="min-w-360px max-w-90vw"
    :cancel-label="t('Ignore')"
    :confirm-label="t('Export')"
    @update:model-value="$emit('dismiss')"
    @confirm="$emit('export')"
  >

    <p class="text-13px color-text-secondary line-height-15 m-0px mb-16px">
      {{ t('Re-export') }} <strong>{{ profileName }}</strong>
{{ t('. Your wallet is now linked on-chain and uses post-quantum security.') }}
</p>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiDialog from '../ui/UiDialog.vue';

/**
 * Shown once a profile gains its post-quantum key, offering to back the
 * profile up now that there is something new worth backing up.
 */
defineProps<{ modelValue: boolean; profileName?: string }>();
defineEmits<{ (e: 'dismiss'): void; (e: 'export'): void }>();
</script>
