import { toastList, addToast, removeToast, clearToasts, type ToastType, type Toast } from '../stores/toastStore';
import type { ToastOptions } from '../types/toast';

export { type ToastType, type Toast };

export function useToast() {
  const success = (message: string, options?: ToastOptions) => 
    addToast('success', message, options);
  
  const error = (message: string, options?: ToastOptions) => 
    addToast('error', message, options);
  
  const warning = (message: string, options?: ToastOptions) => 
    addToast('warning', message, options);
  
  const info = (message: string, options?: ToastOptions) => 
    addToast('info', message, options);

  // Convenience method for API responses
  const fromResult = (result: { ok?: boolean; error?: string; message?: string }, successMsg?: string) => {
    if (result.ok) {
      success(successMsg || result.message || 'Operation completed successfully');
    } else {
      error(result.error || result.message || 'Operation failed');
    }
    return result.ok;
  };

  return {
    toasts: toastList,
    success,
    error,
    warning,
    info,
    fromResult,
    removeToast,
    clearToasts,
  };
}
