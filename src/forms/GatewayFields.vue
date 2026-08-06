<template>
  <div class="grid gap-y-14px gap-x-16px grid-cols-2-minmax0">
    <UiFormField label="Endpoint" :label-class="labelClass">
      <UiInput
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.endpoint"
        placeholder="gateway.city"
        class="focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      />
    </UiFormField>

    <UiFormField label="Regions" :label-class="labelClass">
      <UiInput
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.regions"
        placeholder="us-east, eu-west"
        class="focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      />
    </UiFormField>

    <UiFormField label="Payout address" :label-class="labelClass">
      <UiInput
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.payout"
        placeholder="lmn1..."
        class="mono focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      />
    </UiFormField>

    <UiFormField v-if="withActive && 'active' in form" label="Active" :label-class="labelClass">
      <UiCheckbox v-model="(form as GatewayEditState).active" />
    </UiFormField>

    <UiFormField class="grid-col-full" label="Metadata (JSON object)" :label-class="labelClass">
      <UiInput
        type="textarea"
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.metadata"
        rows="7"
        placeholder='{\n  "name": "My gateway"\n}'
        class="mono focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      ></UiInput>
    </UiFormField>

    <UiFormField :class="memoClass" label="Memo" :label-class="labelClass">
      <UiInput
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.memo"
        placeholder="Optional memo"
        class="focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      />
    </UiFormField>

    <slot />
  </div>
</template>

<script setup lang="ts">
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import type { GatewayEditState, GatewayRegisterForm } from '../types/gatewaysPage';

/**
 * The fields describing a gateway: where it is, which regions it serves, who
 * gets paid, and its metadata.
 *
 * GatewaysPage showed these twice - once in the "create gateway" modal, once
 * inline for editing an existing one - with the same labels, placeholders and
 * classes down to the character. The only real difference is that an existing
 * gateway can be switched off, which is what `withActive` adds.
 *
 * The form object is mutated in place rather than emitted back: both callers
 * own a reactive object and read it after, which is also how the dialogs that
 * take a `form` prop already work.
 */
withDefaults(
  defineProps<{
    form: GatewayRegisterForm | GatewayEditState;
    /** Adds the on/off switch. Only an already-registered gateway has one. */
    withActive?: boolean;
    labelClass?: string;
    /** The register form gives Memo a full row; the edit form does not. */
    memoClass?: string;
  }>(),
  {
    withActive: false,
    labelClass: 'text-12px color-text-tertiary letter-spacing-006em',
    memoClass: ''
  }
);
</script>
