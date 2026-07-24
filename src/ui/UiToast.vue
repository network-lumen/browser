<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="flex flex-column fixed gap-8px cursor-events-none bottom-20px right-20px z-99999 max-w-380px">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="bg-primary flex-align-start border-radius-12px gap-10px py-12px px-16px border-default shadow-md cursor-events-auto min-w-280px backdrop-blur-12"
        :class="{ 'hover-bg-secondary cursor-pointer': toast.dismissible }"
        @click="toast.dismissible && removeToast(toast.id)"
      >
        <UiIconBadge size-class="size-24px" badge-class="flex-shrink-0" :style="toastIconStyle(toast.type)">
          <CheckCircle v-if="toast.type === 'success'" :size="18" />
          <AlertCircle v-else-if="toast.type === 'error'" :size="18" />
          <AlertTriangle v-else-if="toast.type === 'warning'" :size="18" />
          <Info v-else :size="18" />
        </UiIconBadge>
        <div class="flex flex-column flex-1 gap-2px min-w-0">
          <span v-if="toast.title" class="text-13px txt-weight-light color-text-primary line-height-12">{{ toast.title }}</span>
          <span class="text-12px color-text-secondary line-height-14 break-word cursor-select-text">{{ toast.message }}</span>
        </div>
        <div v-if="toast.copyable || toast.dismissible" class="flex-align-start flex-shrink-0 gap-4px">
          <button
            v-if="toast.copyable"
            class="toast-action flex-align-justify-center border-radius-circle color-text-tertiary cursor-pointer flex-shrink-0 bg-transparent border-none transition-all-fast h-20px w-20px hover-bg-primary hover-color-text-primary"
            :title="copiedState[toast.id] ? 'Copied' : 'Copy message'"
            @click.stop="copyToast(toast)"
          >
            <Check v-if="copiedState[toast.id]" :size="14" />
            <Copy v-else :size="14" />
          </button>
          <button v-if="toast.dismissible" class="toast-action flex-align-justify-center border-radius-circle color-text-tertiary cursor-pointer flex-shrink-0 bg-transparent border-none transition-all-fast h-20px w-20px hover-bg-primary hover-color-text-primary" title="Dismiss" @click.stop="removeToast(toast.id)">
            <X :size="14" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import UiIconBadge from './UiIconBadge.vue';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, Copy, Check } from 'lucide-vue-next';
import { toastList, removeToast, type Toast, type ToastType } from '../stores/toastStore';

const toasts = toastList;
const copiedState = ref<Record<string, boolean>>({});

const toastIconColors: Record<ToastType, { color: string; background: string }> = {
  success: { color: 'var(--color-success)', background: 'rgba(var(--color-success-rgb), 0.12)' },
  error: { color: 'var(--color-error)', background: 'rgba(var(--color-error-rgb), 0.12)' },
  warning: { color: 'var(--color-warning)', background: 'rgba(var(--color-warning-rgb), 0.12)' },
  info: { color: 'var(--color-primary)', background: 'rgba(var(--color-primary-rgb), 0.12)' },
};

function toastIconStyle(type: ToastType) {
  return toastIconColors[type];
}

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
