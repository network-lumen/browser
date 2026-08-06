<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    panel-class="bg-card-a94-shadow-soft border-1-light border-radius-24px backdrop-blur-16 w-min-512px-full"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('submit')"
  >

    <template #header>
      <div>
        <div class="txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">Shortcut</div>
        <h2 id="shortcut-modal-title" class="color-text-primary">
          {{ mode === "create" ? "Add shortcut" : "Edit shortcut" }}
        </h2>
      </div>
    </template>
        <div class="flex flex-column gap-12px">
          <UiFormField label="Name" label-class="color-text-secondary text-14px txt-weight-light">
            <UiInput bg-class="bg-black-a02" radius-class="border-radius-14px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary-a50" :focus-ring="false" v-model="draft.title"
              placeholder="Optional custom title"
              maxlength="60"
              @keydown.enter.prevent="$emit('submit')" class="border-1-light focus-ring" />
          </UiFormField>

          <UiFormField label="URL or Lumen page" label-class="color-text-secondary text-14px txt-weight-light">
            <UiInput bg-class="bg-black-a02" radius-class="border-radius-14px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary-a50" :focus-ring="false" v-model="draft.url"
              placeholder="lumen://home or example.lmn"
              @keydown.enter.prevent="$emit('submit')" class="border-1-light focus-ring" />
          </UiFormField>

          <UiCheckbox v-model="draft.pinned">Mark this shortcut as favourite</UiCheckbox>

        </div>

    <template #confirm>{{ mode === "create" ? "Add shortcut" : "Save changes" }}</template>
  </UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/UiDialog.vue';
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import type { ShortcutDraft } from '../types/newTabPage';

/**
 * Adding or editing a new-tab shortcut - the same form either way, with only
 * the title and the confirm label telling them apart.
 *
 * The draft is passed in rather than owned here because the page builds it
 * from the shortcut being edited, and reads it back after the submit.
 */
defineProps<{
  modelValue: boolean;
  mode: 'create' | 'edit';
  draft: ShortcutDraft;
  error?: string;
}>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();
</script>