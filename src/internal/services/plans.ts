import type { PlanView } from '../../types/drivePage';
import { t } from '../../stores/i18nStore';

/**
 * How a hosting plan reads.
 *
 * These were DrivePage's, handed down to two dialogs as function props - so a
 * plan card asked its parent what to call a plan and how to price it, and the
 * two dialogs could only agree because the same page happened to feed both.
 *
 * Whether a plan is subscribed is deliberately not here: that answer comes
 * from the subscriptions the page holds, so the page still supplies the
 * status and everything below turns it into words and colours.
 */

const ULMN_PER_LMN = 1_000_000;

export function planDisplayName(plan: PlanView | null): string {
  return plan?.planId?.split(':').pop() || 'Plan';
}

/** Two decimals below ten, none above - a price is a glance, not an invoice. */
function formatLmn(ulmn: number): string {
  const lmn = ulmn / ULMN_PER_LMN;
  return lmn.toFixed(lmn >= 10 ? 0 : 2);
}

export function formatPlanPrice(ulmn: number): string {
  if (!ulmn) return t('Free');
  return t('{amount} LMN / mo', { amount: formatLmn(ulmn) });
}

/** Same price without the period, for somewhere too narrow to carry it. */
export function formatPlanPriceShort(ulmn: number): string {
  if (!ulmn) return t('Free');
  return `${formatLmn(ulmn)} LMN`;
}

/** The label doubles as the call to action, which is why "none" reads "Subscribe". */
export function planStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return t('Subscribed');
    case 'pending':
      return t('Pending');
    case 'cancelled':
    case 'canceled':
      return t('Cancelled');
    case 'completed':
      return t('Completed');
    default:
      return t('Subscribe');
  }
}

export function planStatusBadgeClass(status: string): string {
  if (status === 'active') return 'bg-fill-success color-success';
  if (status === 'pending') return 'bg-warning-a15 color-warning';
  return '';
}
