import type { DriveFile } from "./upload";

export type HlsQueueItemStatus =
  | "queued"
  | "converting"
  | "paused"
  | "done"
  | "failed"
  | "cancelled";

export interface HlsQueueItem {
  id: string;
  file: DriveFile;
  status: HlsQueueItemStatus;
  error?: string;
}

export interface IpfsStats {
  repoSize: number;
  storageMax: number;
  numObjects: number;
}

export type HostingKind = "local" | "gateway";
export type HostingState = { kind: HostingKind; gatewayId: string };

// Gateway plans (DrivePanel-style "Plans" entry)
export type PlanView = {
  id: string;
  planId: string;
  gatewayId: string;
  gatewayName: string;
  gatewayEndpoint?: string;
  priceUlmn: number;
  storageGbPerMonth?: number;
  networkGbPerMonth?: number;
  monthsTotal: number;
  description?: string;
};

/** CID to the moment it was pinned, for pins the gateway has yet to confirm. */
export type OptimisticPins = Record<string, number>;

export type SubscriptionView = {
  id: string;
  gatewayId: string;
  status: string;
  /**
   * When the paid months run out, in ms. The chain leaves `status` at "active"
   * long after this - a contract only closes once the operator claims it - so
   * this is what says whether a plan still covers anything.
   */
  expiresAt?: number;
  metadata?: Record<string, any>;
};

export type GatewayView = {
  id: string;
  endpoint: string;
  operator: string;
  regions: string[];
  active: boolean;
  score?: number;
};

export type DriveBackupSnapshotV1 = {
  type: "lumen.driveBackup.snapshot";
  version: 1;
  createdAt: number;
  seq: number;
  walletAddress: string;
  drive: {
    files: DriveFile[];
    localNames: Record<string, string>;
  };
  favourites: string[];
};

export type DriveBackupSnapshotV2 = {
  type: "lumen.driveBackup.snapshot";
  version: 2;
  createdAt: number;
  seq: number;
  walletAddress: string;
  drive: {
    files: DriveFile[];
    localNames: Record<string, string>;
  };
  favourites: string[];
  shortcutEntries: {
    id?: string;
    url: string;
    title?: string;
    pinned?: boolean;
    createdAt?: number;
    updatedAt?: number;
  }[];
};

export type DriveBackupSnapshot = DriveBackupSnapshotV1 | DriveBackupSnapshotV2;

export type DriveBackupShortcutEntry = DriveBackupSnapshotV2["shortcutEntries"][number];

/**
 * `shortcutEntries` is null for a version 1 snapshot, which predates them:
 * null means the backup has nothing to say about shortcuts, where an empty
 * list would mean it says there are none.
 */
export type DriveBackupReadResult =
  | { ok: false; error: string }
  | {
      ok: true;
      files: DriveFile[];
      localNames: Record<string, string>;
      favourites: string[];
      shortcutEntries: DriveBackupShortcutEntry[] | null;
      seq?: number;
    };

export type DriveBackupSnapshotSummary = {
  source: string;
  createdAt: number;
  seq: number;
  walletAddress: string;
  filesCount: number;
  favCount: number;
  localSeq: number;
  /** The snapshot is older than what has already been applied here. */
  rollback: boolean;
  /** The snapshot was made under a different wallet. */
  walletMismatch: boolean;
};

/** A gateway with the plans it offers, as grouped for the plans dialog. */
export type PlanGroup = { gateway: GatewayView; plans: PlanView[] };

/** What a decrypted Drive snapshot turned out to contain. */
export type DriveBackupRestoreDetails = {
  filesCount: number;
  favCount: number;
  walletAddress?: string;
  /** True when the snapshot belongs to a different wallet than the active one. */
  walletMismatch?: boolean;
  rollback?: unknown;
  createdAt?: number;
  localSeq?: number;
};

/** One per-site data record, as listed in the "Sites data" dialog. */
export type SiteDataRecord = {
  siteKey?: string;
  profileId?: string;
  datas?: unknown;
  updatedAt?: number;
};
