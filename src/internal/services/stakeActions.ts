import { t } from '../../stores/i18nStore';
import type { StakeAction } from '../../types/networkPage';

/**
 * What each of the four stake actions is called on screen.
 *
 * The dialog names them on its tabs and in its labels; the page names them in
 * the toast it raises once the transaction comes back, and neither can read the
 * other's table. Kept here so a rewording lands in both at once.
 *
 * Every entry is a function, not a string: a table built at module scope would
 * hold whichever language was active when the module first loaded, and the app
 * lets the user change language without reloading.
 *
 * One whole sentence per action rather than a frame with the verb spliced in.
 * A verb dropped into "Amount to " only works in a language that puts it in the
 * same place, and lowercasing it is an English rule, not a universal one.
 */

export const STAKE_ACTION_LABELS: Record<StakeAction, () => string> = {
  Delegate: () => t('Delegate'),
  Undelegate: () => t('Undelegate'),
  Redelegate: () => t('Redelegate'),
  Withdraw: () => t('Withdraw'),
};

export const STAKE_AMOUNT_LABELS: Record<StakeAction, () => string> = {
  Delegate: () => t('Amount to delegate'),
  Undelegate: () => t('Amount to undelegate'),
  Redelegate: () => t('Amount to redelegate'),
  Withdraw: () => t('Amount to withdraw'),
};

export const STAKE_CONFIRM_LABELS: Record<StakeAction, () => string> = {
  Delegate: () => t('Confirm delegation'),
  Undelegate: () => t('Confirm undelegation'),
  Redelegate: () => t('Confirm redelegation'),
  Withdraw: () => t('Confirm withdrawal'),
};

/** Falls back to the chain's own spelling rather than to an empty label. */
export function stakeActionLabel(action: StakeAction): string {
  return STAKE_ACTION_LABELS[action]?.() ?? action;
}
