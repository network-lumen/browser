import { useInternalLumen } from '../../composables/useInternalLumen';

/**
 * Startup smoke check of the preload bridge.
 *
 * If `window.lumen` is missing or incomplete, every feature in the app breaks
 * at once, usually with an unhelpful error deep inside whatever page the user
 * happened to open. This runs once from App.vue's onMounted and fails loudly
 * with a support link instead.
 *
 * The lists below mirror `electron/preload.cjs` exactly.
 * `tests/unit/fatal-errors-coverage.test.ts` re-derives them from that file and
 * fails if the two drift, so a preload method removed without updating this
 * list breaks CI rather than the user's startup.
 */

/** Top-level `window.lumen.<name>()` functions. */
const REQUIRED_FUNCTIONS: string[] = [
  'appIsRoot', 'clipboardWriteText', 'tabsOnOpenInNewTab', 'tabsReportState', 'settingsGetAll',
  'settingsSet', 'settingsOnChanged', 'bootstrapPathGetState',
  'bootstrapPathSetCustomUserDataPath', 'bootstrapPathResetCustomUserDataPath',
  'settingsLoadGateways', 'settingsAddGateway', 'settingsUpdateGateway',
  'settingsDeleteGateway', 'settingsLoadPrivateCloudConfig', 'settingsSavePrivateCloudConfig',
  'gatewayServerStart', 'gatewayServerStop', 'gatewayServerStatus', 'gatewayServerGetApiKey',
  'gatewayServerSaveMetadata', 'gatewayServerGetAllMetadata',
  'dialogOpenFiles', 'dialogOpenFolder', 'ipfsStatus', 'ipfsAdd',
  'ipfsPropagateCidToPublicGateways', 'ipfsAddPath', 'ipfsAddPathWithProgress',
  'ipfsAddDirectory', 'ipfsAddDirectoryFromPath', 'ipfsAddDirectoryFromPathWithProgress',
  'ipfsCancelAdd', 'ipfsCancelPublicGatewayPropagation', 'ipfsOnAddProgress',
  'ipfsOnPublicGatewayPropagationProgress', 'ipfsCidToBase32', 'ipfsGet', 'ipfsLs',
  'ipfsPinList', 'ipfsPinStart', 'ipfsPinPause', 'ipfsPinResume', 'ipfsPinCancel',
  'ipfsPinWait', 'ipfsPinGet', 'ipfsPinJobs', 'ipfsOnPinProgress', 'ipfsPinAdd', 'ipfsUnpin',
  'ipfsStats', 'ipfsPublishToIPNS', 'ipfsResolveIPNS', 'ipfsKeyList', 'ipfsKeyGen',
  'ipfsKeyRename', 'ipfsKeyImport', 'ipfsKeyExport', 'ipfsKeyRm', 'driveConvertToHls',
  'driveDownloadHlsArchive', 'driveCancelHlsConvert', 'driveCancelHlsArchiveDownload',
  'driveOnHlsProgress', 'driveOnHlsArchiveProgress', 'setWindowMode', 'openMainWindow',
  'httpGet', 'httpHead', 'httpGetBytes'
];

/** Top-level members that hold a computed value rather than a function. */
const REQUIRED_VALUES: string[] = [
  'appPlatform', 'appDialogLikelyBroken'
];

