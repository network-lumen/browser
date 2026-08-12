<template>
  <span
    class="flex-inline-align-center gap-6px border-radius-full text-12px txt-weight-light py-4px px-10px"
    :class="success ? 'bg-fill-success color-success' : 'bg-fill-error color-error'"
    :title="success ? t('Succeeded') : t('Failed')"
  >
    <CircleCheckBig v-if="success" :size="13" />
    <CircleX v-else :size="13" />
    <span v-if="!compact">{{ success ? t('Success') : t('Failed') }}</span>
  </span>
</template>

<script setup lang="ts">
import { CircleCheckBig, CircleX } from 'lucide-vue-next';
import { t } from '../stores/i18nStore';

/**
 * Whether a transaction succeeded
 */
withDefaults(defineProps<{ success: boolean; compact?: boolean }>(), { compact: false });
</script>
