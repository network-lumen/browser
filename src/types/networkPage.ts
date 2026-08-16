export interface Block {
  height: number;
  time: string;
  txs: number;
  validator: string;
  validatorAvatar?: string;
}

/**
 * A block proposer as the explorer displays it: the validator moniker, plus
 * the avatar looked up on Keybase.
 *
 * NetworkPage and BlockDetailPage both keep a map of these and had each
 * written the shape inline - twice in one of them.
 */
export type ProposerInfo = {
  moniker: string;
  avatar?: string;
  keybaseId?: string;
};

export type ProposalForm = {
  title: string;
  summary: string;
  depositLmn: string;
};

/** The four things one can do with a stake against a validator. */
export type StakeAction = 'Delegate' | 'Undelegate' | 'Redelegate' | 'Withdraw';
