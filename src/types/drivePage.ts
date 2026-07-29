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

export type SubscriptionView = {
  id: string;
  gatewayId: string;
  status: string;
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
