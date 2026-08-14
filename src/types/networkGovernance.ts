export type GovernanceTally = {
  yes: string;
  no: string;
  noWithVeto: string;
  abstain: string;
};

export type GovernanceProposal = {
  id: number;
  status: string;
  title: string;
  summary: string;
  submitTime: string;
  votingStart: string;
  votingEnd: string;
  depositEnd: string;
  totalDeposit: string;
  proposer: string;
  /**
   * Why execution failed after the vote passed, straight from the chain. Empty
   * for every other status - a proposal can be adopted and still fail, and this
   * is the only place that says why.
   */
  failedReason: string;
  /**
   * The on-chain changes the proposal executes if it passes, as the chain
   * returns them. Kept raw: these are module params messages whose shape
   * differs per module, and rendering them is the reader's job, not a mapper's.
   */
  messages: GovernanceProposalMessage[];
  tally: GovernanceTally;
};

export type GovernanceProposalMessage = {
  /** e.g. "/lumen.dns.v1.MsgUpdateParams". */
  type: string;
  value: unknown;
};

export type GovernanceVoteOption = 'VOTE_OPTION_YES' | 'VOTE_OPTION_NO' | 'VOTE_OPTION_NO_WITH_VETO' | 'VOTE_OPTION_ABSTAIN';

export type GovernanceActionFieldType = 'text' | 'number' | 'textarea' | 'select';

export type GovernanceActionFieldOption = {
  value: string;
  label: string;
};

/**
 * How a field's current value is read out of the module's params.
 *
 * `key` is the params field in snake_case, as REST sends it. `unit` says what
 * has to happen to it on the way into the form, and it is not cosmetic: a field
 * labelled LMN whose param is in ulmn would prefill a figure a million times
 * too large, and the builder would then multiply it again.
 */
export type GovernanceActionFieldSource = {
  key: string;
  unit?:
    | 'raw'
    /** ulmn on the chain, LMN in the form. */
    | 'lmn'
    /** repeated string -> one per line. */
    | 'lines'
    /** repeated LengthTier -> "maxLen:multiplierBps" pairs. */
    | 'tiers'
    /** bool -> the 'true'/'false' the select carries. */
    | 'bool';
};

export type GovernanceActionField = {
  key: string;
  label: string;
  type: GovernanceActionFieldType;
  placeholder?: string;
  hint?: string;
  options?: GovernanceActionFieldOption[];
  /** Absent for a field with no on-chain counterpart, e.g. an upgrade height. */
  source?: GovernanceActionFieldSource;
};

export type GovernanceActionTemplate = {
  id: string;
  module: string;
  label: string;
  summary: string;
  /**
   * REST path to the module's current params, for prefilling the form. Only the
   * templates that send a MsgUpdateParams have one - an action that performs a
   * deed rather than setting state has nothing to read back.
   */
  paramsPath?: string;
  fields: GovernanceActionField[];
};

export type GovernanceActionDraft = {
  id: string;
  templateId: string;
  values: Record<string, string>;
};

/**
 * A draft stripped of its reactivity and its local id, as it crosses IPC.
 * Structured clone rejects a Vue Proxy, so this is deliberately plain.
 */
export type GovernanceActionPayload = {
  templateId: string;
  values: Record<string, string>;
};
