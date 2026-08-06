<template>
  <span
    class="mono color-text-tertiary text-11px"
    :class="copyable ? 'cursor-pointer transition-color-02 hover-color-primary' : ''"
    :title="copyable ? `${address} — click to copy` : address"
    @click="copyable ? $emit('copy') : undefined"
  >{{ shortened }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { truncateMiddle } from '../internal/services/format';

/**
 * A chain address shown under whatever it belongs to - a validator moniker,
 * an owner, a payout target.
 *
 * Two places showed one, truncated to different lengths (12/8 against 10/8)
 * and only one of them offering to copy, with no hint on the other that the
 * full value existed at all. Both now truncate the same way and carry the
 * whole address in their title.
 *
 * Copying is opt-in rather than always on: the caller owns the clipboard and
 * the toast that follows, and a non-interactive label should not look
 * clickable.
 */
const props = withDefaults(
  defineProps<{ address: string; copyable?: boolean }>(),
  { copyable: false }
);

defineEmits<{ (e: 'copy'): void }>();

const shortened = computed(() => truncateMiddle(props.address, { start: 12, end: 8 }));
</script>
