import { t } from '../stores/i18nStore';
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

  /**
   * Same thing as the four above, chosen by argument instead of by method
   * name. Five pages had each grown their own copy of this dispatch, differing
   * only in which of the four types they bothered to handle - so a caller that
   * passed 'warning' to the wrong one silently got a success toast.
   */
  const show = (message: string, type: ToastType = 'success', options?: ToastOptions) =>
    addToast(type, message, options);

  // Convenience method for API responses
  const fromResult = (result: { ok?: boolean; error?: string; message?: string }, successMsg?: string) => {
    if (result.ok) {
      success(successMsg || errorMessage(result, t('Operation completed successfully')));
    } else {
      error(result.error || errorMessage(result, t('Operation failed')));
    }
    return result.ok;
  };

  return {
    success,
    error,
    warning,
    info,
    show,
    fromResult,
  };
}
