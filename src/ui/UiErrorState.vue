<template>
  <div class="flex flex-column flex-align-justify-center" :class="wrapperClass">
    <p class="color-error" :class="messageClass">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  message: string;
  wrapperClass?: string;
  messageClass?: string;
}>(), {
  wrapperClass: 'gap-16px min-h-300px',
  messageClass: 'text-16px',
});
</script>
