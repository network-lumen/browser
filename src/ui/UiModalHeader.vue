<template>
  <div class="flex-align-center" :class="gapClass">
    <div class="flex-align-justify-center border-radius-10px" :class="badgeClass">
      <slot name="icon" />
    </div>
    <h3 class="m-0px text-20px txt-weight-light color-text-primary">{{ title }}</h3>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  /** Icon-well size/background/color overrides - the badge look varies per modal family. */
  badgeClass?: string;
  gapClass?: string;
}>(), {
  badgeClass: 'size-40px bg-gradient-primary color-white',
  gapClass: 'gap-12px',
});
</script>
