<template>
  <span class="flex-inline-align-center gap-6px border-radius-full text-12px txt-weight-light py-4px px-10px" :class="tone.pill">
    <span class="border-radius-full w-8px h-8px flex-shrink-0" :class="tone.dot" />
    <span>{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../stores/i18nStore';

/**
 * A chain's registry status.
 *
 * The registry publishes three: `live`, `upcoming` and `killed`. Only the
 * first two appear in practice today (220 and 1 of 221), but a killed chain
 * has to read as a warning rather than fall through to the neutral tone, so
 * all three are coloured and anything unrecognised stays neutral instead of
 * being coloured on a guess.
 */
const props = defineProps<{ status: string }>();

const normalized = computed(() => String(props.status || '').trim().toLowerCase());

const label = computed(() => {
  if (normalized.value === 'live') return t('Live');
  if (normalized.value === 'upcoming') return t('Upcoming');
  if (normalized.value === 'killed') return t('Halted');
  return props.status || t('Unknown');
});

const tone = computed(() => {
  if (normalized.value === 'live') return { pill: 'bg-fill-success color-success', dot: 'bg-success' };
  if (normalized.value === 'upcoming') return { pill: 'bg-warning-a08 color-warning', dot: 'bg-warning' };
  if (normalized.value === 'killed') return { pill: 'bg-fill-error color-error', dot: 'bg-error' };
  return { pill: 'bg-fill-tertiary color-text-tertiary', dot: 'bg-fill-tertiary' };
});
</script>
