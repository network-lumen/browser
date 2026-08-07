/**
 * Recurring Payments Service
 * 
 * Manages scheduled automatic payments, subscriptions, and payment reminders
 */

import type {
  PaymentFrequency,
  PaymentStatus,
  RecurringPayment,
  PaymentHistory,
  PaymentReminder,
} from '../../types/recurringPayments';
import { STORAGE_KEYS, readJson, writeJson } from './storage';

export type { PaymentFrequency, PaymentStatus, RecurringPayment, PaymentHistory, PaymentReminder };

class RecurringPaymentsService {
  private storageKey = STORAGE_KEYS.recurringPayments;
  private historyKey = STORAGE_KEYS.paymentHistory;
  private remindersKey = STORAGE_KEYS.paymentReminders;


  /**
   * Get all recurring payments
   */
  getRecurringPayments(): RecurringPayment[] {
    try {
      const payments = readJson<any[]>(this.storageKey, []);
      return payments.map((p: any) => ({
        ...p,
        startDate: new Date(p.startDate),
        endDate: p.endDate ? new Date(p.endDate) : undefined,
        nextPaymentDate: new Date(p.nextPaymentDate),
        lastPaymentDate: p.lastPaymentDate ? new Date(p.lastPaymentDate) : undefined,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }));
    } catch (e) {
      console.error('Failed to load recurring payments:', e);
      return [];
    }
  }

  /**
   * Get a specific recurring payment by ID
   */
  getRecurringPayment(id: string): RecurringPayment | null {
    const payments = this.getRecurringPayments();
    return payments.find(p => p.id === id) || null;
  }

