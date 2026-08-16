/**
 * What the main process answers when the app broadcasts a transaction, and the
 * reading `classifyBroadcastResult` makes of it.
 *
 * `txhash` and `txHash` are both here because both spellings come back: the
 * staking handlers return one and the wallet handlers the other, and nothing
 * has ever reconciled them.
 */
export type BroadcastResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Set when the main process could tell whether the transaction reached a block. */
  retrySafe?: boolean;
  txhash?: string;
  txHash?: string;
} | null | undefined;

export type BroadcastOutcome =
  /** The wallet needs unlocking before anything can be signed. */
  | { kind: 'locked' }
  /** Broadcast, almost certainly landed, unconfirmable. */
  | { kind: 'unconfirmed'; retrySafe: boolean; txhash: string }
  | { kind: 'sent'; txhash: string }
  | { kind: 'failed'; error: string };
