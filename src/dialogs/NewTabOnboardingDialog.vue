<template>
  <UiModal :model-value="modelValue" panel-class="bg-card-a94-shadow-soft border-1-light border-radius-24px backdrop-blur-16 w-min-544px-full" :closable="false" @update:model-value="$emit('dismiss')">
    <div class="flex-align-start gap-16px mb-16px">
      <div class="flex-align-justify-center flex-0-0-auto bg-gradient-primary color-white shadow-primary border-radius-16px size-48px" aria-hidden="true">
        <Hexagon :size="22" />
      </div>
      <div>
        <div class="txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">Welcome</div>
        <h2 id="lumen-onboarding-title" class="color-text-primary">Learn what Lumen is</h2>
        <p id="lumen-onboarding-desc" class="color-text-secondary mt-8px line-height-15">
          Domains, IPFS, gateways and browser-native shortcuts, all in one launch page.
        </p>
      </div>
    </div>

    <template #footer>
      <UiButton variant="secondary" type="button" @click="$emit('dismiss')" class="outline-none">
        Skip
      </UiButton>
      <UiButton variant="primary" type="button" @click="$emit('learn')" class="outline-none">
        Learn Lumen
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import { Hexagon } from 'lucide-vue-next';

/** First-run welcome on the new-tab page. Copy only; the page decides when. */
defineProps<{ modelValue: boolean }>();
defineEmits<{ (e: 'dismiss'): void; (e: 'learn'): void }>();
</script>