<template>
  <UiModal :model-value="modelValue" panel-class="send-modal w-full max-w-500px" @update:model-value="$emit('update:modelValue', false)">
    <template #header>
      <UiModalHeader :title="title">
        <template #icon><Send :size="20" /></template>
      </UiModalHeader>
    </template>
          <UiBanner class="mb-24px">
            <span v-if="assetContext">
              <template v-if="isIbcSend">
                Move this asset from {{ sourceChainLabel }} to another linked chain over IBC.
              </template>
              <template v-else>
                Send this asset on {{ sourceChainLabel }} to any {{ sourcePrefix }}1... address. Use “To Other Chain” only when you want to bridge it.
              </template>
            </span>
            <span v-else>
              💡 Your first transaction may take up to 60 seconds. <br>
              After that, transactions are confirmed within ~6 seconds.</span>
          </UiBanner>

          <UiFormGroup label="From" dimmed :hint="`Chain: ${sourceChainLabel}`">
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text" :value="sourceAddress" readonly class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
          </UiFormGroup>

          <UiFormGroup label="Asset" dimmed>
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text" :value="`${assetName} (${assetSymbol})`" readonly class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
          </UiFormGroup>

          <UiFormGroup v-if="!assetContext" label="Send to">
            <select class="w-full border-radius-10px color-text-primary cursor-pointer py-12px px-16px border-2 text-15px bg-card transition-all-02 mono focus-outline-none focus-border-primary focus-ring focus-shadow bg-secondary-read-only appearance-none" v-model="targetMode">
              <option value="lumen">On the current chain</option>
              <option value="ibc">Across IBC to another chain</option>
            </select>
          </UiFormGroup>

          <UiFormGroup v-if="isIbcSend" required label="IBC route">
            <select
              class="w-full border-radius-10px color-text-primary cursor-pointer py-12px px-16px border-2 text-15px bg-card transition-all-02 mono focus-outline-none focus-border-primary focus-ring focus-shadow bg-secondary-read-only appearance-none"
              v-model="ibcForm.sourceChannel"
              :disabled="ibcChannelsLoading || !ibcChannels.length"
            >
              <option value="" disabled>
                {{ ibcChannelsLoading ? 'Loading IBC channels...' : 'Select an IBC route' }}
              </option>
              <option
                v-for="channel in ibcChannels"
                :key="`${channel.portId}:${channel.channelId}`"
                :value="channel.channelId"
              >
                {{ channel.label }}
              </option>
            </select>
            <template v-if="selectedIbcChannel || ibcChannelsError" #hint>
              <template v-if="selectedIbcChannel">
                Route: {{ selectedIbcChannel.portId }}/{{ selectedIbcChannel.channelId }}
                <span v-if="selectedIbcChannel.chainId"> · Destination chain: {{ selectedIbcChannel.chainId }}</span>
              </template>
              <template v-else-if="ibcChannelsError">{{ ibcChannelsError }}</template>
            </template>
          </UiFormGroup>

          <UiFormGroup required :label="isIbcSend ? 'Destination address' : 'Recipient'">
            <div class="relative">
              <div class="relative">
                <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
                  v-model="form.recipient"
                  :placeholder="recipientPlaceholder" class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
                <UiButton variant="secondary" @click="$emit('scan-qr')"
                  type="button"
                  title="Scan QR Code" class="hover-bg-accent-color-white absolute top-half translate-y-center right-12px">
                  <QrCode :size="16" />
                </UiButton>
                <button
                  v-if="contacts.length > 0"
                  class="hover-bg-accent-color-white flex-align-justify-center color-text-secondary cursor-pointer absolute p-8px border-none bg-hover border-radius-6px transition-all-02 top-half translate-y-center right-3-5rem"
                  @click="showContactPicker = !showContactPicker"
                  type="button"
                  title="Select from contacts"
                >
                  <Users :size="16" />
                </button>
              </div>
              <div v-if="showContactPicker" class="border-radius-12px absolute top-full mt-8px bg-card border-1 overflow-hidden z-100 left-0 right-0 shadow-md">
                <div class="flex-align-center-justify-space-between txt-weight-light color-text-primary py-12px px-16px bg-secondary border-bottom-1 text-14px">
                  <span>Select Contact</span>
                  <UiButton variant="icon" @click="showContactPicker = false">
                    <X :size="14" />
                  </UiButton>
                </div>
                <div class="max-h-300px overflow-y-auto">
                  <button
                    v-for="contact in contacts"
                    :key="contact.id"
                    class="hover-bg-hover last-border-bottom-none flex-align-center gap-12px w-full text-left cursor-pointer py-12px px-16px border-none bg-transparent transition-all-02 border-bottom-1"
                    @click="$emit('select-contact', contact)"
                  >
                    <div class="flex-align-justify-center size-36px border-radius-circle txt-weight-medium bg-gradient-primary color-white text-14px flex-shrink-0">{{ contact.name.charAt(0).toUpperCase() }}</div>
                    <div class="flex flex-column flex-1 gap-4px min-w-0">
                      <span class="txt-weight-light color-text-primary text-14px">{{ contact.name }}</span>
                      <span class="text-12px color-text-tertiary mono">{{ contact.address.slice(0, 12) }}...{{ contact.address.slice(-8) }}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </UiFormGroup>

          <UiFormGroup required :label="`Amount (${assetSymbol})`" :hint="availableLabel ? `Available: ${availableLabel} ${assetSymbol}` : ''">
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
              inputmode="decimal"
              v-model="form.amount"
              placeholder="0.000000"
              @input="validateAmountInput" class="mono focus-outline-none focus-ring focus-shadow pr-64px bg-secondary-read-only placeholder-tertiary" />
            <span class="txt-weight-light color-text-secondary absolute text-14px cursor-events-none top-half translate-y-center right-16px">{{ assetSymbol }}</span>
          </UiFormGroup>

          <UiSummaryCard :title="isIbcSend ? 'Transfer Summary' : 'Transaction Summary'">
            <UiSummaryRow :label="isIbcSend ? 'Transfer amount' : 'Amount debited'" :value="`${summary.amount} ${assetSymbol}`" />
            <UiSummaryRow v-if="!isIbcSend" label="Chain" :value="sourceChainLabel" />
            <UiSummaryRow v-if="showTaxBreakdown" label="Tax" :value="summary.taxLabel" value-class="color-warning" />
            <UiSummaryRow v-if="showTaxBreakdown" highlight label="Receiver net" :value="`${summary.receiver} ${assetSymbol}`" />
            <UiSummaryRow v-if="isIbcSend" label="Route" :value="summary.routeLabel" />
            <UiSummaryRow v-if="isIbcSend" highlight label="Destination chain" :value="summary.destinationChain" />
          </UiSummaryCard>

          <UiButton variant="primary" @click="$emit('submit')" :disabled="!canSend || sending" class="disabled-fade-50">
            <Send :size="18" v-if="!sending" />
            <UiSpinner v-else size="sm" class="spinner-color-white" />
            <span>{{ primaryActionLabel }}</span>
          </UiButton>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiButton from '../ui/UiButton.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiInput from '../ui/UiInput.vue';
