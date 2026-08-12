<template>
  <div class="grid gap-y-14px gap-x-16px grid-cols-2-minmax0">
    <UiFormField :label="t('Endpoint')" :label-class="labelClass">
      <UiInput
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.endpoint"
        placeholder="gateway.city"
        class="focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      />
    </UiFormField>

    <UiFormField :label="t('Regions')" :label-class="labelClass">
      <UiInput
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.regions"
        :placeholder="t('us-east, eu-west')"
        class="focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      />
    </UiFormField>

    <UiFormField :label="t('Payout address')" :label-class="labelClass">
      <UiInput
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.payout"
        placeholder="lmn1..."
        class="mono focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      />
    </UiFormField>

    <UiFormField v-if="withActive && 'active' in form" :label="t('Active')" :label-class="labelClass">
      <UiCheckbox v-model="(form as GatewayEditState).active" />
    </UiFormField>

    <UiFormField class="grid-col-full" :label="t('Metadata (JSON object)')" :label-class="labelClass">
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

    <UiFormField :class="memoClass" :label="t('Memo')" :label-class="labelClass">
      <UiInput
        bg-class="bg-secondary"
        :focus-ring="false"
        v-model="form.memo"
        :placeholder="t('Optional memo')"
        class="focus-ring focus-outline-none focus-shadow placeholder-tertiary"
      />
    </UiFormField>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import type { GatewayEditState, GatewayRegisterForm } from '../types/gatewaysPage';

/**
 * The fields describing a gateway: where it is, which regions it serves, who
 * gets paid, and its metadata
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
