<template>
  <span
    class="color-primary cursor-pointer hover-underline transition-color-02"
    :class="sizeClass"
    :title="`Block ${formatted}`"
    @click="$emit('open')"
  >{{ prefixed ? `#${formatted}` : formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '../internal/services/format';

/**
 * A block height, as a link to that block.
 */
const props = withDefaults(
  defineProps<{
    height: number | string;
    /** Prepends "#", for lists where the value is otherwise unlabelled. */
    prefixed?: boolean;
    sizeClass?: string;
  }>(),
  { prefixed: false, sizeClass: 'text-13px' }
);

defineEmits<{ (e: 'open'): void }>();

const formatted = computed(() => formatNumber(props.height));
</script>
