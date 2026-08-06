<template>
  <span
    class="color-primary cursor-pointer hover-underline transition-color-02"
    :class="sizeClass"
    :title="`Block ${formatted}`"
    @click="$emit('open')"
  >{{ prefixed ? `Block ${formatted}` : formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '../internal/services/format';

/**
 * A block height, as a link to that block.
 *
 * Three renderings before this, and they disagreed on the value itself and
 * not only its styling: "Block 12345" on the address page, a thousands-
 * separated 12,345 in the network table, and a bare 12345 on the transaction
 * page - the same block reading three ways depending on where you found it.
 * The link styling differed too, one being permanently underlined where the
 * others underline on hover.
 *
 * The number is always separated now, because a chain height passes six
 * digits early and is unreadable without it. `prefixed` keeps the word for
 * places where the value sits among other metadata and needs saying what it
 * is; elsewhere the column heading already does that.
 */
const props = withDefaults(
  defineProps<{
    height: number | string;
    /** Prepends "Block", for lists where the value is otherwise unlabelled. */
    prefixed?: boolean;
    sizeClass?: string;
  }>(),
  { prefixed: false, sizeClass: 'text-13px' }
);

defineEmits<{ (e: 'open'): void }>();

const formatted = computed(() => formatNumber(props.height));
</script>
