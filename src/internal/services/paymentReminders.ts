import { computed, ref } from 'vue';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { activeProfileId, getActiveProfile } from '../profilesStore';
import { getRecurringPaymentsService } from './recurringPayments';
import type { RecurringPayment, ReminderPaymentResult } from '../../types/recurringPayments';

export type { ReminderPaymentResult };

/**
 * Surfaces reminders whose date has passed and pays them, one explicit
 * confirmation at a time.
 *
 * Nothing here is automatic on purpose. `recurringPayments.checkDuePayments()`
 * would fire every due payment without asking, which is why it stays unused:
 * signing needs the session password, and an app that spends on a timer is not
 * something a user can supervise. The watcher only refreshes the list.
 */

/** Due reminders the user chose to set aside. Not persisted: a restart re-proposes them. */
const snoozed = ref<Set<string>>(new Set());
const dueList = ref<RecurringPayment[]>([]);
const paying = ref<string | null>(null);

/** Reminders are daily at the finest, so a slow poll is plenty. */
const WATCH_INTERVAL_MS = 5 * 60 * 1000;
let watchTimer: number | null = null;

function service() {
  return getRecurringPaymentsService();
}

/** Active reminders whose next date has passed. */
export function refreshDuePayments(): void {
  const now = Date.now();
  dueList.value = service()
    .getRecurringPayments()
    .filter((payment) => payment.status === 'active')
    .filter((payment) => new Date(payment.nextPaymentDate).getTime() <= now);
}

/** Due reminders minus the ones set aside for this run. */
export const duePayments = computed(() =>
  dueList.value.filter((payment) => !snoozed.value.has(payment.id))
);

export const isPaying = computed(() => paying.value);

/** Sets a reminder aside until the app restarts. */
export function snoozeUntilRestart(id: string): void {
  const next = new Set(snoozed.value);
  next.add(id);
  snoozed.value = next;
}

export function snoozeAllUntilRestart(): void {
  const next = new Set(snoozed.value);
  for (const payment of dueList.value) next.add(payment.id);
  snoozed.value = next;
}

/**
 * Sends one reminder's payment. Only ever called from an explicit user action;
 * the amount, recipient and memo come from the reminder itself.
 */
export async function payReminder(paymentId: string): Promise<ReminderPaymentResult> {
  const payment = service().getRecurringPayment(paymentId);
  if (!payment) return { ok: false, error: 'Reminder not found' };

  const api: any = useInternalLumen();
  const walletApi = api?.wallet;
  if (!walletApi || typeof walletApi.sendTokens !== 'function') {
    return { ok: false, error: 'Wallet bridge not available' };
  }

  const profileId = activeProfileId.value;
  if (!profileId) return { ok: false, error: 'No active profile selected' };

  const profile: any = getActiveProfile();
  const from = String(profile?.address || profile?.walletAddress || '').trim();
  if (!from) return { ok: false, error: 'No sender address available' };

  paying.value = paymentId;
  try {
    const res = await walletApi.sendTokens({
      profileId,
      from,
      to: payment.recipient,
      amount: payment.amount,
      denom: 'ulmn',
      memo: `Recurring: ${payment.name}`
    });

    if (!res || res.ok === false) {
      const error = String(res?.error || 'Transaction failed');
      if (error === 'password_required' || error === 'invalid_password') {
        try {
          await api?.security?.lockSession?.();
        } catch {
          // Locking is best-effort; the caller still learns it needs a password.
        }
        return { ok: false, error: 'Wallet locked. Unlock to continue.', locked: true };
      }
      return { ok: false, error };
    }

    // Records history, advances nextPaymentDate, and queues the next reminder.
    await service().executePayment(paymentId, async () => ({
      success: true,
      txHash: res.txhash
    }));

    refreshDuePayments();
    return { ok: true, txHash: res.txhash };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || 'Unexpected error') };
  } finally {
    paying.value = null;
  }
}

/** Idempotent. Refreshes immediately, then on a slow interval. */
export function startDueWatcher(): void {
  refreshDuePayments();
  if (watchTimer != null) return;
  watchTimer = window.setInterval(refreshDuePayments, WATCH_INTERVAL_MS);
}

export function stopDueWatcher(): void {
  if (watchTimer == null) return;
  window.clearInterval(watchTimer);
  watchTimer = null;
}
