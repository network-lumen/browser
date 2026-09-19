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
  {
    // Cosmos gov validates its params as a whole: expedited_min_deposit must
    // stay strictly above min_deposit. Both are reachable from v2.0.0, through
    // tokenomics MsgUpdateGovDepositPolicy, which carries all three deposit
    // fields - so this is now a proposal to fix rather than a dead end.
    match: 'expedited minimum deposit must be greater than minimum deposit',
    message: () =>
      t('The minimum deposit must stay below the expedited minimum deposit. Raise both together in the same proposal.'),
  },
  {
    // gov's own MsgUpdateParams, refused because its configured authority is
    // not the gov account that must sign a proposal message. Nothing a client
    // can do; worth naming so it is not mistaken for a wallet problem.
    match: 'expected gov account as only signer for proposal message',
    message: () =>
      t('This chain does not accept that change through governance: the module expects a different authority.'),
  },
  {
    // The dns rate limit. The settings dialog counts the wait down before
    // anyone can get here, so this only fires when its params were stale.
    match: 'domain updated too recently',
    message: () =>
      t('This domain was updated too recently. Wait for the rate limit to pass and try again.'),
  },
  {
    // v2.0.0 restricts Renew to the grace period. The page hides the button
    // outside it, so reaching this means the lifecycle it drew was stale - the
    // name lapsed, or was rescued, between the page loading and the signature.
    match: 'renewal is only allowed during the grace period',
    message: () =>
      t('This domain can only be renewed once it has expired and entered its grace period.'),
  },
  {
    // Renewing moves expire_at, and both ways out of a bid escrow are windows
    // measured from it - so the chain refuses to strand a bidder's money.
    // Settling is permissionless, which is what makes this actionable.
    match: 'is held in escrow',
    message: () =>
      t('A bid on this domain is being held, so it cannot be renewed. Settle the auction first - anyone can.'),
  },
  {
    // The update proof-of-work commits to the domain's updated_at from v2.0.0,
    // so a nonce is good for one update. Reaching this means the record moved
    // between the nonce being mined and the transaction landing.
    match: 'invalid proof-of-work for update',
    message: () =>
      t('This domain changed while the update was being prepared. Try again.'),
  },
  {
    // The ante refuses a vote below min_voting_stake_ulmn. The dialog checks it
    // first, so this fires when the threshold or the delegation moved under it.
    match: 'counts a vote from',
    message: () =>
      t('This network counts a vote only from an account with enough delegated stake. Delegate more and vote again.'),
  },
  {
    match: 'holds no delegation, so the vote would carry no weight',
    message: () =>
      t('A vote carries the weight of what you have delegated, so an account with none cannot vote. Delegate to any validator first.'),
  },
  {
    // v2.0.0 refuses a transaction that claims the same reward twice. The
    // wallet deduplicates before signing, so this is a backstop.
    match: 'in the same transaction for',
    message: () =>
      t('That transaction claimed the same reward twice. Try again.'),
  },
  {
    // MsgBid outside the auction window. The list only offers Bid while the
    // window is open, so this means the window closed between the two.
    match: 'auction not open',
    message: () =>
      t('This auction is not open. It may have closed while the page was open - reload the list.'),
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
