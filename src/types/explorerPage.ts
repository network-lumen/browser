export interface Block {
  height: number;
  hash: string;
  proposer: string;
  proposerAvatar?: string;
  txCount: number;
  time: string;
}

export interface Transaction {
  hash: string;
  type: string;
  height: number;
  success: boolean;
  time: string;
  fee?: string;
}

export interface Validator {
  address: string;
  moniker: string;
  tokens: string;
  commission: string;
  jailed: boolean;
  avatar?: string;
  keybaseId?: string;
  consensusPubkeyB64?: string;
}

export type TxHistoryWindow = 5 | 10 | 15 | 20;
