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
 * a gateway operator, a payout target.
 *
 * Four places drew one, cut to four different lengths (12/8, 10/8, 10/6, 8/6),
 * and only one of them offered to copy, with nothing on the others to suggest
 * the full value existed. They all cut the same way now and carry the whole
 * address in their title.
 *
 * The type scale stays a prop because it genuinely varies - a sublabel under a
 * validator name is smaller than a table cell - but the truncation does not,
 * and neither does being monospaced.
 *
 * Copying is opt-in rather than always on: the caller owns the clipboard and
 * the toast that follows, and a label nobody can click should not look
 * clickable.
 */
const props = withDefaults(
  defineProps<{ address: string; copyable?: boolean; toneClass?: string }>(),
  { copyable: false, toneClass: 'color-text-tertiary text-11px' }
);

defineEmits<{ (e: 'copy'): void }>();

const shortened = computed(() => shortenAddress(props.address));
</script>
