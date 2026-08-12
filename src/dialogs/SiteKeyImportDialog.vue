<template>
    <UiDialog
    :model-value="modelValue"
    panel-class="w-min-520px-92vw max-h-100vh-32px"
    @update:model-value="$emit('close')"
    @confirm="$emit('confirm')"
  >

    <template #header>
      <UiModalHeader :title="t('Restore an identity on this site')" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><KeyRound :size="18" /></template>
      </UiModalHeader>
    </template>
    <UiBanner variant="info" v-if="siteLabel">
      <span class="overflow-wrap-anywhere">{{ t('Requested by') }} <span class="mono">{{ siteLabel }}</span></span>
    </UiBanner>
    <UiBanner variant="warning" class="mt-12px" v-if="hasExisting">
      <span class="overflow-wrap-anywhere">
        {{ t('This site already has an identity. Importing a key file replaces it: from now on this site publishes as the imported identity, and the current one stops being used here.') }}
      </span>
    </UiBanner>
    <UiDetailRow v-if="ipnsName" :label="t('Current identity')" :flex="true" class="mt-12px">
      <span class="mono text-12px overflow-wrap-anywhere">{{ ipnsName }}</span>
    </UiDetailRow>
    <label v-if="hasExisting" class="flex flex-inline-align-center gap-8px mt-12px cursor-pointer">
      <input type="checkbox" v-model="backupFirst" />
      <span class="text-13px color-text-primary">
        {{ t("Save the identity I'm about to replace to my computer first, so I can restore it later") }}
      </span>
    </label>
    <p class="text-12px color-text-secondary mt-8px">
      {{ t('You pick the key file yourself — the page cannot choose it or read it.') }}
    </p>

    <template #confirm><KeyRound :size="16" />
        <span>{{ backupFirst && hasExisting ? t('Save current, then choose a key') : t('Choose a key file') }}</span></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiDialog from '../ui/UiDialog.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import { KeyRound } from 'lucide-vue-next';

/**
 * Warning before a site identity is replaced, with the option to save the
 * outgoing one first. Consent only; the browser owns the file picker.
 */
defineProps<{
  modelValue: boolean;
  siteLabel: string;
  ipnsName?: string;
  hasExisting?: boolean;
}>();
defineEmits<{ (e: 'close'): void; (e: 'confirm'): void }>();

const backupFirst = defineModel<boolean>('backupFirst', { required: true });
</script>
