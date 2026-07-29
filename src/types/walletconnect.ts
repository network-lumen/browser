export interface WalletConnectSession {
  topic: string;
  peerMetadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  namespaces: any;
  expiry: number;
}

export interface WalletConnectConfig {
  projectId: string;
  relayUrl?: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}