  /**
   * Create a new recurring payment
   */
  createRecurringPayment(payment: Omit<RecurringPayment, 'id' | 'createdAt' | 'updatedAt' | 'totalPayments' | 'successfulPayments' | 'failedPayments'>): RecurringPayment {
    const newPayment: RecurringPayment = {
      ...payment,
      id: this.generateId(),
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const payments = this.getRecurringPayments();
    payments.push(newPayment);
    this.saveRecurringPayments(payments);

    // Create initial reminder if enabled
    if (newPayment.reminderEnabled) {
      this.createReminder(newPayment);
    }

    return newPayment;
  }

  /**
   * Update a recurring payment
   */
  updateRecurringPayment(id: string, updates: Partial<RecurringPayment>): RecurringPayment | null {
    const payments = this.getRecurringPayments();
    const index = payments.findIndex(p => p.id === id);
    
    if (index === -1) return null;

    payments[index] = {
      ...payments[index],
      ...updates,
      updatedAt: new Date(),
    };

    this.saveRecurringPayments(payments);
    return payments[index];
  }

  /**
   * Delete a recurring payment
   */
  deleteRecurringPayment(id: string): boolean {
    const payments = this.getRecurringPayments();
    const filtered = payments.filter(p => p.id !== id);
    
    if (filtered.length === payments.length) return false;

    this.saveRecurringPayments(filtered);
    
    // Delete associated reminders
    this.deleteRemindersByPaymentId(id);
    
    return true;
  }

  /**
   * Pause a recurring payment
   */
  pauseRecurringPayment(id: string): boolean {
    const payment = this.updateRecurringPayment(id, { status: 'paused' });
    return payment !== null;
  }

  /**
   * Resume a recurring payment
   */
  resumeRecurringPayment(id: string): boolean {
    const payment = this.getRecurringPayment(id);
    if (!payment) return false;

    // Recalculate next payment date if it's in the past
    let nextPaymentDate = payment.nextPaymentDate;
    if (nextPaymentDate < new Date()) {
      nextPaymentDate = this.calculateNextPaymentDate(new Date(), payment.frequency);
    }

    this.updateRecurringPayment(id, { 
      status: 'active',
      nextPaymentDate 
    });
    
    return true;
  }

  /**
   * Calculate next payment date based on frequency
   */
  calculateNextPaymentDate(fromDate: Date, frequency: PaymentFrequency): Date {
    const date = new Date(fromDate);
    
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    
    return date;
  }

  /**
   * Get payment history
   */
  getPaymentHistory(recurringPaymentId?: string): PaymentHistory[] {
    try {
      let history = readJson<any[]>(this.historyKey, []).map((h: any) => ({
        ...h,
        executedAt: new Date(h.executedAt),
      }));

      if (recurringPaymentId) {
        history = history.filter((h: PaymentHistory) => h.recurringPaymentId === recurringPaymentId);
      }

      return history.sort((a: PaymentHistory, b: PaymentHistory) => 
        b.executedAt.getTime() - a.executedAt.getTime()
      );
    } catch (e) {
      console.error('Failed to load payment history:', e);
      return [];
    }
  }

  /**
   * Add payment to history
   */
  addPaymentHistory(history: Omit<PaymentHistory, 'id'>): PaymentHistory {
    const newHistory: PaymentHistory = {
      ...history,
      id: this.generateId(),
    };

    const allHistory = this.getPaymentHistory();
    allHistory.push(newHistory);
    
    if (!writeJson(this.historyKey, allHistory)) console.error('Failed to save payment history');

    return newHistory;
  }

  /**
   * Get active payment reminders
   */
  getReminders(): PaymentReminder[] {
    try {
      return readJson<any[]>(this.remindersKey, [])
        .map((r: any) => ({
          ...r,
          scheduledDate: new Date(r.scheduledDate),
          reminderDate: new Date(r.reminderDate),
          createdAt: new Date(r.createdAt),
        }))
        .filter((r: PaymentReminder) => !r.dismissed)
        .sort((a: PaymentReminder, b: PaymentReminder) => 
          a.reminderDate.getTime() - b.reminderDate.getTime()
        );
    } catch (e) {
      console.error('Failed to load reminders:', e);
      return [];
    }
  }

  /**
   * Create a reminder for a payment
   */
  createReminder(payment: RecurringPayment): PaymentReminder | null {
    if (!payment.reminderEnabled) return null;

    const reminderDate = new Date(payment.nextPaymentDate);
    reminderDate.setDate(reminderDate.getDate() - payment.reminderDaysBefore);

    // Don't create reminder if it's in the past
    if (reminderDate < new Date()) return null;

    const reminder: PaymentReminder = {
      id: this.generateId(),
      recurringPaymentId: payment.id,
      paymentName: payment.name,
      amount: payment.amount,
      scheduledDate: payment.nextPaymentDate,
      reminderDate,
      dismissed: false,
      createdAt: new Date(),
    };

    const reminders = this.getAllReminders();
    reminders.push(reminder);
    this.saveReminders(reminders);

    return reminder;
  }

  /**
   * Dismiss a reminder
   */
  dismissReminder(id: string): boolean {
    const reminders = this.getAllReminders();
    const index = reminders.findIndex(r => r.id === id);
    
    if (index === -1) return false;

    reminders[index].dismissed = true;
    this.saveReminders(reminders);
    
    return true;
  }

  /**
   * Execute a recurring payment
   */
  async executePayment(
    paymentId: string, 
    executeFunction: (payment: RecurringPayment) => Promise<{ success: boolean; txHash?: string; error?: string }>
  ): Promise<boolean> {
    const payment = this.getRecurringPayment(paymentId);
    if (!payment || payment.status !== 'active') return false;

    try {
      const result = await executeFunction(payment);

      // Record in history
      this.addPaymentHistory({
        recurringPaymentId: payment.id,
        txHash: result.txHash,
        amount: payment.amount,
        status: result.success ? 'success' : 'failed',
        executedAt: new Date(),
        error: result.error,
      });

      // Update payment stats
      const updates: Partial<RecurringPayment> = {
        totalPayments: payment.totalPayments + 1,
        lastPaymentDate: new Date(),
      };

      if (result.success) {
        updates.successfulPayments = payment.successfulPayments + 1;
        updates.nextPaymentDate = this.calculateNextPaymentDate(new Date(), payment.frequency);
        
        // Check if we've reached max payments
        if (payment.maxPayments && updates.totalPayments !== undefined && updates.totalPayments >= payment.maxPayments) {
          updates.status = 'completed';
        }
        
        // Check if we've passed end date
        if (payment.endDate && updates.nextPaymentDate && updates.nextPaymentDate > payment.endDate) {
          updates.status = 'completed';
        }

        // Create next reminder
        if (payment.reminderEnabled && updates.status === 'active') {
          const updatedPayment = { ...payment, ...updates };
          this.createReminder(updatedPayment as RecurringPayment);
        }
      } else {
        updates.failedPayments = payment.failedPayments + 1;
      }

      this.updateRecurringPayment(paymentId, updates);
      return result.success;
    } catch (e) {
      console.error('Failed to execute payment:', e);
      return false;
    }
  }

  // There is deliberately no checkDuePayments() and no timer.
  //
  // Recurring payments in Lumen are a reminder plus a confirmation dialog,
  // never an execution: signing needs the session password, and an app that
  // spends on a schedule is not something a user can supervise. A method that
  // fires every due payment in a loop existed here, unused, next to a
  // constructor that armed a 60-second setInterval whose callback was empty
  // and which nothing could stop - a wake-up a minute for nothing, and a
  // strong hint to the next reader that this runs on a timer. It does not.
  //
  // The one path that spends is payReminder() in paymentReminders.ts: one
  // reminder, one confirmation, one signature.

  // Private helper methods

  private getAllReminders(): PaymentReminder[] {
    try {
      return readJson<any[]>(this.remindersKey, []).map((r: any) => ({
        ...r,
        scheduledDate: new Date(r.scheduledDate),
        reminderDate: new Date(r.reminderDate),
        createdAt: new Date(r.createdAt),
      }));
    } catch {
      return [];
    }
  }

  private saveRecurringPayments(payments: RecurringPayment[]): void {
    if (!writeJson(this.storageKey, payments)) console.error('Failed to save recurring payments');
  }

  private saveReminders(reminders: PaymentReminder[]): void {
    if (!writeJson(this.remindersKey, reminders)) console.error('Failed to save reminders');
  }

  private deleteRemindersByPaymentId(paymentId: string): void {
    const reminders = this.getAllReminders();
    const filtered = reminders.filter(r => r.recurringPaymentId !== paymentId);
    this.saveReminders(filtered);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let recurringPaymentsInstance: RecurringPaymentsService | null = null;

export function getRecurringPaymentsService(): RecurringPaymentsService {
  if (!recurringPaymentsInstance) {
    recurringPaymentsInstance = new RecurringPaymentsService();
  }
  return recurringPaymentsInstance;
}
