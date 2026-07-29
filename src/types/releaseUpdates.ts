export type LatestPayload = {
  version: string;
  channel: string;
  platform: string;
  kind: string;
  release: any;
  blocked?: boolean;
  blockedReason?: string | null;
  blockedMessage?: string | null;
  artifact: {
    platform: string;
    kind: string;
    size?: number | null;
    sha256Hex?: string | null;
    urls?: string[];
    cid?: string | null;
  };
  downloadUrl: string | null;
};

export type SemverParts = { major: number; minor: number; patch: number; pre: string[] };
