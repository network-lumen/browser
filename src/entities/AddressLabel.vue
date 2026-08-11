<template>
  <span
    class="mono"
    :class="[toneClass, copyable ? 'cursor-pointer transition-color-02 hover-color-primary' : '']"
    :title="copyable ? `${address} — click to copy` : address"
    @click="copyable ? $emit('copy') : undefined"
  >{{ shortened }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { shortenAddress } from '../internal/services/format';

/**
 * A chain address shown under whatever it belongs to - a validator moniker,
 * a gateway operator, a payout target...
 */
const props = withDefaults(
  defineProps<{ address: string; copyable?: boolean; toneClass?: string }>(),
  { copyable: false, toneClass: 'color-text-tertiary text-11px' }
);

defineEmits<{ (e: 'copy'): void }>();

const shortened = computed(() => shortenAddress(props.address));
</script>
