<template>
  <div class="flex-align-center gap-12px">
    <div class="flex-align-justify-center size-40px border-radius-10px bg-gradient-primary color-white">
      <slot name="icon" />
    </div>
    <h3 class="m-0px text-20px txt-weight-light color-text-primary">{{ title }}</h3>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>
