<template>
  <UiModal :model-value="modelValue" title="Sites data" panel-class="w-full max-w-560px" @update:model-value="$emit('close')">
    <p class="text-13px color-text-tertiary m-0px mb-16px">
      Data a site created for itself, one dedicated key per site - separate from the ugly domains you create yourself in Domains. Deleting one makes that site see you as a brand new visitor next time.
    </p>
    <UiLoadingBlock v-if="loading" wrapper-class="flex-column gap-12px fw-500 color-text-primary w-full align-middle min-h-140px" spinner-class="" />
    <UiEmptyState v-else-if="!records.length" title="No sites data yet" description="Sites that create a data record for themselves will show up here." />
    <div v-else class="flex flex-column gap-4px">
      <div v-for="record in records" :key="rowId(record)" class="border-radius-10px">
        <div class="reveal-on-hover hover-bg-primary-a10 flex-align-center gap-12px border-radius-10px py-10px px-12px">
          <UiButton variant="none" type="button" @click="$emit('toggle-expanded', record)" class="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-0px">
            <div class="text-14px fw-500 color-text-primary truncate mono">{{ siteDataSiteLabel(record) }}</div>
            <div class="text-12px color-text-tertiary truncate">{{ record.updatedAt ? formatDate(record.updatedAt) : "—" }}</div>
          </UiButton>
          <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" title="Delete this site's data"
            :disabled="removingId === rowId(record)"
            @click="$emit('remove', record)" class="reveal-actions-target active-scale-98 hover-bg-error bg-error-a08 color-error">
            <Trash2 :size="14" />
          </UiButton>
        </div>
        <div v-if="expandedId === rowId(record)" class="border-radius-10px mt-4px py-10px px-12px bg-secondary">
          <UiDetailRow variant="modal" label="Profile" :value="record.profileId || '—'" />
          <div class="flex-align-center-justify-space-between mt-8px mb-4px">
            <span class="text-11px color-text-tertiary">Stored data</span>
            <UiButton variant="none" type="button" @click="$emit('toggle-raw', record)" class="bg-transparent border-none cursor-pointer color-primary text-11px fw-500 p-0px">
              {{ rawId === rowId(record) ? "Table view" : "View raw JSON" }}
            </UiButton>
          </div>
          <pre v-if="rawId === rowId(record)" class="text-11px color-text-secondary mono overflow-auto max-h-280px m-0px p-8px border-radius-8px bg-card">{{ siteDataJson(record) }}</pre>
          <div v-else class="border-radius-8px overflow-hidden border-default">
            <div v-for="field in fields(record)" :key="field.key" class="grid-cols-70-1fr grid gap-8px py-6px px-8px last-border-bottom-none border-bottom-1">
              <span class="text-11px color-text-tertiary mono truncate">{{ field.key }}</span>
              <span class="text-11px color-text-primary overflow-wrap-anywhere">{{ field.value }}</span>
            </div>
            <div v-if="!fields(record).length" class="text-11px color-text-tertiary py-8px px-8px">Empty.</div>
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiLoadingBlock from '../ui/UiLoadingBlock.vue';
import UiEmptyState from '../ui/UiEmptyState.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiButton from '../ui/UiButton.vue';
import { Trash2 } from 'lucide-vue-next';
import type { SiteDataRecord } from '../types/drivePage';

/**
 * The per-site data records the browser keeps, one IPNS key each.
 *
 * Which row is expanded and which shows raw JSON stay with the page: it also
 * clears them when a record is deleted.
 */
defineProps<{
  modelValue: boolean;
  records: SiteDataRecord[];
  fields: (record: SiteDataRecord) => { key: string; value: string }[];
  rowId: (record: SiteDataRecord) => string;
  siteDataSiteLabel: (record: SiteDataRecord) => string;
  formatDate: (ts: number) => string;
  siteDataJson: (record: SiteDataRecord) => string;
  expandedId: string;
  rawId: string;
  removingId: string;
  loading?: boolean;
}>();
defineEmits<{
  (e: 'close'): void;
  (e: 'remove', record: SiteDataRecord): void;
  (e: 'toggle-expanded', record: SiteDataRecord): void;
  (e: 'toggle-raw', record: SiteDataRecord): void;
}>();
</script>
