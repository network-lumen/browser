<template>
  <UiModal :model-value="modelValue" panel-class="w-min-520px-92vw max-h-100vh-32px" @update:model-value="$emit('deny')">
    <template #header>
      <UiModalHeader title="Permission required" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Shield :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info">
            <span>
              Allow this website to open Lumen action modals?
            </span>
          </UiBanner>

          <div class="border-radius-10px border-default py-10px px-12px">
            <UiDetailRow variant="baseline" label="Site" :value="siteLabel" label-extra-class="flex-shrink-0" value-class="mono color-text-primary text-right text-13px overflow-wrap-anywhere min-w-0" />
            <UiDetailRow v-if="actionKind" variant="baseline" label="Action" :value="actionKind" />
          </div>
    <template #footer>
      <UiButton variant="secondary" type="button" @click="$emit('deny')">
        Deny
      </UiButton>
      <UiButton variant="secondary" type="button" @click="$emit('allow-once')">
        Allow once
      </UiButton>
      <UiButton variant="primary" type="button" @click="$emit('allow-always')">
        Always allow
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiButton from '../ui/UiButton.vue';
import { Shield } from 'lucide-vue-next';

/**
 * Asking whether a site may open Lumen's action modals at all - the gate in
 * front of every other dialog here. "Always" is persisted by the main
 * process, which is why the three answers are distinct events rather than a
 * boolean.
 */
defineProps<{ modelValue: boolean; siteLabel: string; actionKind?: string }>();
defineEmits<{ (e: 'deny'): void; (e: 'allow-once'): void; (e: 'allow-always'): void }>();
</script>
