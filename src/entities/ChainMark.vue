<template>
  <img
    v-if="chain.image && !broken"
    :src="chain.image"
    :alt="chain.prettyName"
    class="size-40px border-radius-circle flex-shrink-0 object-fit-contain bg-secondary"
    @error="broken = true"
  />
  <span
    v-else
    class="flex-align-justify-center size-40px border-radius-circle txt-weight-medium bg-gradient-primary color-white text-14px flex-shrink-0"
  >
    {{ initials }}
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CosmosChainSummary } from '../types/walletPage';

/**
 * A chain's logo, or a readable stand-in.
 *
 * 14 of the 221 directory entries publish no image, and a registry URL that is
 * present can still 404, so the fallback is driven by the load error rather
 * than by the presence of the field alone.
 */
const props = defineProps<{ chain: CosmosChainSummary }>();

const broken = ref(false);

// The same component instance is reused as a list re-renders, so a failure on
// one chain would otherwise stick to whichever chain took its place.
watch(() => props.chain.image, () => {
  broken.value = false;
});

const initials = computed(
  () => props.chain.symbol.slice(0, 3) || props.chain.prettyName.charAt(0).toUpperCase() || '?'
);
</script>
