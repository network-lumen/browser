export type DomainRow = {
  name: string;
  expireAtSeconds: number | null;
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
