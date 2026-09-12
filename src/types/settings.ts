export type SecuritySessionTimeoutMs = number | null;

export type IpfsConnectivityMode = "light" | "normal" | "high";

export type AppSettings = {
  localGatewayBase: string;
  /** Which Lumen to talk to. See src/types/lumenNetwork.ts. */
  lumenNetwork: string;
  ipfsApiBase: string;
  ipfsConnectivityMode: IpfsConnectivityMode;
  localDriveMaxUploadSizeGb: number;
  showSexualContent: boolean;
  showViolentContent: boolean;
  showDisturbingImagery: boolean;
  securitySessionTimeoutMs: SecuritySessionTimeoutMs;
};
