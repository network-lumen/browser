import { ref, readonly, type Ref } from 'vue';
import type { Toast, ToastType } from '../types/toast';

// Global shared toast state - singleton pattern
const toasts = ref<Toast[]>([]);
let toastCounter = 0;

function generateId(): string {
  return `toast-${++toastCounter}-${Date.now()}`;
}

export function addToast(type: ToastType, message: string, options: { title?: string; duration?: number; dismissible?: boolean; copyable?: boolean } = {}) {
  const id = generateId();
  const toast: Toast = {
    id,
    type,
    message,
    title: options.title,
    duration: options.duration ?? (type === 'error' ? 10000 : 4000),
    dismissible: options.dismissible ?? true,
    copyable: options.copyable ?? type === 'error',
  };

  toasts.value.push(toast);

  // Auto remove after duration
  if (toast.duration && toast.duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, toast.duration);
  }

  return id;
}

export function removeToast(id: string) {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
}

export function clearToasts() {
  toasts.value = [];
}

// Export readonly ref for components to consume
export const toastList = readonly(toasts) as Ref<readonly Toast[]>;
