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
  tally: GovernanceTally;
};

export type GovernanceVoteOption = 'VOTE_OPTION_YES' | 'VOTE_OPTION_NO' | 'VOTE_OPTION_NO_WITH_VETO' | 'VOTE_OPTION_ABSTAIN';

export type GovernanceActionFieldType = 'text' | 'number' | 'textarea' | 'select';

export type GovernanceActionFieldOption = {
  value: string;
  label: string;
};

export type GovernanceActionField = {
  key: string;
  label: string;
  type: GovernanceActionFieldType;
  placeholder?: string;
  hint?: string;
  options?: GovernanceActionFieldOption[];
};

export type GovernanceActionTemplate = {
  id: string;
  module: string;
  label: string;
  summary: string;
  fields: GovernanceActionField[];
};

export type GovernanceActionDraft = {
  id: string;
  templateId: string;
  values: Record<string, string>;
};
