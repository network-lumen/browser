<template>
  <UiModal :model-value="modelValue" panel-class="receive-modal w-full max-w-500px" @update:model-value="$emit('update:modelValue', false)">
    <template #header>
      <UiModalHeader :title="t('Receive {symbol}', { symbol })">
        <template #icon><ArrowDownLeft :size="20" /></template>
      </UiModalHeader>
    </template>
          <UiBanner class="mb-24px">
            <span>{{ t('📱 Share your wallet address or QR code to receive {symbol} from another wallet.', { symbol }) }}</span>
          </UiBanner>
          <UiBanner v-if="chainName" variant="warning" class="mb-24px">
            <span>{{ t('This address is for {chain} only. Sending an asset from a different chain to it will lose it.', { chain: chainName }) }}</span>
          </UiBanner>

          <div class="flex-justify-center m-0px mt-24px mb-24px">
            <div class="p-20px bg-card border-2 border-radius-16px shadow-md">
              <img 
                v-if="qrDataUrl" 
                :src="qrDataUrl"
                :alt="t('QR code')"
                class="h-240px block border-radius-8px w-240px"
              />
              <div v-else class="h-240px flex-align-justify-center color-text-tertiary bg-secondary border-radius-8px text-14px w-240px">
                <div class="flex-align-center gap-8px color-text-secondary">
                  <span class="border-radius-full w-20px h-20px border-2-fill-secondary spinner-accent inline-block flex-shrink-0"></span>
                  {{ t('Generating QR code…') }}
                </div>
              </div>
            </div>
          </div>

          <div class="border-radius-12px p-20px border-2 bg-secondary mb-0px">
            <div class="txt-weight-medium color-text-secondary text-uppercase text-14px mb-12px letter-spacing-005em">{{ t('Your wallet address') }}</div>
            <div class="mono p-14px text-15px color-text-primary break-all mb-16px bg-card border-1 border-radius-8px line-height-15">{{ address || '-' }}</div>
            <UiButton variant="secondary" type="button" @click="$emit('copy')" :disabled="!address" class="border-2-primary disabled-fade-50">
              <Copy :size="16" />
              <span>{{ t('Copy address') }}</span>
            </UiButton>
          </div>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiButton from '../ui/UiButton.vue';
import { ArrowDownLeft, Copy } from 'lucide-vue-next';

/**
 * The wallet address to receive on, with its QR code.
 *
 * `symbol` and `chainName` are what let this serve any Cosmos chain rather than
 * only the home one. When a chain is named, the dialog also warns that the
 * address is chain-specific: the addresses differ only by their bech32 prefix,
 * so they look interchangeable and are not.
 */
withDefaults(
  defineProps<{
    modelValue: boolean;
    address: string;
    qrDataUrl?: string;
    symbol?: string;
    chainName?: string;
  }>(),
  { symbol: 'LMN', chainName: '' }
);
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'copy'): void }>();
</script>
