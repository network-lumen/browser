<template>
  <UiModal
    :model-value="modelValue"
    panel-class="w-min-760px-full"
    :closable="!busy"
    @update:model-value="close"
  >
    <template #header>
      <div>
        <h2 class="color-text-primary text-16px">Create gateway</h2>
        <p class="color-text-secondary m-0px mt-4px">Register a new gateway for the active profile.</p>
      </div>
    </template>

    <div class="grid gap-y-14px gap-x-16px grid-cols-2-minmax0">
      <UiFormField label="Endpoint" label-class="text-12px color-text-tertiary letter-spacing-006em">
        <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="form.endpoint" placeholder="gateway.city" class="focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
      </UiFormField>
      <UiFormField label="Regions" label-class="text-12px color-text-tertiary letter-spacing-006em">
        <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="form.regions" placeholder="us-east, eu-west" class="focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
      </UiFormField>
      <UiFormField label="Payout address" label-class="text-12px color-text-tertiary letter-spacing-006em">
        <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="form.payout" placeholder="lmn1..." class="mono focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
      </UiFormField>
      <UiFormField class="grid-col-full" label="Metadata (JSON object)" label-class="text-12px color-text-tertiary letter-spacing-006em">
        <UiInput type="textarea" bg-class="bg-secondary" :focus-ring="false" v-model="form.metadata" rows="7" placeholder='{\n  "name": "My gateway"\n}' class="mono focus-ring focus-outline-none focus-shadow placeholder-tertiary"></UiInput>
      </UiFormField>
      <UiFormField label="Memo" label-class="text-12px color-text-tertiary letter-spacing-006em">
        <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="form.memo" placeholder="Optional memo" class="focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
      </UiFormField>

      <div v-if="error" class="mt-12px p-12px border-1-error-a25 bg-error-a08">{{ error }}</div>
      <div v-if="txhash" class="mono mt-12px p-12px bg-success-a08 border-1-success-a25">tx: {{ txhash }}</div>
    </div>

    <template #footer>
      <UiButton variant="secondary" type="button" :disabled="busy" @click="close">Cancel</UiButton>
      <UiButton variant="primary" type="button" :disabled="busy || !canSubmit" @click="submit">
        <span v-if="!busy">Create</span>
        <span v-else>Submitting…</span>
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
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
