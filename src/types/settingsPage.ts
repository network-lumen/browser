export type BootstrapPathState = {
  bootstrapConfigPath: string;
  defaultUserDataPath: string;
  customUserDataPath: string;
  usingCustomUserDataPath: boolean;
  effectiveUserDataPath: string;
  activeUserDataPath: string;
  activeLogsPath: string;
  restartRequired: boolean;
};
