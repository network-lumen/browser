import type { DomainLifecycleStatus } from './domainAuctions';

export type DomainRow = {
  name: string;
  expireAtSeconds: number | null;
  /**
   * When the chain last accepted an update for this domain. The dns module
   * refuses another one before `update_rate_limit_seconds` have passed, so this
   * is what says whether saving is possible yet.
   */
  updatedAtSeconds: number | null;
  /**
   * Where the chain puts this name in its life, computed in the main process
   * from `expire_at` and the two governable params. Null when the params could
   * not be read - the row is still listed, it just carries no status.
   */
  status: DomainLifecycleStatus | null;
  /**
   * When this name would open to public auction, in seconds. What the owner
   * actually has to act before, and further out than the expiry itself.
   */
  auctionStartSeconds: number | null;
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
