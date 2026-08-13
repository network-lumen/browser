<template>
  <UiModal :model-value="modelValue" :title="t('Site permissions')" panel-class="w-full max-w-560px" @update:model-value="$emit('close')">
    <p class="text-13px color-text-tertiary m-0px mb-16px">
      {{ t('What each site is allowed to ask Lumen to do on your behalf. Turning a right off refuses it from then on, without asking you again.') }}
    </p>
    <UiLoadingBlock v-if="loading" wrapper-class="flex-column gap-12px fw-500 color-text-primary w-full align-middle min-h-140px" spinner-class="" />
    <UiEmptyState v-else-if="!records.length" :title="t('No site permissions yet')" :description="t('A site that asks to send tokens, save a file or publish a link will show up here once you allow it.')" />
    <div v-else class="flex flex-column gap-4px">
      <div v-for="record in records" :key="record.siteKey" class="border-radius-10px">
        <div class="reveal-on-hover hover-bg-primary-a10 flex-align-center gap-12px border-radius-10px py-10px px-12px">
          <UiButton variant="none" type="button" @click="toggleExpanded(record)" class="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-0px">
            <div class="text-14px fw-500 color-text-primary truncate mono">{{ sitePermissionSiteLabel(record) }}</div>
            <div class="text-12px color-text-tertiary truncate">
              {{ summarizeSitePermission(record) }}
              <span v-if="record.updatedAt"> · {{ formatDateTime(record.updatedAt) }}</span>
            </div>
          </UiButton>
          <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" :title="t('Revoke every right')"
            :disabled="revokingKey === record.siteKey"
            @click="$emit('revoke', record)" class="reveal-actions-target active-scale-98 hover-bg-error bg-error-a08 color-error">
            <Trash2 :size="14" />
          </UiButton>
        </div>
        <div v-if="expandedKey === record.siteKey" class="border-radius-10px mt-4px py-10px px-12px bg-secondary">
          <UiEmptyState v-if="!record.actions.length" :title="t('Nothing granted yet')" :description="t('This site has been allowed to open Lumen modals, but has not used a right yet.')" />
          <div v-else class="flex flex-column gap-8px">
            <div
              v-for="action in sortSitePermissionActions(record.actions)"
              :key="action.kind"
              class="flex-align-center-justify-space-between gap-12px border-radius-8px py-8px px-10px bg-card border-default"
            >
              <div class="flex flex-column gap-2px min-w-0">
                <span class="text-13px color-text-primary">{{ sitePermissionActionLabel(action.kind) }}</span>
                <span class="text-11px color-text-tertiary">
                  {{ action.allowed ? t('Allowed') : t('Refused') }}
                  <span v-if="action.updatedAt"> · {{ formatDateTime(action.updatedAt) }}</span>
                </span>
              </div>
              <UiToggle
                size="sm"
                :model-value="action.allowed"
                @update:model-value="(next: boolean) => $emit('set-action', record, action, next)"
              />
            </div>
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
import UiButton from '../ui/UiButton.vue';
import UiToggle from '../ui/UiToggle.vue';
import { Trash2 } from 'lucide-vue-next';
import { formatDateTime } from '../internal/services/format';
import {
  sitePermissionActionLabel,
  sitePermissionSiteLabel,
  sortSitePermissionActions,
  summarizeSitePermission,
} from '../internal/services/sitePermissions';
import type { SitePermissionAction, SitePermissionRecord } from '../types/sitePermissions';

/**
 * The rights each site holds, one row per site and one toggle per right.
 *
 * Which row is open is this dialog's own business, exactly as in the sites data
 * dialog it sits under; everything that outlives the modal - the records, and
 * the writes - belongs to the page.
 */
const props = defineProps<{
  modelValue: boolean;
  records: SitePermissionRecord[];
  revokingKey: string;
  loading?: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'revoke', record: SitePermissionRecord): void;
  (e: 'set-action', record: SitePermissionRecord, action: SitePermissionAction, allowed: boolean): void;
}>();

const expandedKey = ref('');

function toggleExpanded(record: SitePermissionRecord) {
  expandedKey.value = expandedKey.value === record.siteKey ? '' : record.siteKey;
}

/** Forget a row that is no longer there, whether revoked or gone on a reload. */
watch(
  () => props.records,
  (records) => {
    if (expandedKey.value && !records.some((record) => record.siteKey === expandedKey.value)) {
      expandedKey.value = '';
    }
  },
);
</script>
