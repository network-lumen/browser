<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="[`toast-${toast.type}`, { 'toast-dismissible': toast.dismissible }]"
        @click="toast.dismissible && removeToast(toast.id)"
      >
        <div class="toast-icon">
          <CheckCircle v-if="toast.type === 'success'" :size="18" />
          <AlertCircle v-else-if="toast.type === 'error'" :size="18" />
          <AlertTriangle v-else-if="toast.type === 'warning'" :size="18" />
          <Info v-else :size="18" />
        </div>
        <div class="toast-content">
          <span v-if="toast.title" class="toast-title">{{ toast.title }}</span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
        <div v-if="toast.copyable || toast.dismissible" class="toast-actions">
          <button
            v-if="toast.copyable"
            class="toast-action"
            :class="{ 'toast-action-copied': copiedState[toast.id] }"
            :title="copiedState[toast.id] ? 'Copied' : 'Copy message'"
            @click.stop="copyToast(toast)"
          >
            <Check v-if="copiedState[toast.id]" :size="14" />
            <Copy v-else :size="14" />
          </button>
          <button v-if="toast.dismissible" class="toast-action" title="Dismiss" @click.stop="removeToast(toast.id)">
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

<style scoped>
.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  max-width: 380px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--border-radius-md, 10px);
  background: var(--bg-primary, #fff);
  border: 0.5px solid var(--border-primary, rgba(0,0,0,0.08));
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15));
  pointer-events: auto;
  min-width: 280px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.toast-dismissible {
  cursor: pointer;
}

.toast-dismissible:hover {
  background: var(--bg-secondary, #f5f5f7);
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.toast-success .toast-icon {
  color: var(--ios-green, #30d158);
  background: rgba(48, 209, 88, 0.12);
}

.toast-error .toast-icon {
  color: var(--ios-red, #ff453a);
  background: rgba(255, 69, 58, 0.12);
}

.toast-warning .toast-icon {
  color: var(--ios-orange, #ff9f0a);
  background: rgba(255, 159, 10, 0.12);
}

.toast-info .toast-icon {
  color: var(--ios-blue, #007aff);
  background: rgba(0, 122, 255, 0.12);
}

.toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.toast-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #1d1d1f);
  line-height: 1.3;
}

.toast-message {
  font-size: 12px;
  color: var(--text-secondary, #86868b);
  line-height: 1.4;
  word-break: break-word;
  user-select: text;
}

.toast-actions {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.toast-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--text-tertiary, #aeaeb2);
  cursor: pointer;
  transition: all 0.15s ease;
  margin: -2px -4px -2px 0;
}

.toast-action:hover {
  background: var(--bg-tertiary, rgba(0,0,0,0.05));
  color: var(--text-primary, #1d1d1f);
}

.toast-action-copied {
  color: var(--ios-green, #30d158);
}

/* Animations */
.toast-enter-active {
  animation: toast-in 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.2s ease-in forwards;
}

@keyframes toast-in {
  0% {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-out {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
}

/* Dark mode adjustments */
:root[data-theme="dark"] .toast {
  background: rgba(44, 44, 46, 0.95);
  border-color: rgba(255,255,255,0.1);
}
</style>
