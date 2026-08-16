<template>
    <UiDialog
    :model-value="modelValue"
    :title="t('Publish release')"
    panel-class="w-min-900px-96vw"
    :busy="submitting"
    :confirm-disabled="submitting"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('submit')"
  >

      <div class="flex flex-column gap-12px">
        <div class="mb-16px border-radius-16px border-1 bg-primary pt-14px pr-14px pb-4px pl-14px">
          <div class="flex-align-center flex-justify-space-between mt-8px">
            <h3>{{ t('Import from GitHub release') }}</h3>
            <UiButton variant="secondary" size="sm" type="button"
              :disabled="importingGithub || !githubReleaseUrl.trim()"
              @click="$emit('import-github')">
              <span v-if="importingGithub" class="flex-inline-align-center gap-8px"><UiSpinner size="sm" /> {{ t('Importing…') }}</span>
              <span v-else>{{ t('Auto-fill') }}</span>
            </UiButton>
          </div>

          <UiFormField :label="t('GitHub release URL')" :hint="t('Imports version, notes, and artifacts (URL/SHA/size) from GitHub + SHA256SUMS file.')">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" :model-value="githubReleaseUrl" @update:model-value="$emit('update:githubReleaseUrl', String($event).trim())"
              placeholder="https://github.com/network-lumen/browser/releases/tag/v0.2.8" class="mono focus-outline-none focus-ring focus-shadow" />
          </UiFormField>
        </div>

        <div class="gap-12px grid grid-cols-2-minmax0">
          <UiFormField :label="t('Version')">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="draft.version" placeholder="0.1.9" class="focus-outline-none focus-ring focus-shadow" />
          </UiFormField>
          <UiFormField :label="t('Channel')">
            <select v-model="draft.channel" class="w-full border-radius-12px color-text-primary text-15px line-height-12 border-1 bg-secondary py-8px px-10px focus-outline-none focus-border-primary focus-ring focus-shadow">
              <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
            </select>
          </UiFormField>
          <UiFormField :label="t('Supersedes (IDs)')">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="draft.supersedes" placeholder="12, 13" class="focus-outline-none focus-ring focus-shadow" />
          </UiFormField>
          <UiFormField :label="t('Emergency flag')">
            <UiCheckbox v-model="draft.emergencyOk">{{ t('Allow emergency rollout') }}</UiCheckbox>
          </UiFormField>
        </div>

        <UiFormField :label="t('Release notes')" :hint="`${draft.notes.length} / ${maxNotesLen || '∞'}`">
          <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model="draft.notes" rows="4" :placeholder="t('Changelog, highlights, etc.')" class="focus-outline-none focus-ring focus-shadow" />
        </UiFormField>

        <div>
          <div class="flex-align-center flex-justify-space-between mt-8px">
            <h3>{{ t('Artifacts') }}</h3>
            <UiButton variant="secondary" size="sm" type="button" @click="$emit('add-artifact')">{{ t('Add artifact') }}</UiButton>
          </div>

          <div v-for="(a, idx) in draft.artifacts" :key="a.id" class="border-radius-12px border-1-light p-12px mt-12px bg-primary">
            <div class="flex-align-center flex-justify-space-between mb-8px">
              <div class="color-text-tertiary fw-500">{{ t('Artifact #{number}', { number: idx + 1 }) }}</div>
              <UiButton
                v-if="draft.artifacts.length > 1"
                variant="secondary"
                size="sm"
                type="button"
                @click="$emit('remove-artifact', idx)"
              >
                {{ t('Remove') }}
              </UiButton>
            </div>

            <div class="gap-12px grid grid-cols-2-minmax0">
              <UiFormField :label="t('Platform')">
                <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.platform" :placeholder="'windows-amd64'" class="focus-outline-none focus-ring focus-shadow" />
              </UiFormField>
              <UiFormField :label="t('Kind')">
                <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.kind" placeholder="browser" class="focus-outline-none focus-ring focus-shadow" />
              </UiFormField>
            </div>

            <div class="gap-12px grid grid-cols-2-minmax0">
              <UiFormField :label="t('CID')">
                <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.cid" :placeholder="t('Optional')" class="focus-outline-none focus-ring focus-shadow" />
              </UiFormField>
              <UiFormField :label="t('SHA-256')">
                <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.sha256Hex" :placeholder="t('64 hex chars')" class="focus-outline-none focus-ring focus-shadow" />
              </UiFormField>
              <UiFormField :label="t('Size (bytes)')">
                <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="a.size" placeholder="123456" class="focus-outline-none focus-ring focus-shadow" />
              </UiFormField>
            </div>

            <UiFormField :label="t('URLs (one per line)')">
              <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model="a.urlsText" rows="3" placeholder="https://example.com/file.exe" class="mono focus-outline-none focus-ring focus-shadow" />
            </UiFormField>
          </div>
        </div>
      </div>

    <template #confirm><span v-if="submitting" class="flex-inline-align-center gap-8px"><UiSpinner size="sm" /> {{ t('Publishing…') }}</span>
          <span v-else>{{ t('Publish') }}</span></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiDialog from '../ui/UiDialog.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import type { ReleaseDraft } from '../types/releasePage';

/**
 * Publishing a release: the version and channel, the notes, and the list of
 * artifacts with their hashes.
 *
 * The draft stays with the page - it is filled from an existing release when
 * one is being superseded, and read back on submit - and so does the artifact
 * list handling, which is why adding and removing one are events rather than
 * something this component does to a prop it does not own.
 */
defineProps<{
  modelValue: boolean;
  draft: ReleaseDraft;
  githubReleaseUrl: string;
  /** Channels the chain accepts, from the release params. */
  channelOptions: string[];
  /** Cap on the notes field, shown as a counter. */
  maxNotesLen?: number;
  importingGithub?: boolean;
  submitting?: boolean;
}>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:githubReleaseUrl', value: string): void;
  (e: 'submit'): void;
  (e: 'add-artifact'): void;
  (e: 'remove-artifact', index: number): void;
  (e: 'import-github'): void;
}>();
</script>