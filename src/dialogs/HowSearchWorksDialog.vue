<template>
  <UiModal :model-value="modelValue" panel-class="searchpage-help-modal w-min-760px-full" @update:model-value="$emit('update:modelValue', false)">
    <template #header>
      <div class="flex-align-start gap-12px min-w-0">
        <div class="flex-inline-align-justify-center size-36px border-radius-12px color-text-primary flex-0-0-auto border-1-light bg-primary-a10" aria-hidden="true">
          <HelpCircle :size="18" />
        </div>
        <div>
          <h2 class="m-0px txt-weight-strong color-text-primary text-16px">How search works</h2>
          <p class="color-text-secondary text-14px m-0px mt-4px">Indexing, ranking, and how to get discovered.</p>
        </div>
      </div>
    </template>
        <div class="max-h-min-72vh-720px color-text-primary">
          <div class="grid gap-y-14px gap-x-16px grid-cols-2-minmax0">
            <UiTitledCard title="What gets indexed">
              <p class="m-0px mt-8px color-text-secondary line-height-14">
                Search results come from content indexed in the Lumen Cloud. When content is
                uploaded to cloud storage, it’s scanned and tagged so it can be discovered by
                keywords.
              </p>
              <div class="flex-align-start mt-12px border-radius-14px gap-10px py-12px px-16px bg-indigo-a08 border-1-indigo-a15">
                <Sparkles :size="16" class="mt-0px color-text-primary flex-0-0-auto opacity-85" />
                <div class="color-text-secondary line-height-14 text-14px">
                  Local-only content on your machine stays private and won’t appear in network
                  search.
                </div>
              </div>
            </UiTitledCard>

            <UiTitledCard title="How to get indexed">
              <ol class="flex flex-column p-0px color-text-secondary list-style-none gap-8px line-height-14 m-0px mt-8px">
                <li class="flex gap-10px">
                  <span class="flex-inline-align-justify-center flex-0-0-auto w-24px h-24px border-radius-10px border-1-light bg-card color-text-tertiary txt-weight-strong text-12px mt-005rem">1</span>
                  <span class="min-w-0">
                    Upload your content to the cloud (Drive / cloud upload).
                  </span>
                </li>
                <li class="flex gap-10px">
                  <span class="flex-inline-align-justify-center flex-0-0-auto w-24px h-24px border-radius-10px border-1-light bg-card color-text-tertiary txt-weight-strong text-12px mt-005rem">2</span>
                  <span class="min-w-0">
                    Indexing is async — it can take a bit before results show up.
                  </span>
                </li>
                <li class="flex gap-10px">
                  <span class="flex-inline-align-justify-center flex-0-0-auto w-24px h-24px border-radius-10px border-1-light bg-card color-text-tertiary txt-weight-strong text-12px mt-005rem">3</span>
                  <span class="min-w-0">
                    For websites: publish a folder with an <code>index.html</code> entrypoint.
                  </span>
                </li>
              </ol>
            </UiTitledCard>

            <UiTitledCard title="How queries work">
              <ul class="list-style-disc pl-20px color-text-secondary line-height-14 m-0px mt-8px">
                <li class="m-0px mt-8px mb-8px">
                  Queries are tokenized; the index uses an inverted map (token → content) to find
                  matches efficiently.
                </li>
                <li class="m-0px mt-8px mb-8px">
                  Very short queries can behave like “Explore” (show recent content) instead of
                  strict keyword matching.
                </li>
                <li class="m-0px mt-8px mb-8px">
                  Tabs switch mode: <strong>Sites</strong>, <strong>Images</strong>, or
                  <strong>Explore everything</strong>.
                </li>
              </ul>
            </UiTitledCard>

            <UiTitledCard title="How results are ranked">
              <ul class="list-style-disc pl-20px color-text-secondary line-height-14 m-0px mt-8px">
                <li class="m-0px mt-8px mb-8px"><strong>Relevance</strong>: token matches in extracted tags/text.</li>
                <li class="m-0px mt-8px mb-8px"><strong>Freshness</strong>: recently seen content tends to rank higher.</li>
                <li class="m-0px mt-8px mb-8px"><strong>Popularity</strong>: signals like views and saves.</li>
                <li class="m-0px mt-8px mb-8px"><strong>Availability</strong>: prefer content that is reachable and healthy.</li>
                <li class="m-0px mt-8px mb-8px"><strong>Verified sites</strong>: linked domains can be boosted.</li>
              </ul>
            </UiTitledCard>

            <p class="color-text-secondary border-radius-14px border-1-light bg-primary text-14px py-12px px-16px m-0px mt-4px grid-col-full">
              Results can vary while indexing is in progress and as the network evolves.
            </p>
          </div>
        </div>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiTitledCard from '../ui/UiTitledCard.vue';
import { HelpCircle, Sparkles } from 'lucide-vue-next';

/**
 * The "how search works" explainer behind the question mark on SearchPage.
 *
 * Pure copy - it reads nothing and changes nothing, which is why it was
 * eighty-five lines of a four-thousand-line page for no reason.
 */
defineProps<{ modelValue: boolean }>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
</script>