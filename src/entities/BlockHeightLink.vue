<template>
  <span
    class="color-primary cursor-pointer hover-underline transition-color-02"
    :class="sizeClass"
    :title="t('Block {height}', { height: formatted })"
    @click="$emit('open')"
  >{{ prefixed ? `#${formatted}` : formatted }}</span>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
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
