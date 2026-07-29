export type Profile = {
  id: string;
  name: string;
  colorIndex: number;
  role?: 'guest' | 'user';
  avatarDataUrl?: string;
  walletAddress?: string;
  address?: string;
  favourites?: Record<string, string>;
};

type ManualProfileSourceResult = {
  ok: boolean;
  name?: string;
  mnemonic?: string;
  pqcPublicKey?: string;
  pqcPrivateKey?: string;
  fileName?: string;
  sourcePath?: string;
  hasPqc?: boolean;
  error?: string;
};

type ManualPqcSourceResult = {
  ok: boolean;
  pqcPublicKey?: string;
  pqcPrivateKey?: string;
  fileName?: string;
  sourcePath?: string;
  scheme?: string;
  createdAt?: string;
  error?: string;
};

declare global {
  interface Window {
    lumen?: {
      profiles?: {
        list: () => Promise<{ profiles: Profile[]; activeId: string }>;
        getActive: () => Promise<Profile | null>;
        isWalletFullyCreated?: (id: string) => Promise<{ ok: boolean; error?: string; details?: any; message?: string }>;
        select: (id: string) => Promise<string>;
        create: (name: string) => Promise<Profile | null>;
        updateName?: (id: string, name: string) => Promise<{ ok: boolean; profile?: Profile; error?: string }>;
        updateAvatar?: (id: string, sourcePath: string) => Promise<{ ok: boolean; profile?: Profile; error?: string }>;
        clearAvatar?: (id: string) => Promise<{ ok: boolean; profile?: Profile; error?: string }>;
        export: (id: string) => Promise<string | null>;
        checkExportRequiresPassword?: (id: string) => Promise<{ ok: boolean; requiresPassword?: boolean; error?: string }>;
        exportBackup?: (
          id: string,
          password?: string,
          encryptOutput?: boolean
        ) => Promise<{ ok: boolean; path?: string; error?: string } | null>;
        exportBackups?: (
          ids: string[],
          password?: string,
          encryptOutput?: boolean
        ) => Promise<
          | {
              ok: boolean;
              baseDir?: string;
              results?: { id: string; ok: boolean; path?: string; error?: string }[];
              error?: string;
            }
          | null
        >;
        import: (json: string) => Promise<Profile | null>;
        importBackup?: () => Promise<
          | {
              ok: boolean;
              selectedId?: string;
              imported?: number;
              results?: { ok: boolean; path: string; id?: string; error?: string }[];
              error?: string;
              encryptedFiles?: string[];
            }
          | null
        >;
        pickManualProfileSource?: () => Promise<ManualProfileSourceResult | null>;
        pickManualPqcSource?: () => Promise<ManualPqcSourceResult | null>;
        importManual?: (payload: {
          name: string;
          mnemonic: string;
          pqcPublicKey?: string;
          pqcPrivateKey?: string;
        }) => Promise<
          | {
              ok: boolean;
              id?: string;
              walletAddress?: string;
              error?: string;
            }
          | null
        >;
        delete: (id: string) => Promise<
          | { profiles: Profile[]; activeId: string }
          | { ok: false; error?: string }
        >;
        getFavourites?: () => Promise<Record<string, string>>;
        setFavourite?: (domain: string, cid: string) => Promise<any>;
        removeFavourite?: (domain: string) => Promise<any>;
      };
      staking?: {
        getDelegations: (profileId: string) => Promise<any>;
        getValidators: (profileId: string) => Promise<any>;
        getBalance: (profileId: string) => Promise<any>;
        delegate: (profileId: string, validatorAddress: string, amount: string) => Promise<any>;
        undelegate: (profileId: string, validatorAddress: string, amount: string) => Promise<any>;
        claimRewards: (profileId: string, validatorAddress: string) => Promise<any>;
        claimAllRewards: (profileId: string) => Promise<any>;
        redelegate: (profileId: string, fromValidator: string, toValidator: string, amount: string) => Promise<any>;
      };
    };
  }
}
