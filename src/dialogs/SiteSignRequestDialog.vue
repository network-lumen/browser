<template>
  <UiDialog
    :model-value="modelValue"
    :confirm-label="t('Approve and sign')"
    confirm-variant="danger"
    :cancel-label="t('Reject')"
    @update:model-value="$emit('close')"
    @confirm="$emit('confirm')"
  >
    <template #header>
      <UiModalHeader :title="t('A site is asking your wallet to sign')" badge-class="bg-fill-error color-error size-32px">
        <template #icon><ShieldAlert :size="18" /></template>
      </UiModalHeader>
    </template>

    <UiBanner variant="error" class="mb-16px">
      {{ t('Signing authorises this action with your keys. Only approve it if you started it yourself, on a site you trust.') }}
    </UiBanner>

    <UiDetailRow variant="modal" :label="t('Site')" :value="siteLabel || 'Unknown site'" />
    <UiDetailRow variant="modal" :label="t('Requested')" :value="operationLabel" />
    <UiDetailRow v-if="chainId" variant="modal" :label="t('Chain')" :value="chainId" />
    <UiDetailRow v-if="signerAddress" variant="modal" :label="t('Signing as')">
      <AddressLabel :address="signerAddress" tone-class="color-text-primary text-12px" />
    </UiDetailRow>

    <div v-if="details" class="mt-12px">
      <span class="text-11px color-text-tertiary">{{ t('What will be signed') }}</span>
      <pre class="text-11px color-text-secondary mono overflow-auto max-h-200px m-0px mt-4px p-8px border-radius-8px bg-card">{{ details }}</pre>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { computed } from 'vue';
import { ShieldAlert } from 'lucide-vue-next';
import UiDialog from '../ui/UiDialog.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import AddressLabel from '../entities/AddressLabel.vue';

/**
 * Approval for a signature requested through the Keplr/Leap compatibility
 * shims.
 *
 * Those shims stand in for a wallet extension, and a real one always shows its
 * own approval window before signing. Nothing was showing one here, so a site
 * could sign with an unlocked session and never surface it. Every signing
 * entry point now waits on this.
 *
 * There is deliberately no "always allow": a permission that persists is fine
 * for reading a domain, not for authorising signatures.
 */
const props = defineProps<{
  modelValue: boolean;
  siteLabel: string;
  /** Which shim call was made - signAmino, sendTx, ... */
  operation: string;
  chainId?: string;
  signerAddress?: string;
  /** The document or transaction, pretty-printed by the caller. */
  details?: string;
}>();

defineEmits<{ (e: 'close'): void; (e: 'confirm'): void }>();

const OPERATION_LABELS: Record<string, string> = {
  signAmino: t('Sign a transaction (Amino)'),
  signDirect: t('Sign a transaction (Direct)'),
  signArbitrary: t('Sign a message'),
  sendTx: t('Broadcast a signed transaction'),
  sendTransaction: t('Send tokens'),
};

const operationLabel = computed(
  () => OPERATION_LABELS[props.operation] || `Sign (${props.operation || 'unknown'})`
);
</script>
