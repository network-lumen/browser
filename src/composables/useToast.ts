import { addToast, type ToastType, type Toast } from '../stores/toastStore';
import type { ToastOptions } from '../types/toast';

import { errorMessage } from '../internal/services/coerce';
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
      success(successMsg || errorMessage(result, 'Operation completed successfully'));
    } else {
      error(result.error || errorMessage(result, 'Operation failed'));
    }
    return result.ok;
  };

  return {
    success,
    error,
    warning,
    info,
    fromResult,
  };
}
