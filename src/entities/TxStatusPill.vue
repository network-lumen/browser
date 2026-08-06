<template>
  <span
    class="flex-inline-align-center gap-6px border-radius-full text-12px txt-weight-light py-4px px-10px"
    :class="success ? 'bg-fill-success color-success' : 'bg-fill-error color-error'"
    :title="success ? 'Succeeded' : 'Failed'"
  >
    <CircleCheckBig v-if="success" :size="13" />
    <CircleX v-else :size="13" />
    <span v-if="!compact">{{ success ? 'Success' : 'Failed' }}</span>
  </span>
</template>

<script setup lang="ts">
import { CircleCheckBig, CircleX } from 'lucide-vue-next';

/**
 * Whether a transaction succeeded.
 *
 * The same fact was spelled four different ways: a bare check or cross on the
 * address page, the words alone in the network summary, an icon plus the words
 * in the network table, and a check glued to the word on the transaction page.
 * Four looks for one boolean, and nothing to tell a new screen which to copy.
 *
 * This is that one look. `compact` drops the label for tight columns but keeps
 * the icon and the colour, so a row is still readable at a glance and still
 * carries a title for anyone hovering or using a screen reader.
 */
withDefaults(defineProps<{ success: boolean; compact?: boolean }>(), { compact: false });
</script>
