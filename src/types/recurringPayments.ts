export type PaymentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export type PaymentStatus = 'active' | 'paused' | 'cancelled' | 'completed' | 'failed';

export interface RecurringPayment {
  id: string;
  name: string;
  description?: string;
  recipient: string;
  amount: number;
  denom: string;
  frequency: PaymentFrequency;
  startDate: Date;
  endDate?: Date;
  nextPaymentDate: Date;
  lastPaymentDate?: Date;
  status: PaymentStatus;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  maxPayments?: number;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Outcome of a user-confirmed reminder payment. */
export type ReminderPaymentResult =
  | { ok: true; txHash?: string }
  | { ok: false; error: string; locked?: boolean };

export interface PaymentHistory {
  id: string;
  recurringPaymentId: string;
  txHash?: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  executedAt: Date;
  error?: string;
}

export interface PaymentReminder {
  id: string;
  recurringPaymentId: string;
  paymentName: string;
  amount: number;
  scheduledDate: Date;
  reminderDate: Date;
  dismissed: boolean;
  createdAt: Date;
}
