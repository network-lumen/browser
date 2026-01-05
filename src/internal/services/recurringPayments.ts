/**
 * Recurring Payments Service
 * 
 * Manages scheduled automatic payments, subscriptions, and payment reminders
 */

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

class RecurringPaymentsService {
  private storageKey = 'lumen_recurring_payments';
  private historyKey = 'lumen_payment_history';
  private remindersKey = 'lumen_payment_reminders';
  private checkInterval: number | null = null;

  constructor() {
    this.startPaymentChecker();
  }

  /**
   * Get all recurring payments
   */
  getRecurringPayments(): RecurringPayment[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      const payments = JSON.parse(data);
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
      const data = localStorage.getItem(this.historyKey);
      if (!data) return [];
      
      let history = JSON.parse(data).map((h: any) => ({
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
    
    try {
      localStorage.setItem(this.historyKey, JSON.stringify(allHistory));
    } catch (e) {
      console.error('Failed to save payment history:', e);
    }

    return newHistory;
  }

  /**
   * Get active payment reminders
   */
  getReminders(): PaymentReminder[] {
    try {
      const data = localStorage.getItem(this.remindersKey);
      if (!data) return [];
      
      return JSON.parse(data)
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

  /**
   * Check for due payments and reminders
   */
  async checkDuePayments(
    executeFunction: (payment: RecurringPayment) => Promise<{ success: boolean; txHash?: string; error?: string }>
  ): Promise<void> {
    const payments = this.getRecurringPayments();
    const now = new Date();

    for (const payment of payments) {
      if (payment.status !== 'active') continue;
      if (payment.nextPaymentDate > now) continue;

      // Execute the payment
      await this.executePayment(payment.id, executeFunction);
    }
  }

  /**
   * Start automatic payment checker
   */
  startPaymentChecker(): void {
    if (this.checkInterval !== null) return;

    // Check every minute
    this.checkInterval = window.setInterval(() => {
      // This is just a placeholder - actual execution needs to be triggered by the app
      // The app should call checkDuePayments with the actual execute function
    }, 60000);
  }

  /**
   * Stop automatic payment checker
   */
  stopPaymentChecker(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Private helper methods

  private getAllReminders(): PaymentReminder[] {
    try {
      const data = localStorage.getItem(this.remindersKey);
      if (!data) return [];
      return JSON.parse(data).map((r: any) => ({
        ...r,
        scheduledDate: new Date(r.scheduledDate),
        reminderDate: new Date(r.reminderDate),
        createdAt: new Date(r.createdAt),
      }));
    } catch (e) {
      return [];
    }
  }

  private saveRecurringPayments(payments: RecurringPayment[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(payments));
    } catch (e) {
      console.error('Failed to save recurring payments:', e);
    }
  }

  private saveReminders(reminders: PaymentReminder[]): void {
    try {
      localStorage.setItem(this.remindersKey, JSON.stringify(reminders));
    } catch (e) {
      console.error('Failed to save reminders:', e);
    }
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
