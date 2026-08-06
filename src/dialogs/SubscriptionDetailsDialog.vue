<template>
  <UiModal :model-value="modelValue" title="Subscription details" panel-class="w-full max-w-520px" @update:model-value="$emit('close')">
          <UiLoadingBlock v-if="loading" wrapper-class="flex-column gap-12px fw-500 color-text-primary w-full align-middle min-h-220px" spinner-class="" />

          <template v-else>
            <div class="flex flex-column">
              <UiDetailRow variant="modal" label="Gateway" :value="gatewayLabel" />
              <UiDetailRow variant="modal" label="Status">
                <span class="color-text-primary text-15px fw-500" :class="gatewayDetailsStatusClass">
                  {{ gatewayDetailsStatusLabel }}
                </span>
              </UiDetailRow>
              <UiDetailRow variant="modal" label="Saved" :value="pinned.length" />
            </div>

            <div class="mt-24px">
              <div class="flex-align-center-justify-space-between gap-8px mb-8px">
                <h4 class="m-0px text-15px fw-500 color-text-primary">Usage</h4>
              </div>
              <div
                v-if="usageError === 'password_required'"
                class="flex flex-column border-radius-12px mt-8px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08"
              >
                <div class="text-14px txt-weight-light color-text-primary">Wallet locked</div>
                <div class="color-text-secondary text-13px">
                  Unlock your Lumen identity to fetch usage from this cloud.
                </div>
                <UiButton variant="secondary" type="button"
                  @click="$emit('unlock')">
                  Unlock
                </UiButton>
              </div>
              <div v-else-if="usageError" class="flex flex-column border-radius-12px mt-8px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
                {{ usageError }}
              </div>
              <div v-else-if="usage" class="flex flex-column">
                <UiDetailRow variant="modal" label="Quota" :value="
                    usage.plan?.quota_bytes_total != null ||
                    usage.plan?.quotaBytesTotal != null
                      ? formatSize(
                          (usage.plan.quota_bytes_total ??
                            usage.plan.quotaBytesTotal) as number,
                        )
                      : '-'
                  " />
                <UiDetailRow variant="modal" label="Used" :value="
                    usage.plan?.quota_bytes_used != null ||
                    usage.plan?.quotaBytesUsed != null
                      ? formatSize(
                          (usage.plan.quota_bytes_used ??
                            usage.plan.quotaBytesUsed) as number,
                        )
                      : '-'
                  " />
                <UiDetailRow variant="modal" label="Bandwidth" :value="bandwidthUsed" />
                <UiDetailRow variant="modal" label="Roots" :value="usage.usage?.roots_total ?? usage.usage?.rootsTotal ?? '-'" />
              </div>
            </div>
          </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiLoadingBlock from '../ui/UiLoadingBlock.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiButton from '../ui/UiButton.vue';

/**
 * What a cloud subscription is currently using.
 *
 * `usageError` carries the literal 'password_required', which is not a
 * failure but a prompt: the figures live behind the session lock.
 */
defineProps<{
  modelValue: boolean;
  gatewayLabel: string;
  usage: any;
  bandwidthUsed: string;
  gatewayDetailsStatusClass: string;
  gatewayDetailsStatusLabel: string;
  formatSize: (bytes: number | undefined) => string;
  pinned: unknown[];
  loading?: boolean;
  usageError?: string;
}>();
defineEmits<{ (e: 'close'): void; (e: 'unlock'): void }>();
</script>
