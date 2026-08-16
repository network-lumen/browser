export type SecuritySessionTimeoutMs = number | null;

export type IpfsConnectivityMode = "light" | "normal" | "high";

export type AppSettings = {
  localGatewayBase: string;
  ipfsApiBase: string;
  ipfsConnectivityMode: IpfsConnectivityMode;
  localDriveMaxUploadSizeGb: number;
  showSexualContent: boolean;
  showViolentContent: boolean;
  showDisturbingImagery: boolean;
  securitySessionTimeoutMs: SecuritySessionTimeoutMs;
};
