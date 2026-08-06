<template>
  <UiModal :model-value="modelValue" panel-class="receive-modal w-full max-w-500px" @update:model-value="$emit('update:modelValue', false)">
    <template #header>
      <UiModalHeader title="Receive LMN">
        <template #icon><ArrowDownLeft :size="20" /></template>
      </UiModalHeader>
    </template>
          <UiBanner class="mb-24px">
            <span>📱 Share your wallet address or QR code to receive LMN from another wallet.</span>
          </UiBanner>

          <div class="flex-justify-center m-0px mt-24px mb-24px">
            <div class="p-20px bg-card border-2 border-radius-16px shadow-md">
              <img 
                v-if="qrDataUrl" 
                :src="qrDataUrl"
                alt="QR Code"
                class="h-240px block border-radius-8px w-240px"
              />
              <div v-else class="h-240px flex-align-justify-center color-text-tertiary bg-secondary border-radius-8px text-14px w-240px">
                <div class="flex-align-center gap-8px color-text-secondary">
                  <span class="border-radius-full w-20px h-20px border-2-fill-secondary spinner-accent inline-block flex-shrink-0"></span>
                  Generating QR Code...
                </div>
              </div>
            </div>
          </div>

          <div class="border-radius-12px p-20px border-2 bg-secondary mb-0px">
            <div class="txt-weight-medium color-text-secondary text-uppercase text-14px mb-12px letter-spacing-005em">Your Wallet Address</div>
            <div class="mono p-14px text-15px color-text-primary break-all mb-16px bg-card border-1 border-radius-8px line-height-15">{{ address || '-' }}</div>
            <UiButton variant="secondary" type="button" @click="$emit('copy')" :disabled="!address" class="border-2-primary disabled-fade-50">
              <Copy :size="16" />
              <span>Copy Address</span>
            </UiButton>
          </div>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiButton from '../ui/UiButton.vue';
import { ArrowDownLeft, Copy } from 'lucide-vue-next';

/** The wallet address to receive on, with its QR code. */
defineProps<{ modelValue: boolean; address: string; qrDataUrl?: string }>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'copy'): void }>();
</script>
