<template>
  <UiModal :model-value="modelValue" :title="t('Sites data')" panel-class="w-full max-w-560px" @update:model-value="$emit('close')">
    <p class="text-13px color-text-tertiary m-0px mb-16px">
      {{ t('Data a site created for itself, one dedicated key per site - separate from the ugly domains you create yourself in Domains. Deleting one makes that site see you as a brand new visitor next time.') }}
    </p>
    <UiLoadingBlock v-if="loading" wrapper-class="flex-column gap-12px fw-500 color-text-primary w-full align-middle min-h-140px" spinner-class="" />
    <UiEmptyState v-else-if="!records.length" :title="t('No sites data yet')" :description="t('Sites that create a data record for themselves will show up here.')" />
    <div v-else class="flex flex-column gap-4px">
      <div v-for="record in records" :key="siteDataRowId(record)" class="border-radius-10px">
        <div class="reveal-on-hover hover-bg-primary-a10 flex-align-center gap-12px border-radius-10px py-10px px-12px">
          <UiButton variant="none" type="button" @click="toggleExpanded(record)" class="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-0px">
            <div class="text-14px fw-500 color-text-primary truncate mono">{{ siteDataSiteLabel(record) }}</div>
            <div class="text-12px color-text-tertiary truncate">{{ record.updatedAt ? formatDateTime(record.updatedAt) : "—" }}</div>
          </UiButton>
          <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" :title="t('Delete this site\'s data')"
            :disabled="removingId === siteDataRowId(record)"
            @click="$emit('remove', record)" class="reveal-actions-target active-scale-98 hover-bg-error bg-error-a08 color-error">
            <Trash2 :size="14" />
          </UiButton>
        </div>
        <div v-if="expandedId === siteDataRowId(record)" class="border-radius-10px mt-4px py-10px px-12px bg-secondary">
          <UiDetailRow variant="modal" :label="t('Profile')" :value="record.profileId || '—'" />
          <div class="flex-align-center-justify-space-between mt-8px mb-4px">
            <span class="text-11px color-text-tertiary">{{ t('Stored data') }}</span>
            <UiButton variant="none" type="button" @click="toggleRaw(record)" class="bg-transparent border-none cursor-pointer color-primary text-11px fw-500 p-0px">
              {{ rawId === siteDataRowId(record) ? t('Table view') : t('View raw JSON') }}
            </UiButton>
          </div>
          <pre v-if="rawId === siteDataRowId(record)" class="text-11px color-text-secondary mono overflow-auto max-h-280px m-0px p-8px border-radius-8px bg-card">{{ siteDataJson(record) }}</pre>
          <div v-else class="border-radius-8px overflow-hidden border-default">
            <div v-for="field in siteDataFields(record)" :key="field.key" class="grid-cols-70-1fr grid gap-8px py-6px px-8px last-border-bottom-none border-bottom-1">
              <span class="text-11px color-text-tertiary mono truncate">{{ field.key }}</span>
              <span class="text-11px color-text-primary overflow-wrap-anywhere">{{ field.value }}</span>
            </div>
            <div v-if="!siteDataFields(record).length" class="text-11px color-text-tertiary py-8px px-8px">{{ t('Empty.') }}</div>
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { ref, watch } from 'vue';
import UiModal from '../ui/UiModal.vue';
import UiLoadingBlock from '../ui/UiLoadingBlock.vue';
import UiEmptyState from '../ui/UiEmptyState.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiButton from '../ui/UiButton.vue';
import { Trash2 } from 'lucide-vue-next';
import { formatDateTime } from '../internal/services/format';
import {
  siteDataFields,
  siteDataJson,
  siteDataRowId,
  siteDataSiteLabel,
} from '../internal/services/siteData';
import type { SiteDataRecord } from '../types/drivePage';

/**
 * The per-site data records the browser keeps, one IPNS key each.
 *
 * Which row is expanded, and whether it shows raw JSON, belong here: nothing
 * outside this dialog can see either, and the page that used to hold them
 * never did anything with them. It was documented as clearing them when a
 * record was deleted, which it did not - so that now happens below, where it
 * can.
 */
const props = defineProps<{
  modelValue: boolean;
  records: SiteDataRecord[];
  removingId: string;
  loading?: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'remove', record: SiteDataRecord): void;
}>();

const expandedId = ref('');
const rawId = ref('');

function toggleExpanded(record: SiteDataRecord) {
  const id = siteDataRowId(record);
  expandedId.value = expandedId.value === id ? '' : id;
}

function toggleRaw(record: SiteDataRecord) {
  const id = siteDataRowId(record);
  rawId.value = rawId.value === id ? '' : id;
}

/** Forget a row that is no longer there, whether deleted or replaced by a reload. */
watch(
  () => props.records,
  (records) => {
    const present = new Set(records.map(siteDataRowId));
    if (expandedId.value && !present.has(expandedId.value)) expandedId.value = '';
    if (rawId.value && !present.has(rawId.value)) rawId.value = '';
  }
);
</script>
