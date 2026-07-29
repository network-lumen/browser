export interface Proposal {
  id: string;
  title: string;
  description: string;
  status: string;
  submitTime: string;
  depositEndTime: string;
  votingStartTime: string;
  votingEndTime: string;
  totalDeposit: string;
  yesVotes: string;
  noVotes: string;
  abstainVotes: string;
  noWithVetoVotes: string;
  proposer: string;
}

export interface Member {
  address: string;
  moniker: string;
  tokens: string;
  avatar?: string;
  keybaseId?: string;
}

export interface TreasuryAsset {
  denom: string;
  amount: string;
  displayName: string;
}
