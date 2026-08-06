<template>
  <span class="flex-inline-align-center border-radius-4px text-11px txt-weight-light py-2px px-8px bg-fill-blue color-accent-secondary">
    {{ type || 'Unknown' }}
  </span>
</template>

<script setup lang="ts">
/**
 * What kind of message a transaction carried.
 *
 * Three spellings before this: uppercase in a primary-tinted pill in the
 * network summary, sentence case in a blue pill in the network table, and no
 * pill at all on the block page - just bold grey text, which read as a label
 * rather than a value.
 */
defineProps<{ type?: string }>();
</script>
