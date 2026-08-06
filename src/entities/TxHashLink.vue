<template>
  <code
    class="mono color-primary cursor-pointer hover-underline"
    :class="wide ? 'text-12px' : 'text-11px'"
    :title="hash"
    @click="$emit('open')"
  >{{ shortened }}</code>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { truncateMiddle } from '../internal/services/format';

/**
 * A transaction hash, as shown wherever one is listed.
 *
 * It was drawn three ways: a primary-coloured `<code>` on the address page, a
 * secondary-coloured `<code>` on a grey chip in the network table, and - in
 * the network summary - plain text that was not even monospaced, so the same
 * hash did not line up with itself between two lists on one page.
 *
 * The truncation stays adjustable because that difference is real: a wide
 * table column can show 20 leading characters where a card has room for 8.
 * What does not change is that a hash is monospaced, clickable, and carries
 * the full value in its title for anyone who needs to read it.
 */
const props = withDefaults(
  defineProps<{
    hash: string;
    /** For a table column with room to spare, rather than a card. */
    wide?: boolean;
  }>(),
  { wide: false }
);

defineEmits<{ (e: 'open'): void }>();

const shortened = computed(() =>
  props.wide
    ? truncateMiddle(props.hash, { start: 20, end: 10 })
    : truncateMiddle(props.hash, { start: 8, end: 8 })
);
</script>
