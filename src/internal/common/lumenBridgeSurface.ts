/**
 * The exact shape of the `window.lumen` bridge exposed by
 * `electron/preloads/preload.cjs`, as data.
 *
 * It has two consumers, and living in its own leaf module (importing nothing)
 * is what lets both use it without a cycle:
 *  - `fatal_errors.ts` checks the real bridge against it at startup;
 *  - `src/types/lumenBridge.ts` derives the TYPE of the bridge from it, so
 *    `useInternalLumen()` returns something with named members instead of
 *    `any`.
 *
 * `tests/unit/fatal-errors-coverage.test.ts` re-derives all of this from
 * `preload.cjs` and fails on any drift - so the type cannot quietly stop
 * describing the bridge it claims to describe.
 */
/** Top-level `window.lumen.<name>()` functions. */
export const REQUIRED_FUNCTIONS = [
  'appIsRoot', 'appReportRendererError', 'clipboardWriteText', 'tabsOnOpenInNewTab',
  'tabsReportState', 'settingsGetAll',
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
] as const;

/** Top-level members that hold a computed value rather than a function. */
export const REQUIRED_VALUES = [
  'appPlatform', 'appDialogLikelyBroken', 'appSystemLanguages'
] as const;

/** `window.lumen.<namespace>.<member>()` groups. */
export const REQUIRED_NAMESPACES = {
  find: [
    'setOpen', 'setActiveTarget', 'findInPage', 'stopFindInPage', 'focusTarget', 'onAction',
    'onResult'
  ],
  devtools: [
    'openActive', 'registerSiteTarget', 'unregisterSiteTarget'
  ],
  site: [
    'registerDomainTarget', 'unregisterDomainTarget', 'registerHost', 'hostStatus'
  ],
  siteData: [
    'list', 'delete'
  ],
  sitePermissions: [
    'list', 'setAction', 'revokeSite'
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
    'getParams', 'getAccount', 'hasLocalKey'
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
    'rpcGet', 'restGet', 'broadcastTx', 'getState', 'getNetwork', 'setNetwork',
    'getExplorerAccountUrl', 'getValidators', 'refreshOnChain', 'onNetworkChanged'
  ],
  release: [
    'getLatestInfo', 'pollNow', 'downloadAndInstall',
    'openExternal', 'publishRelease', 'submitToDao', 'onUpdateAvailable', 'onUpdateProgress'
  ],
  extensions: [
    'getGuestPreloadUrl', 'listExtensions', 'prepareTab', 'loadUnpacked', 'openExtension',
    'openStore', 'installFromChromeWebStore', 'enableExtension', 'disableExtension',
    'reloadExtension', 'removeExtension', 'getProviderFallbackState', 'onChanged'
  ],
  dns: [
    'getParams', 'getDomainInfo', 'listByOwnerDetailed', 'estimateRegisterPrice',
    'listAuctions', 'createDomain', 'updateDomain', 'transferDomain',
    'renewDomain', 'bidDomain', 'settleDomain'
  ],
  wallet: [
    'getBalance', 'getTokenomicsParams', 'sendTokens', 'ibcTransfer', 'listSendTxs',
    'getDelegations', 'getUnbondingDelegations', 'getRedelegations', 'getStakingRewards',
    'delegate', 'undelegate', 'redelegate', 'withdrawRewards', 'withdrawAllRewards', 'cosmosStake',
    'govSubmitProposal', 'govVote'
  ],
  gateway: [
    'getWalletUsage', 'getWalletPinnedCids', 'getBaseUrl', 'checkAlive', 'getPlansOverview',
    'getParams', 'listGateways', 'searchPq', 'pingViewPq', 'pinCid', 'cancelPinCid',
    'onIngestProgress', 'unpinCid', 'renameCid', 'subscribePlan', 'cancelContract',
    'registerGateway', 'updateGateway'
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
} as const;
