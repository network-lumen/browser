export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  copyable?: boolean;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
  dismissible?: boolean;
  copyable?: boolean;
}