import UiSummaryCard from '../ui/UiSummaryCard.vue';
import UiSummaryRow from '../ui/UiSummaryRow.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { QrCode, Send, Users } from 'lucide-vue-next';
import type { IbcChannelOption, SendForm, IbcForm } from '../types/walletPage';

/**
 * Sending tokens - on this chain, or over IBC to another one.
 *
 * The two states of the contact picker and the tax breakdown are this
 * dialog's own: nothing outside it ever looked at them, they only decided
 * what was folded open.
 */
defineProps<{
  modelValue: boolean;
  title: string;
  form: SendForm;
  ibcForm: IbcForm;
  targetMode: string;
  isIbcSend: boolean;
  assetContext: unknown;
  assetName: string;
  assetSymbol: string;
  sourceAddress: string;
  sourceChainLabel: string;
  contacts: any[];
  ibcChannels: IbcChannelOption[];
  ibcChannelsLoading?: boolean;
  ibcChannelsError?: string;
  selectedIbcChannel: IbcChannelOption | null;
  summary: Record<string, string>;
  canSend: boolean;
  sourcePrefix?: string;
  recipientPlaceholder?: string;
  availableLabel?: string;
  primaryActionLabel: string;
  /**
   * Whether the tax breakdown applies at all - a same-chain LMN send. The
   * page computes it; it is not a fold the user toggles.
   */
  showTaxBreakdown: boolean;
  validateAmountInput: (event: Event) => void;
  sending?: boolean;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit'): void;
  (e: 'scan-qr'): void;
  (e: 'select-contact', contact: any): void;
}>();

/**
 * Whether the contact list is unfolded. It stays with the page because the
 * page closes it too - on pick, on send, and when the modal shuts.
 */
const showContactPicker = defineModel<boolean>('showContactPicker', { required: true });

</script>
