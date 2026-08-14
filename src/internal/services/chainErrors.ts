import { t } from '../../stores/i18nStore';
import type { ChainErrorRule } from '../../types/chainErrors';

/**
 * Chain refusals, said in a sentence.
 *
 * A Cosmos error reaches the renderer as the raw string the module returned -
 * "failed to execute message; message index: 0: either metadata or Msgs length
 * must be non-nil: no messages proposed" - and every screen in the app put that
 * in front of the user unchanged, in English, whatever their language. It names
 * a message index and a nil check; it does not say what to do.
 *
 * Every entry below was earned by an actual refusal from this chain, in this
 * app. Nothing is added on the strength of the SDK having an error for it: a
 * pattern that has never fired cannot be checked against reality, and would
 * quietly stop matching the day the wording changed.
 *
 * Matching is on a substring of the module's own text rather than on a code,
 * because the codes do not survive the REST/RPC round trip - only the message
 * does. The fragments chosen are the invariant part, without the message index
 * or any address the chain interpolates.
 */

const RULES: ChainErrorRule[] = [
  {
    // gov v1 refuses a proposal that carries neither an executable message nor
    // metadata. The app sends no metadata, so in practice this means an action
    // is required - which is what the sentence says.
    match: 'either metadata or msgs length must be non-nil',
    message: () =>
      t('A proposal must carry at least one action. Add one so the chain has something to execute if it passes.'),
  },
  {
    // Seen on MsgBeginRedelegate at 250 000 gas, which needed 255 864.
    match: 'out of gas',
    message: () =>
      t('The transaction ran out of gas. This is a limit in the app, not a fee - report it so it can be raised.'),
  },
  {
    // The transitive-redelegation ban. The dialog blocks this before signing,
    // so reaching it means the lock data was stale.
    match: 'redelegation to this validator already in progress',
    message: () =>
      t('This validator is still receiving a redelegation, so stake cannot be moved out of it yet.'),
  },
  {
    // Undelegating or redelegating more than is bonded, and the plain case of
    // a source emptied by an earlier redelegation.
    match: 'invalid shares amount',
    message: () => t('That is more than you have staked with this validator.'),
  },
  {
    match: 'insufficient funds',
    message: () => t('Not enough LMN in this wallet for that.'),
  },
];

/**
 * @returns a sentence for a refusal we recognise, or '' - the caller keeps its
 * own fallback rather than being handed a guess.
 */
export function describeChainError(raw: unknown): string {
  const text = String(raw ?? '').toLowerCase();
  if (!text.trim()) return '';
  const rule = RULES.find((entry) => text.includes(entry.match));
  return rule ? rule.message() : '';
}
