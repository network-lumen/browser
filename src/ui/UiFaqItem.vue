<template>
  <div class="flex gap-12px border-radius-12px bg-secondary border-default p-16px">
    <div class="flex-align-justify-center size-28px border-radius-circle bg-fill-blue color-primary flex-shrink-0">
      <HelpCircle :size="16" />
    </div>
    <div class="flex-1 flex flex-column gap-6px min-w-0">
      <h4 class="color-text-primary m-0px txt-weight-medium text-15px">{{ question }}</h4>
      <p class="color-text-secondary text-14px line-height-15 m-0px">{{ answer }}</p>
      <div v-if="$slots.action" class="mt-8px">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { HelpCircle } from 'lucide-vue-next';

/**
 * One question and its answer.
 *
 * Knows nothing about Lumen: both strings arrive already translated, and the
 * action that follows an answer - a button to the page it talks about - is a
 * slot, so the item never has to be told how to navigate.
 */
defineProps<{
  question: string;
  answer: string;
}>();
</script>
