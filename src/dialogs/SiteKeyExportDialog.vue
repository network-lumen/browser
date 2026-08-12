<template>
    <UiDialog
    :model-value="modelValue"
    panel-class="w-min-520px-92vw max-h-100vh-32px"
    @update:model-value="$emit('close')"
    @confirm="$emit('confirm')"
  >

    <template #header>
      <UiModalHeader :title="t('Export this site identity')" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><KeyRound :size="18" /></template>
      </UiModalHeader>
    </template>
    <UiBanner variant="info" v-if="siteLabel">
      <span class="overflow-wrap-anywhere">{{ t('Requested by') }} <span class="mono">{{ siteLabel }}</span></span>
    </UiBanner>
    <UiBanner variant="warning" class="mt-12px">
      <span class="overflow-wrap-anywhere">
        {{ t('This downloads the') }} <strong>{{ t('private key') }}</strong>
{{ t('of your identity on this site — the key to the vault. Anyone who holds that file') }}
<strong>{{ t('is you') }}</strong>
{{ t('on this site, permanently: an identity key cannot be revoked or reissued. Keep it like a password, and never send it to anyone.') }}
</span>
    </UiBanner>
    <UiDetailRow v-if="ipnsName" :label="t('Identity')" :flex="true" class="mt-12px">
      <span class="mono text-12px overflow-wrap-anywhere">{{ ipnsName }}</span>
    </UiDetailRow>
    <p class="text-12px color-text-secondary mt-8px">
      {{ t('You choose where the file is saved. The page never receives the key itself.') }}
    </p>

    <template #confirm><KeyRound :size="16" />
        <span>{{ t('Choose a location and export') }}</span></template>
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
 * Warning before the private key of a site identity is written to disk.
 * Pure consent - the browser does the export, and this never sees the key.
 */
defineProps<{ modelValue: boolean; siteLabel: string; ipnsName?: string }>();
defineEmits<{ (e: 'close'): void; (e: 'confirm'): void }>();
</script>
