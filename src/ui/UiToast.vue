<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container flex flex-column fixed gap-8px cursor-events-none bottom-20px max-w-380px">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast bg-primary flex-align-start border-radius-md gap-10px py-12px px-14px border-default shadow-md cursor-events-auto min-w-280px"
        :class="[`toast-${toast.type}`, { 'toast-dismissible cursor-pointer': toast.dismissible }]"
        @click="toast.dismissible && removeToast(toast.id)"
      >
        <div class="toast-icon flex-align-justify-center size-24px border-radius-circle flex-shrink-0">
          <CheckCircle v-if="toast.type === 'success'" :size="18" />
          <AlertCircle v-else-if="toast.type === 'error'" :size="18" />
          <AlertTriangle v-else-if="toast.type === 'warning'" :size="18" />
          <Info v-else :size="18" />
        </div>
        <div class="toast-content flex flex-column flex-1 gap-2px min-w-0">
          <span v-if="toast.title" class="toast-title text-13px txt-weight-light color-text-primary">{{ toast.title }}</span>
          <span class="toast-message text-12px color-text-secondary line-height-14 break-word">{{ toast.message }}</span>
        </div>
        <div v-if="toast.copyable || toast.dismissible" class="toast-actions flex-align-start flex-shrink-0 gap-4px">
          <button
            v-if="toast.copyable"
            class="toast-action flex-align-justify-center border-radius-circle color-text-tertiary cursor-pointer flex-shrink-0 bg-transparent border-none transition-all-015 h-20px w-20px hover-bg-tertiary hover-color-text-primary"
            :class="{ 'toast-action-copied': copiedState[toast.id] }"
            :title="copiedState[toast.id] ? 'Copied' : 'Copy message'"
            @click.stop="copyToast(toast)"
          >
            <Check v-if="copiedState[toast.id]" :size="14" />
            <Copy v-else :size="14" />
          </button>
          <button v-if="toast.dismissible" class="toast-action flex-align-justify-center border-radius-circle color-text-tertiary cursor-pointer flex-shrink-0 bg-transparent border-none transition-all-015 h-20px w-20px hover-bg-tertiary hover-color-text-primary" title="Dismiss" @click.stop="removeToast(toast.id)">
            <X :size="14" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, Copy, Check } from 'lucide-vue-next';
import { toastList, removeToast, type Toast } from '../stores/toastStore';

const toasts = toastList;
const copiedState = ref<Record<string, boolean>>({});

function markToastCopied(id: string) {
  copiedState.value = { ...copiedState.value, [id]: true };
  window.setTimeout(() => {
    const nextState = { ...copiedState.value };
    delete nextState[id];
    copiedState.value = nextState;
  }, 2000);
}

function fallbackCopy(value: string) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

async function copyToast(toast: Toast) {
  const value = [toast.title, toast.message].filter(Boolean).join('\n');

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      fallbackCopy(value);
    }
    markToastCopied(toast.id);
  } catch {
    fallbackCopy(value);
    markToastCopied(toast.id);
  }
}
</script>
