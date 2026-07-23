<template>
  <section class="max-w-800px my-0px mx-auto bg-white border-radius-20px box-shadow-default p-16px w-full" aria-labelledby="wallet-title">
    <header class="flex-align-start flex-justify-space-between mb-8px">
      <div class="m-4px flex-align-center gap-8px">
        <div class="flex flex-column gap-0px">
          <h3 id="wallet-title" class="text-20px line-height-12 txt-weight-strong m-0px">Wallet</h3>
          <p class="m-0px color-gray-blue">Your Lumen balance and address.</p>
        </div>
      </div>
    </header>

    <div class="flex flex-column gap-8px">
      <!-- Address -->
      <div
        class="p-8px flex-align-center-justify-space-between gap-8px border-radius-10px bg-white border-1px-solid border-color-default flex-align-center"
      >
        <div class="flex flex-align-center gap-8px">
          <div class="text-11px line-height-12 color-gray-blue">Address</div>
          <div class="text-11px line-height-12 txt-weight-medium" :title="address || '--'">
            <span v-if="address">{{ shortAddress }}</span>
            <span v-else class="color-gray-blue-light">-</span>
          </div>
        </div>
        <div class="flex-align-center gap-8px">
          <UiButton
            variant="ghost"
            :disabled="!address"
            title="Copy address"
            aria-label="Copy address"
            @click="copyAddress"
          >
            <Copy :size="16" />
          </UiButton>
        </div>
      </div>

      <!-- Balance -->
      <div
        class="p-8px flex-align-center-justify-space-between gap-8px border-radius-10px bg-white border-1px-solid border-color-default flex-align-center"
      >
        <div class="flex flex-align-center gap-8px">
          <div class="text-11px line-height-12 color-gray-blue">Balance</div>
          <div class="text-11px line-height-12 txt-weight-medium">
            <span class="color-gray-blue-light">Coming soon</span>
          </div>
        </div>
        <div class="flex-align-center gap-8px">
          <UiButton variant="primary" :disabled="true" title="Send LMN">
            <ArrowUpRight :size="16" />
            <span class="ml-4px">Send</span>
          </UiButton>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Copy, ArrowUpRight } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import { profilesState, activeProfileId } from '../internal/profilesStore';
import { copyToClipboard } from '../composables/useClipboard';

const profiles = profilesState;

const address = computed(() => {
  const active = profiles.value.find((p) => p.id === activeProfileId.value) || null;
  // Placeholder: use profile id as pseudo-address for now.
  return active?.id || '';
});

const shortAddress = computed(() => {
  const v = address.value;
  if (!v) return '';
  if (v.length <= 12) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
});

async function copyAddress() {
  const v = address.value;
  if (!v) return;
  await copyToClipboard(v);
}
</script>
