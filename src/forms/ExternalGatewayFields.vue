<template>
  <div class="flex flex-column gap-12px">
  <p class="color-text-secondary mb-24px border-radius-8px py-12px px-16px text-14px line-height-15 bg-primary-a10 border-1-primary-a20">
    {{ t('Add an external private gateway (e.g., your VPS or company server). For local embedded server, use the "Start Embedded Server" button instead.') }}
  </p>

  <UiFormField class="mb-20px" :label="t('Gateway Name')" label-class="block fw-500 color-text-secondary text-14px">
    <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.name"
      :placeholder="t('My Private Gateway')" class="focus-outline-none focus-ring-blue" />
  </UiFormField>

  <UiFormField class="mb-20px" :label="t('Gateway URL')" label-class="block fw-500 color-text-secondary text-14px">
    <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.url"
      placeholder="https://gateway.example.com" class="focus-outline-none focus-ring-blue" />
  </UiFormField>

  <UiFormField class="mb-20px" :label="t('API Key')" label-class="block fw-500 color-text-secondary text-14px">
    <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.apiKey"
      :placeholder="t('Your gateway API key')" class="focus-outline-none focus-ring-blue" />
  </UiFormField>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import type { ExternalGatewayForm } from '../types/myGatewaysPage';

/**
 * The fields of external gateway fields
 */
defineProps<{ form: ExternalGatewayForm }>();
</script>
