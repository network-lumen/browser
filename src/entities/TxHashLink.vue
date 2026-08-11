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
 * A transaction hash, as shown wherever one is listed
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
