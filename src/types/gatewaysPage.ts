export type GatewayParamsView = {
  registerFeeUlmn: string;
  actionFeeUlmn: string;
};

export type GatewayRecord = {
  id: string;
  endpoint: string;
  operator: string;
  payout?: string;
  regions?: string[];
  active: boolean;
  metadata?: Record<string, any>;
};

export type GatewayEditState = {
  endpoint: string;
  regions: string;
  payout: string;
  metadata: string;
  active: boolean;
  memo: string;
  error: string;
  txhash: string;
  busy: boolean;
  original: {
    endpoint: string;
    regions: string[];
    payout: string;
    extras: Record<string, any>;
    active: boolean;
  };
};

/** The fields of the "create gateway" form. */
export type GatewayRegisterForm = {
  endpoint: string;
  regions: string;
  payout: string;
  metadata: string;
  memo: string;
};
