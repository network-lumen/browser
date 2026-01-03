<template>
  <section class="wallet-card bg-white border-radius-20px box-shadow-default padding-100 w-full" aria-labelledby="wallet-title">
    <header class="flex-align-justify-space-between flex-align-start margin-bottom-50">
      <div class="margin-25 flex-align-center gap-50">
        <div class="flex flex-column gap-0">
          <h3 id="wallet-title" class="txt-lg txt-weight-strong margin-0">Wallet</h3>
          <p class="margin-0 color-gray-blue">Your Lumen balance and address.</p>
        </div>
      </div>
    </header>

    <div class="flex flex-column gap-50">
      <!-- Address -->
      <div
        class="padding-50 flex-align-center-justify-space-between gap-50 border-radius-10px bg-white border-1px-solid border-color-default flex-align-center"
      >
        <div class="flex flex-align-center gap-50">
          <div class="txt-xs color-gray-blue">Address</div>
          <div class="txt-xs txt-weight-medium" :title="address || '--'">
            <span v-if="address">{{ shortAddress }}</span>
            <span v-else class="color-gray-blue-light">-</span>
          </div>
        </div>
        <div class="flex-align-center gap-50">
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
        class="padding-50 flex-align-center-justify-space-between gap-50 border-radius-10px bg-white border-1px-solid border-color-default flex-align-center"
      >
        <div class="flex flex-align-center gap-50">
          <div class="txt-xs color-gray-blue">Balance</div>
          <div class="txt-xs txt-weight-medium">
            <span class="color-gray-blue-light">Coming soon</span>
          </div>
        </div>
        <div class="flex-align-center gap-50">
          <UiButton variant="primary" :disabled="true" title="Send LMN">
            <ArrowUpRight :size="16" />
            <span class="margin-left-25">Send</span>
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
  if (!v || !navigator.clipboard || !navigator.clipboard.writeText) return;
  try {
    await navigator.clipboard.writeText(v);
  } catch {
    // ignore copy errors
  }
}
</script>

<style scoped>
.wallet-card {
  max-width: 800px;
  margin: 0 auto;
}
</style>

