export interface Gateway {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'inactive' | 'error';
  owner: string;
}

/** The fields of the add/edit external gateway form. */
export type ExternalGatewayForm = {
  name: string;
  url: string;
  apiKey: string;
};

/** The fields of the whitelist entry form. The address is fixed while editing. */
export type WhitelistEntryForm = {
  address: string;
  displayName: string;
  notes: string;
};
