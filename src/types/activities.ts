export type ActivityType =
  | 'send'
  | 'receive'
  | 'register_domain'
  | 'update_domain'
  | 'renew_domain'
  | 'bid'
  | 'settle'
  | 'stake'
  | 'unstake'
  | 'reward'
  | 'unknown';

export interface Activity {
  id: string;
  txhash: string;
  type: ActivityType;
  action?: string;
  dnsName?: string;
  timestamp: string;
  height?: number;
  code?: number;
  amounts?: { denom: string; amount: string }[];
  from?: string;
  to?: string;
  memo?: string;
  sender?: string;
  recipient?: string;
}
