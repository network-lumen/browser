export type DomainRow = {
  name: string;
  expireAtSeconds: number | null;
  /**
   * When the chain last accepted an update for this domain. The dns module
   * refuses another one before `update_rate_limit_seconds` have passed, so this
   * is what says whether saving is possible yet.
   */
  updatedAtSeconds: number | null;
};

export type RawDomainRow = {
  name: string;
  id: string;
};

export type SettingsRecord = { key: string; value: string };

export type DomainRegisterForm = {
  domainName: string;
  years: string;
  ext: string;
};