/** `window.lumen.<namespace>.<member>()` groups. */
const REQUIRED_NAMESPACES: Record<string, string[]> = {
  find: [
    'setOpen', 'setActiveTarget', 'findInPage', 'stopFindInPage', 'focusTarget', 'onAction',
    'onResult'
  ],
  devtools: [
    'openActive', 'registerSiteTarget', 'unregisterSiteTarget'
  ],
  site: [
    'registerDomainTarget', 'unregisterDomainTarget'
  ],
  siteData: [
    'list', 'delete'
  ],
  driveBackup: [
    'encryptSnapshot', 'decryptSnapshot'
  ],
  troubleshooting: [
    'copyDebugReport', 'openLogsFolder'
  ],
  http: [
    'get', 'getBytes'
  ],
  pqc: [
    'getParams', 'getAccount'
  ],
  profiles: [
    'getFavourites', 'setFavourite', 'removeFavourite', 'list', 'getActive',
    'isWalletFullyCreated', 'select', 'create', 'updateName', 'updateAvatar', 'clearAvatar',
    'export', 'checkExportRequiresPassword', 'exportBackup', 'exportBackups', 'import',
    'importBackup', 'pickManualProfileSource', 'pickManualPqcSource', 'importManual',
    'importEncryptedBackup', 'delete', 'onPqcLinked'
  ],
  rpc: [
    'getHeight', 'onHeightChanged'
  ],
  net: [
    'rpcGet', 'restGet', 'broadcastTx', 'getState', 'getValidators', 'refreshOnChain'
  ],
  release: [
    'getLatestInfo', 'getTestOptions', 'setTestOptions', 'pollNow', 'downloadAndInstall',
    'openExternal', 'publishRelease', 'submitToDao', 'onUpdateAvailable', 'onUpdateProgress'
  ],
  extensions: [
    'getGuestPreloadUrl', 'listExtensions', 'prepareTab', 'loadUnpacked', 'openExtension',
    'openStore', 'installFromChromeWebStore', 'enableExtension', 'disableExtension',
    'reloadExtension', 'removeExtension', 'getProviderFallbackState', 'onChanged'
  ],
  dns: [
    'getParams', 'getDomainInfo', 'listByOwnerDetailed', 'estimateRegisterPrice',
    'createDomain', 'updateDomain', 'transferDomain'
  ],
  wallet: [
    'getBalance', 'getTokenomicsParams', 'sendTokens', 'ibcTransfer', 'listSendTxs',
    'getDelegations', 'delegate', 'undelegate', 'redelegate', 'withdrawRewards',
    'govSubmitProposal', 'govVote'
  ],
  gateway: [
    'getWalletUsage', 'getWalletPinnedCids', 'getBaseUrl', 'checkAlive', 'getPlansOverview',
    'getParams', 'listGateways', 'searchPq', 'pingViewPq', 'pinCid', 'cancelPinCid',
    'onIngestProgress', 'unpinCid', 'renameCid', 'subscribePlan', 'registerGateway',
    'updateGateway'
  ],
  addressBook: [
    'list', 'add', 'update', 'delete'
  ],
  security: [
    'getStatus', 'setPassword', 'verifyPassword', 'removePassword', 'lockSession',
    'checkSession', 'extendSession', 'touchSession', 'onSessionChanged'
  ],
  lumenSite: [
    'onUiRequest', 'respondUiRequest'
  ],
  domainSite: [
    'sendToken', 'pin'
  ]
};

const FATAL_ERROR_MAP: Record<string, string | ((name: string) => string)> = {
  FATAL000001: 'Lumen API not found',
  FATAL000002: (name: string) => `Missing API namespace '${name}'`,
  FATAL000004: (name: string) => `Missing function '${name}'`
};

const missingNamespace = (name: string) =>
  (FATAL_ERROR_MAP.FATAL000002 as (n: string) => string)(name);
const missingMember = (name: string) =>
  (FATAL_ERROR_MAP.FATAL000004 as (n: string) => string)(name);

/**
 * Throws on the first missing entry. The bridge is read here rather than at
 * module load, so the check does not depend on import order.
 */
async function checkLumenAPIReferences(): Promise<void> {
  const lumen: any = useInternalLumen();
  if (!lumen) throw new Error('FATAL000001');

  for (const name of REQUIRED_VALUES) {
    if (!(name in lumen)) throw new Error(missingMember(name));
  }

  for (const name of REQUIRED_FUNCTIONS) {
    if (typeof lumen[name] !== 'function') throw new Error(missingMember(name));
  }

  for (const [namespace, members] of Object.entries(REQUIRED_NAMESPACES)) {
    const group = lumen[namespace];
    if (!group || typeof group !== 'object') throw new Error(missingNamespace(namespace));
    for (const member of members) {
      if (typeof group[member] !== 'function') {
        throw new Error(missingMember(`${namespace}.${member}`));
      }
    }
  }
}

export {
  checkLumenAPIReferences,
  FATAL_ERROR_MAP,
  REQUIRED_FUNCTIONS,
  REQUIRED_VALUES,
  REQUIRED_NAMESPACES
};
