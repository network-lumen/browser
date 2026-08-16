<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    panel-class="w-min-760px-full"
    :closable="!busy"
    :busy="busy"
    :confirm-disabled="busy || !canSubmit"
    @update:model-value="close"
    @confirm="submit"
  >

    <template #header>
      <div>
        <h2 class="color-text-primary text-16px">{{ t('Create gateway') }}</h2>
        <p class="color-text-secondary m-0px mt-4px">{{ t('Register a new gateway for the active profile.') }}</p>
      </div>
    </template>

    <GatewayFields :form="form">
      <div v-if="txhash" class="mono mt-12px p-12px bg-success-a08 border-1-success-a25">tx: {{ txhash }}</div>
    </GatewayFields>

    <template #confirm><span v-if="!busy">{{ t('Create') }}</span>
        <span v-else>{{ t('Submitting…') }}</span></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { computed, reactive, watch } from 'vue';
import UiDialog from '../ui/UiDialog.vue';
import GatewayFields from '../forms/GatewayFields.vue';
import type { GatewayRegisterForm } from '../types/gatewaysPage';

/**
 * Registering a gateway on chain.
 *
 * The form lives here rather than in the page: nothing outside this modal
 * reads it, and keeping it here means the page no longer carries five fields,
 * a reset and a validity rule it only needed while the modal was open. The
 * page keeps what is genuinely its own - the chain call, and the busy/error/
 * txhash it produces, which arrive back as props.
 *
 * Reopening always starts clean, with the payout prefilled from the active
 * profile, which is what the page's reset used to do by hand.
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** Prefills the payout field, since it is almost always the active wallet. */
    activeAddress?: string;
    busy?: boolean;
    error?: string;
    txhash?: string;
  }>(),
  { activeAddress: '', busy: false, error: '', txhash: '' }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', payload: GatewayRegisterForm): void;
}>();

const form = reactive<GatewayRegisterForm>({
  endpoint: '',
  regions: '',
  payout: '',
  metadata: '',
  memo: ''
});

function reset() {
  form.endpoint = '';
  form.regions = '';
  form.metadata = '';
  form.memo = '';
  form.payout = props.activeAddress || '';
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset();
  },
  { immediate: true }
);

// An address arriving after the modal opened still prefills, as long as the
// user has not typed one.
watch(
  () => props.activeAddress,
  (addr) => {
    if (!form.payout) form.payout = addr || '';
  }
);

const canSubmit = computed(() => !!form.endpoint.trim() && !!form.payout.trim());

function close() {
  if (props.busy) return;
  emit('update:modelValue', false);
}

function submit() {
  if (!canSubmit.value || props.busy) return;
  emit('submit', { ...form });
}
</script>
