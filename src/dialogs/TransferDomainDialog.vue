<template>
  <UiModal :model-value="modelValue" title="Transfer domain" panel-class="max-w-500px" @update:model-value="$emit('update:modelValue', false)">
        <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
          <p class="text-14px color-text-tertiary m-0px mb-12px">Transfer ownership of this domain to another address.</p>

          <div class="border-radius-10px color-white mb-16px bg-gradient-primary py-12px px-16px">
            <div class="txt-weight-light text-15px">{{ domain?.name || 'mydomain.lmn' }}</div>
            <div class="text-13px mt-4px">
              {{ domain ? expiryLabel : 'Expires: unknown' }}
            </div>
          </div>

          <div class="mb-16px">
            <label class="color-text-secondary block mb-4px text-13px">New Owner Address</label>
            <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
              :model-value="newOwner" @update:model-value="$emit('update:newOwner', $event)"
              placeholder="lmn1..." class="focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
            <p class="text-12px color-text-tertiary mt-8px">Enter the Lumen address of the new owner</p>
          </div>

          <div class="flex border-radius-10px gap-12px p-14px bg-fill-error border-1-error-a30 m-0px mt-16px mb-16px">
            <div class="text-20px flex-shrink-0">⚠️</div>
            <div class="color-text-primary text-13px">
              <strong class="color-error txt-weight-light">Warning:</strong> This action cannot be undone. Once transferred, you will lose control of this domain.
            </div>
          </div>

          <div class="flex flex-justify-end gap-8px">
            <UiButton variant="secondary" type="button" @click="$emit('update:modelValue', false)" class="outline-none">
              Cancel
            </UiButton>
            <UiButton variant="danger" type="button"
              @click="$emit('submit')"
              :disabled="!canSubmit || busy" class="outline-none">
              <span v-if="!busy" class="flex-inline-align-center gap-8px">
                <Send :size="16" />
                Transfer domain
              </span>
              <UiSpinner v-else size="sm" />
            </UiButton>
          </div>
        </div>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiInput from '../ui/UiInput.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { Send } from 'lucide-vue-next';

/** Handing a domain to another address. */
defineProps<{
  modelValue: boolean;
  newOwner: string;
  domain: { name?: string } | null;
  expiryLabel?: string;
  canSubmit: boolean;
  busy?: boolean;
}>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:newOwner', value: string): void;
  (e: 'submit'): void;
}>();
</script>
