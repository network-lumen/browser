<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    panel-class="w-min-520px-92vw max-h-100vh-32px"
    :closable="!saving"
    :busy="saving"
    :confirm-disabled="!canSubmit"
    @update:model-value="$emit('close')"
    @confirm="$emit('submit')"
  >

    <template #header>
      <UiModalHeader :title="t('Choose or create a stable link for your live')" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Link :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info" v-if="siteLabel">
            <span class="overflow-wrap-anywhere">{{ t('Requested by') }} <span class="mono">{{ siteLabel }}</span></span>
          </UiBanner>

          <div class="border-radius-10px grid gap-4px p-4px mb-12px bg-fill-tertiary grid-cols-2-minmax0">
            <button type="button" class="color-text-secondary cursor-pointer txt-weight-medium border-radius-8px py-8px px-10px bg-transparent border-none" :class="{ 'bg-card color-text-primary shadow-sm': stableLinkMode === 'existing' }" @click="stableLinkMode = 'existing'">
              {{ t('Existing') }}
            </button>
            <button type="button" class="color-text-secondary cursor-pointer txt-weight-medium border-radius-8px py-8px px-10px bg-transparent border-none" :class="{ 'bg-card color-text-primary shadow-sm': stableLinkMode === 'create' }" @click="stableLinkMode = 'create'">
              {{ t('Create new') }}
            </button>
          </div>

          <UiFormGroup v-if="stableLinkMode === 'existing'" :label="t('Stable link')" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <select class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" v-model="stableLinkSelectedName" :disabled="saving || loading">
              <option value="">{{ loading ? t('Loading stable links…') : t('Select a stable link') }}</option>
              <option v-for="item in stableLinks" :key="item.name" :value="item.name">
                {{ item.label }} — {{ shortStableIpns(item.id) }}
              </option>
            </select>
          </UiFormGroup>

          <UiFormGroup v-else :label="t('New stable link label')" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input
              class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px"
              type="text"
              v-model="stableLinkNewLabel"
              :placeholder="'my-live'"
              :disabled="saving"
              @keydown.enter.prevent="$emit('submit')"
            />
          </UiFormGroup>

          <div class="border-radius-10px border-default py-10px px-12px">
            <UiDetailRow variant="baseline" :label="t('Live')" :value="liveTitle || 'Untitled live'" />
            <UiDetailRow variant="baseline" :label="t('Records')">
              <UiButton variant="primary" type="button" @click="stableLinkRecordsExpanded = !stableLinkRecordsExpanded">
                <span class="mono">{{ records.length === 1 ? t('1 record') : t('{count} records', { count: records.length }) }}</span>
                <ChevronDown :size="14" class="transition-transform-02" :class="{ 'rotate-180': stableLinkRecordsExpanded }" />
              </UiButton>
            </UiDetailRow>
            <div v-if="stableLinkRecordsExpanded" class="grid gap-6px mt-8px pt-8px border-top-default">
              <div v-for="record in records" :key="record.key" class="grid gap-10px grid-cols-70-1fr align-items-start">
                <span class="mono text-12px color-text-secondary">{{ record.key }}</span>
                <span class="mono text-12px color-text-primary overflow-wrap-anywhere" :title="record.value">{{ record.value }}</span>
              </div>
            </div>
          </div>

          <p class="text-12px color-text-secondary mt-8px">
            {{ t('The stable link URL will be copied after it is attached to this live.') }}
          </p>

    <template #confirm><UiSpinnerRing v-if="saving" />
        <Plus v-else-if="stableLinkMode === 'create'" :size="16" />
        <Save v-else :size="16" />
        <span>{{ saving ? 'Saving...' : (stableLinkMode === 'create' ? t('Create and copy link') : t('Use and copy link')) }}</span></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { ref } from 'vue';
import UiDialog from '../ui/UiDialog.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinnerRing from '../ui/UiSpinnerRing.vue';
import { ChevronDown, Link, Plus, Save } from 'lucide-vue-next';
import { shortenIpnsId as shortStableIpns } from '../internal/services/format';
import type { StableLinkItem } from '../types/lumenSiteModalHost';

/**
 * Choosing an existing stable link for a live, or creating one.
 *
 * The mode, the chosen link and the new label write back to the host, which
 * is what actually publishes. Whether the record list is unfolded is this
 * dialog's own business and stays here.
 */
defineProps<{
  modelValue: boolean;
  siteLabel: string;
  stableLinks: StableLinkItem[];
  records: { key: string; value: string }[];
  liveTitle?: string;
  canSubmit: boolean;
  saving?: boolean;
  loading?: boolean;
  error?: string;
}>();
defineEmits<{ (e: 'close'): void; (e: 'submit'): void }>();

const stableLinkMode = defineModel<'existing' | 'create'>('mode', { required: true });
const stableLinkSelectedName = defineModel<string>('selectedName', { required: true });
const stableLinkNewLabel = defineModel<string>('newLabel', { required: true });

const stableLinkRecordsExpanded = ref(false);
</script>
