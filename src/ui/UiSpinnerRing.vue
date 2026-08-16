<template>
  <span class="border-radius-full spinner-white" :class="ringClass" aria-hidden="true"></span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** Classic CSS ring spinner (not UiSpinner's SVG arc) for use inline on a
   *  colored button background - size/border-alpha/display are all overridable. */
  ringClass?: string;
}>(), {
  ringClass: 'inline-block mr-8px w-14px h-14px border-2-white-a50',
});
</script>
