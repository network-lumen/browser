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

/**
 * One release as the chain lists it at `/lumen/release/releases`.
 *
 * Loose on purpose: the list is someone else's data and the fields that matter
 * are read defensively in `releaseSelection.ts`.
 */
export interface ReleaseEntry {
  id?: number | string;
  version?: string;
  channel?: string;
  yanked?: boolean;
  status?: unknown;
  artifacts?: Record<string, unknown>[];
  [key: string]: unknown;
}

/** An artifact, with both spellings of every field already folded away. */
export interface ReleaseArtifact {
  platform: string;
  kind: string;
  size: number | null;
  sha256Hex: string | null;
  urls: string[];
  cid: string | null;
}

/** A release and the artifact chosen for this platform. */
export interface ReleaseCandidate {
  release: ReleaseEntry;
  artifact: ReleaseArtifact;
}
