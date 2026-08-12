<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    panel-class="w-min-520px-92vw max-h-100vh-32px"
    :closable="!loading"
    :busy="loading"
    :confirm-disabled="loading || !stableLinkSetupSelectedName"
    @update:model-value="$emit('close')"
    @confirm="$emit('submit')"
  >

    <template #header>
      <UiModalHeader :title="t('Select a live link')" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Link :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info" v-if="siteLabel">
            <span class="overflow-wrap-anywhere">{{ t('Requested by') }} <span class="mono">{{ siteLabel }}</span></span>
          </UiBanner>
          <UiFormGroup :label="t('Live link')" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <select class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" v-model="stableLinkSetupSelectedName" :disabled="loading">
              <option value="">{{ loading ? t('Loading live links...') : t('Select a live link') }}</option>
              <option v-for="item in stableLinks" :key="item.name" :value="item.name">
                {{ item.label }} — {{ shortStableIpns(item.id) }}
              </option>
            </select>
          </UiFormGroup>
          <p class="text-12px color-text-secondary mt-8px">
            {{ t('Previous live settings will be loaded from this link if records are available.') }}
          </p>

    <template #confirm><UiSpinnerRing v-if="loading" />
        <Link v-else :size="16" />
        <span>{{ loading ? t('Loading...') : t('Load previous settings') }}</span></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiDialog from '../ui/UiDialog.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiSpinnerRing from '../ui/UiSpinnerRing.vue';
import { Link } from 'lucide-vue-next';
import { shortenIpnsId as shortStableIpns } from '../internal/services/format';
import type { StableLinkItem } from '../types/lumenSiteModalHost';

/** Picking which live link to restore previous settings from. */
defineProps<{
  modelValue: boolean;
  siteLabel: string;
  stableLinks: StableLinkItem[];
  loading?: boolean;
  error?: string;
}>();
defineEmits<{ (e: 'close'): void; (e: 'submit'): void }>();

const stableLinkSetupSelectedName = defineModel<string>('selectedName', { required: true });
</script>
