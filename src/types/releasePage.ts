export type ReleaseParams = {
  allowedPublishers: string[];
  channels: string[];
  maxArtifacts: number;
  maxUrlsPerArt: number;
  maxSigsPerArt: number;
  maxNotesLen: number;
  maxPendingTtl: string;
  publishFeeUlmn: string;
};

export type ArtifactRecord = {
  platform: string;
  kind: string;
  sha256Hex: string;
  size: number;
  cid?: string;
  urls: string[];
};

export type ReleaseRecord = {
  id: number;
  version: string;
  channel: string;
  notes: string;
  publisher: string;
  createdAt: number;
  yanked: boolean;
  status: string;
  artifacts: ArtifactRecord[];
  supersedes: number[];
  emergencyOk: boolean;
};

export type ArtifactDraft = {
  id: string;
  platform: string;
  kind: string;
  cid: string;
  sha256Hex: string;
  size: string;
  urlsText: string;
};

export type DaoKind = 'validate' | 'reject';

export type ReleaseDraft = {
  version: string;
  channel: string;
  notes: string;
  supersedes: string;
  emergencyOk: boolean;
  artifacts: ArtifactDraft[];
};

/** The fields of the "send to DAO" form. `reason` only applies to a rejection. */
export type DaoProposalForm = {
  kind: DaoKind;
  title: string;
  summary: string;
  depositLmn: string;
  reason: string;
};
