const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumen', {
  appPlatform: process.platform,
  appIsRoot: () => {
    try {
      return typeof process.getuid === 'function' && process.getuid() === 0;
    } catch {
      return false;
    }
  },
  appDialogLikelyBroken: (() => {
    try {
      if (process.platform !== 'linux') return false;
      const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
      const hasSessionBus = !!String(process.env.DBUS_SESSION_BUS_ADDRESS || '').trim();
      const hasRuntimeDir = !!String(process.env.XDG_RUNTIME_DIR || '').trim();
      return isRoot || !hasSessionBus || !hasRuntimeDir;
    } catch {
      return false;
    }
  })(),
  clipboardWriteText: (text) => ipcRenderer.invoke('clipboard:writeText', String(text ?? '')),
  tabsOnOpenInNewTab: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => {
      try {
        const url = typeof payload === 'string' ? payload : payload && payload.url ? payload.url : '';
        callback(String(url || ''));
      } catch {
        // ignore callback errors
      }
    };
    ipcRenderer.on('tabs:openInNewTab', handler);
    return () => {
      ipcRenderer.removeListener('tabs:openInNewTab', handler);
    };
  },
  tabsReportState: (tabIds) => {
    const ids = Array.isArray(tabIds) ? tabIds.map((x) => String(x || '')).filter(Boolean) : [];
    ipcRenderer.send('tabs:state', ids);
    return true;
  },
  find: {
    setOpen: (open) => {
      ipcRenderer.send('find:setOpen', !!open);
      return true;
    },
    setActiveTarget: (targetWebContentsId) => {
      ipcRenderer.send('find:setActiveTarget', targetWebContentsId ?? null);
      return true;
    },
    findInPage: (payload) => ipcRenderer.invoke('find:findInPage', payload || {}),
    stopFindInPage: (payload) => ipcRenderer.invoke('find:stopFindInPage', payload || {}),
    focusTarget: (targetWebContentsId) => ipcRenderer.invoke('find:focusTarget', targetWebContentsId),
    onAction: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('find:action', handler);
      return () => {
        ipcRenderer.removeListener('find:action', handler);
      };
    },
    onResult: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('find:result', handler);
      return () => {
        ipcRenderer.removeListener('find:result', handler);
      };
    }
  },
  devtools: {
    openActive: () => ipcRenderer.invoke('devtools:openActive'),
    /** Marks a <webview>'s webContents as a personal-site page: F12 will toggle its devtools even in packaged builds. */
    registerSiteTarget: (targetWebContentsId) => ipcRenderer.send('devtools:registerSiteTarget', targetWebContentsId),
    unregisterSiteTarget: (targetWebContentsId) => ipcRenderer.send('devtools:unregisterSiteTarget', targetWebContentsId)
  },
  site: {
    /** Tags a domain <webview>'s webContents with the host it's showing, so permission
     *  prompts triggered from inside it (Pin/Send/etc.) report the domain instead of the
     *  resolved ipfs:/ipns: gateway URL the webview actually navigated to. */
    registerDomainTarget: (targetWebContentsId, host) => ipcRenderer.send('site:registerDomainTarget', targetWebContentsId, host),
    unregisterDomainTarget: (targetWebContentsId) => ipcRenderer.send('site:unregisterDomainTarget', targetWebContentsId)
  },
  settingsGetAll: () => ipcRenderer.invoke('settings:getAll'),
  settingsSet: (partial) => ipcRenderer.invoke('settings:set', partial || {}),
  settingsOnChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore callback errors
      }
    };
    ipcRenderer.on('settings:changed', handler);
    return () => {
      ipcRenderer.removeListener('settings:changed', handler);
    };
  },
  bootstrapPathGetState: () => ipcRenderer.invoke('bootstrapPath:getState'),
  bootstrapPathSetCustomUserDataPath: (nextPath) =>
    ipcRenderer.invoke('bootstrapPath:setCustomUserDataPath', nextPath),
  bootstrapPathResetCustomUserDataPath: () =>
    ipcRenderer.invoke('bootstrapPath:resetCustomUserDataPath'),
  // Gateway management
  settingsLoadGateways: () => ipcRenderer.invoke('settings:loadGateways'),
  settingsSaveGateways: (gateways) => ipcRenderer.invoke('settings:saveGateways', gateways),
  settingsAddGateway: (gateway) => ipcRenderer.invoke('settings:addGateway', gateway),
  settingsUpdateGateway: (id, updates) => ipcRenderer.invoke('settings:updateGateway', id, updates),
  settingsDeleteGateway: (id) => ipcRenderer.invoke('settings:deleteGateway', id),
  // Private cloud config
  settingsLoadPrivateCloudConfig: () => ipcRenderer.invoke('settings:loadPrivateCloudConfig'),
  settingsSavePrivateCloudConfig: (config) => ipcRenderer.invoke('settings:savePrivateCloudConfig', config),
  // Embedded Gateway Server
  gatewayServerStart: (options) => ipcRenderer.invoke('gatewayServer:start', options),
  gatewayServerStop: () => ipcRenderer.invoke('gatewayServer:stop'),
  gatewayServerStatus: () => ipcRenderer.invoke('gatewayServer:status'),
  gatewayServerGetApiKey: () => ipcRenderer.invoke('gatewayServer:getApiKey'),
  // Gateway metadata
  gatewayServerSaveMetadata: (address, metadata) => ipcRenderer.invoke('gatewayServer:saveMetadata', address, metadata),
  gatewayServerGetMetadata: (address) => ipcRenderer.invoke('gatewayServer:getMetadata', address),
  gatewayServerGetAllMetadata: () => ipcRenderer.invoke('gatewayServer:getAllMetadata'),
  gatewayServerDeleteMetadata: (address) => ipcRenderer.invoke('gatewayServer:deleteMetadata', address),
  dialogOpenFiles: (options) => ipcRenderer.invoke('dialog:openFiles', options || {}),
  dialogOpenFolder: (options) => ipcRenderer.invoke('dialog:openFolder', options || {}),
  ipfsStatus: () => ipcRenderer.invoke('ipfs:status'),
  ipfsAdd: (data, filename) => ipcRenderer.invoke('ipfs:add', data, filename),
  ipfsPropagateCidToPublicGateways: (payload) =>
    ipcRenderer.invoke('ipfs:propagateCidToPublicGateways', payload || {}),
  ipfsAddWithProgress: (data, filename) =>
    ipcRenderer.invoke('ipfs:addWithProgress', data, filename),
  ipfsAddPath: (filePath, filename) =>
    ipcRenderer.invoke('ipfs:addPath', filePath, filename),
  ipfsAddPathWithProgress: (filePath, filename) =>
    ipcRenderer.invoke('ipfs:addPathWithProgress', filePath, filename),
  ipfsAddDirectory: (payload) => ipcRenderer.invoke('ipfs:addDirectory', payload || {}),
  ipfsAddDirectoryWithProgress: (payload) =>
    ipcRenderer.invoke('ipfs:addDirectoryWithProgress', payload || {}),
  ipfsAddDirectoryPaths: (payload) =>
    ipcRenderer.invoke('ipfs:addDirectoryPaths', payload || {}),
  ipfsAddDirectoryPathsWithProgress: (payload) =>
    ipcRenderer.invoke('ipfs:addDirectoryPathsWithProgress', payload || {}),
  ipfsAddDirectoryFromPath: (payload) =>
    ipcRenderer.invoke('ipfs:addDirectoryFromPath', payload || {}),
  ipfsAddDirectoryFromPathWithProgress: (payload) =>
    ipcRenderer.invoke('ipfs:addDirectoryFromPathWithProgress', payload || {}),
  ipfsCancelAdd: (payload) => ipcRenderer.invoke('ipfs:cancelAdd', payload || {}),
  ipfsCancelPublicGatewayPropagation: () =>
    ipcRenderer.invoke('ipfs:cancelPublicGatewayPropagation'),
  ipfsOnAddProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore callback errors
      }
    };
    ipcRenderer.on('ipfs:addProgress', handler);
    return () => {
      ipcRenderer.removeListener('ipfs:addProgress', handler);
    };
  },
  ipfsOnPublicGatewayPropagationProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore callback errors
      }
    };
    ipcRenderer.on('ipfs:publicGatewayPropagationProgress', handler);
    return () => {
      ipcRenderer.removeListener('ipfs:publicGatewayPropagationProgress', handler);
    };
  },
  ipfsCidToBase32: (cid) => ipcRenderer.invoke('ipfs:cidToBase32', cid),
  ipfsGet: (cid, options) => ipcRenderer.invoke('ipfs:get', cid, options || {}),
  ipfsLs: (cidOrPath) => ipcRenderer.invoke('ipfs:ls', cidOrPath),
  ipfsPinList: () => ipcRenderer.invoke('ipfs:pinList'),
  ipfsPinStart: (payload) => ipcRenderer.invoke('ipfs:pinStart', payload || {}),
  ipfsPinPause: (jobId) => ipcRenderer.invoke('ipfs:pinPause', jobId),
  ipfsPinResume: (jobId) => ipcRenderer.invoke('ipfs:pinResume', jobId),
  ipfsPinCancel: (jobId) => ipcRenderer.invoke('ipfs:pinCancel', jobId),
  ipfsPinWait: (jobId, options) => ipcRenderer.invoke('ipfs:pinWait', jobId, options || {}),
  ipfsPinGet: (jobId) => ipcRenderer.invoke('ipfs:pinGet', jobId),
  ipfsPinJobs: () => ipcRenderer.invoke('ipfs:pinJobs'),
  ipfsOnPinProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore callback errors
      }
    };
    ipcRenderer.on('ipfs:pinProgress', handler);
    return () => {
      ipcRenderer.removeListener('ipfs:pinProgress', handler);
    };
  },
  ipfsPinAdd: (cidOrPath) => ipcRenderer.invoke('ipfs:pinAdd', cidOrPath),
  ipfsUnpin: (cid) => ipcRenderer.invoke('ipfs:unpin', cid),
  ipfsStats: () => ipcRenderer.invoke('ipfs:stats'),
  ipfsPublishToIPNS: (cid, key, options) => ipcRenderer.invoke('ipfs:publishToIPNS', cid, key, options || {}),
  ipfsResolveIPNS: (name) => ipcRenderer.invoke('ipfs:resolveIPNS', name),
  ipfsKeyList: () => ipcRenderer.invoke('ipfs:keyList'),
  ipfsKeyGen: (name) => ipcRenderer.invoke('ipfs:keyGen', name),
  ipfsKeyRename: (oldName, newName) => ipcRenderer.invoke('ipfs:keyRename', oldName, newName),
  ipfsKeyImport: (name) => ipcRenderer.invoke('ipfs:keyImport', name),
  ipfsKeyExport: (name) => ipcRenderer.invoke('ipfs:keyExport', name),
  ipfsKeyRm: (name) => ipcRenderer.invoke('ipfs:keyRm', name),
  ipfsSwarmPeers: () => ipcRenderer.invoke('ipfs:swarmPeers'),
  driveConvertToHls: (payload) => ipcRenderer.invoke('drive:convertToHls', payload || {}),
  driveDownloadHlsArchive: (payload) => ipcRenderer.invoke('drive:downloadHlsArchive', payload || {}),
  driveCancelHlsConvert: () => ipcRenderer.invoke('drive:cancelHlsConvert'),
  driveCancelHlsArchiveDownload: () => ipcRenderer.invoke('drive:cancelHlsArchiveDownload'),
  driveOnHlsProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore callback errors
      }
    };
    ipcRenderer.on('drive:hlsProgress', handler);
    return () => {
      ipcRenderer.removeListener('drive:hlsProgress', handler);
    };
  },
  driveOnHlsArchiveProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore callback errors
      }
    };
    ipcRenderer.on('drive:hlsArchiveProgress', handler);
    return () => {
      ipcRenderer.removeListener('drive:hlsArchiveProgress', handler);
    };
  },
  driveBackup: {
    encryptSnapshot: (profileId, snapshot, password) =>
      ipcRenderer.invoke('driveBackup:encryptSnapshot', { profileId, snapshot, password }),
    decryptSnapshot: (profileId, encrypted, password) =>
      ipcRenderer.invoke('driveBackup:decryptSnapshot', { profileId, encrypted, password })
  },
  troubleshooting: {
    copyDebugReport: () => ipcRenderer.invoke('troubleshooting:copyDebugReport'),
    openLogsFolder: () => ipcRenderer.invoke('troubleshooting:openLogsFolder')
  },
  setWindowMode: (mode) => ipcRenderer.send('window:mode', mode),
  openMainWindow: () => ipcRenderer.invoke('window:open-main'),
  httpGet: (url, options) => ipcRenderer.invoke('http:get', url, options || {}),
  httpHead: (url, options) => ipcRenderer.invoke('http:head', url, options || {}),
  httpGetBytes: (url, options) => ipcRenderer.invoke('http:getBytes', url, options || {}),
  http: {
    get: (url, options) => ipcRenderer.invoke('http:get', url, options || {}),
    getBytes: (url, options) => ipcRenderer.invoke('http:getBytes', url, options || {})
  },
  pqc: {
    getParams: () => ipcRenderer.invoke('pqc:getParams'),
    getAccount: (address) => ipcRenderer.invoke('pqc:getAccount', address)
  },
  profiles: {
    getFavourites: () => ipcRenderer.invoke('profiles:getFavourites'),
    setFavourite: (domain, cid) => ipcRenderer.invoke('profiles:setFavourite', domain, cid),
    removeFavourite: (domain) => ipcRenderer.invoke('profiles:removeFavourite', domain),
    list: () => ipcRenderer.invoke('profiles:list'),
    getActive: () => ipcRenderer.invoke('profiles:getActive'),
    isWalletFullyCreated: (id) => ipcRenderer.invoke('profiles:isWalletFullyCreated', id),
    select: (id) => ipcRenderer.invoke('profiles:setActive', id),
    create: (name) => ipcRenderer.invoke('profiles:create', name),
    updateName: (id, name) => ipcRenderer.invoke('profiles:updateName', id, name),
    updateAvatar: (id, sourcePath) => ipcRenderer.invoke('profiles:updateAvatar', id, sourcePath),
    clearAvatar: (id) => ipcRenderer.invoke('profiles:clearAvatar', id),
    export: (id) => ipcRenderer.invoke('profiles:export', id),
    checkExportRequiresPassword: (id) => ipcRenderer.invoke('profiles:checkExportRequiresPassword', id),
    exportBackup: (id, password, encryptOutput) => ipcRenderer.invoke('profiles:exportBackup', id, password, encryptOutput),
    exportBackups: (ids, password, encryptOutput) => ipcRenderer.invoke('profiles:exportBackups', ids, password, encryptOutput),
    import: (json) => ipcRenderer.invoke('profiles:import', json),
    importBackup: () => ipcRenderer.invoke('profiles:importBackup'),
    pickManualProfileSource: () => ipcRenderer.invoke('profiles:pickManualProfileSource'),
    pickManualPqcSource: () => ipcRenderer.invoke('profiles:pickManualPqcSource'),
    importManual: (payload) => ipcRenderer.invoke('profiles:importManual', payload || {}),
    importEncryptedBackup: (filePath, password) => ipcRenderer.invoke('profiles:importEncryptedBackup', filePath, password),
    delete: (id) => ipcRenderer.invoke('profiles:delete', id),
    onPqcLinked: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('profiles:pqcLinked', handler);
      return () => {
        ipcRenderer.removeListener('profiles:pqcLinked', handler);
      };
    }
  },
  rpc: {
    getHeight: () => ipcRenderer.invoke('rpc:getHeight'),
    onHeightChanged: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('rpc:heightChanged', handler);
      return () => {
        ipcRenderer.removeListener('rpc:heightChanged', handler);
      };
    }
  },
  net: {
    rpcGet: (path, options) => ipcRenderer.invoke('net:rpcGet', path, options || {}),
    restGet: (path, options) => ipcRenderer.invoke('net:restGet', path, options || {}),
    broadcastTx: (txBytes, options) => ipcRenderer.invoke('net:broadcastTx', txBytes, options || {}),
    getState: () => ipcRenderer.invoke('net:getState'),
    getValidators: () => ipcRenderer.invoke('net:getValidators'),
    refreshOnChain: () => ipcRenderer.invoke('net:refreshOnChain')
  },
  release: {
    getLatestInfo: () => ipcRenderer.invoke('release:getLatestInfo'),
    getTestOptions: () => ipcRenderer.invoke('release:getTestOptions'),
    setTestOptions: (opts) => ipcRenderer.invoke('release:setTestOptions', opts || {}),
    pollNow: () => ipcRenderer.invoke('release:pollNow'),
    downloadAndInstall: (payload) => ipcRenderer.invoke('release:downloadAndInstall', payload || {}),
    openExternal: (url) => ipcRenderer.invoke('release:openExternal', url),
    publishRelease: (payload) => ipcRenderer.invoke('release:publish', payload || {}),
    submitToDao: (payload) => ipcRenderer.invoke('release:submitToDao', payload || {}),
    onUpdateAvailable: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('release:updateAvailable', handler);
      return () => {
        ipcRenderer.removeListener('release:updateAvailable', handler);
      };
    },
    onUpdateProgress: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('release:updateProgress', handler);
      return () => {
        ipcRenderer.removeListener('release:updateProgress', handler);
      };
    }
  },
  extensions: {
    getGuestPreloadUrl: () => ipcRenderer.invoke('extensions:getGuestPreloadUrl'),
    listExtensions: () => ipcRenderer.invoke('extensions:list'),
    prepareTab: (id, targetUrl) => ipcRenderer.invoke('extensions:prepareTab', id, targetUrl),
    loadUnpacked: () => ipcRenderer.invoke('extensions:loadUnpacked'),
    openExtension: (id) => ipcRenderer.invoke('extensions:open', id),
    openStore: (url) => ipcRenderer.invoke('extensions:openStore', url),
    installFromChromeWebStore: (input) =>
      ipcRenderer.invoke('extensions:installFromChromeWebStore', input),
    enableExtension: (id) => ipcRenderer.invoke('extensions:enable', id),
    disableExtension: (id) => ipcRenderer.invoke('extensions:disable', id),
    reloadExtension: (id) => ipcRenderer.invoke('extensions:reload', id),
    removeExtension: (id) => ipcRenderer.invoke('extensions:remove', id),
    getProviderFallbackState: () => ipcRenderer.invoke('extensions:getProviderFallbackState'),
    onChanged: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('extensions:changed', handler);
      return () => {
        ipcRenderer.removeListener('extensions:changed', handler);
      };
    }
  },
  dns: {
    getParams: () => ipcRenderer.invoke('dns:getParams'),
    getDomainInfo: (name) => ipcRenderer.invoke('dns:getDomainInfo', name),
    listByOwnerDetailed: (owner) => ipcRenderer.invoke('dns:listByOwnerDetailed', owner),
    estimateRegisterPrice: (input) => ipcRenderer.invoke('dns:estimateRegisterPrice', input || {}),
    createDomain: (input) => ipcRenderer.invoke('dns:createDomain', input || {}),
    updateDomain: (input) => ipcRenderer.invoke('dns:updateDomain', input || {}),
    transferDomain: (input) => ipcRenderer.invoke('dns:transferDomain', input || {})
  },
  wallet: {
    getBalance: (address, opts) => ipcRenderer.invoke('wallet:getBalance', { address, ...(opts || {}) }),
    getTokenomicsParams: () => ipcRenderer.invoke('chain:getTokenomicsParams'),
    sendTokens: (payload) => ipcRenderer.invoke('wallet:sendTokens', payload),
    ibcTransfer: (payload) => ipcRenderer.invoke('wallet:ibcTransfer', payload),
    listSendTxs: (address, opts) => ipcRenderer.invoke('wallet:listSendTxs', { address, ...(opts || {}) }),
    getDelegations: (address) => ipcRenderer.invoke('wallet:getDelegations', { address }),
    delegate: (payload) => ipcRenderer.invoke('wallet:delegate', payload),
    undelegate: (payload) => ipcRenderer.invoke('wallet:undelegate', payload),
    redelegate: (payload) => ipcRenderer.invoke('wallet:redelegate', payload),
    withdrawRewards: (payload) => ipcRenderer.invoke('wallet:withdrawRewards', payload)
  },
  gateway: {
    getWalletUsage: (profileId, baseUrl) =>
      ipcRenderer.invoke('gateway:getWalletUsage', { profileId, baseUrl }),
    getWalletPinnedCids: (profileId, baseUrl, page) =>
      ipcRenderer.invoke('gateway:getWalletPinnedCids', { profileId, baseUrl, page }),
    getBaseUrl: (profileId, baseUrl) =>
      ipcRenderer.invoke('gateway:getBaseUrl', { profileId, baseUrl }),
    checkAlive: (payload) => ipcRenderer.invoke('gateway:checkAlive', payload || {}),
    getPlansOverview: (profileId, options) =>
      ipcRenderer.invoke('gateway:getPlansOverview', { profileId, ...(options || {}) }),
    getParams: () => ipcRenderer.invoke('gateway:getParams'),
    listGateways: (options) => ipcRenderer.invoke('gateway:listGateways', options || {}),
    searchPq: (payload) => ipcRenderer.invoke('gateway:searchPq', payload || {}),
    pingViewPq: (payload) => {
      try {
        ipcRenderer.send('gateway:pingViewPq', payload || {});
      } catch {
        // ignore
      }
    },
    pinCid: (payload) => ipcRenderer.invoke('gateway:pinCid', payload || {}),
    cancelPinCid: () => ipcRenderer.invoke('gateway:cancelPinCid'),
    onIngestProgress: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('gateway:ingestProgress', handler);
      return () => {
        ipcRenderer.removeListener('gateway:ingestProgress', handler);
      };
    },
    unpinCid: (payload) => ipcRenderer.invoke('gateway:unpinCid', payload || {}),
    renameCid: (payload) => ipcRenderer.invoke('gateway:renameCid', payload || {}),
    subscribePlan: (payload) =>
      ipcRenderer.invoke('gateway:subscribePlan', payload || {}),
    registerGateway: (payload) => ipcRenderer.invoke('gateway:registerGateway', payload || {}),
    updateGateway: (payload) => ipcRenderer.invoke('gateway:updateGateway', payload || {})
  },
  addressBook: {
    list: () => ipcRenderer.invoke('addressbook:list'),
    add: (contact) => ipcRenderer.invoke('addressbook:add', contact),
    update: (id, updates) => ipcRenderer.invoke('addressbook:update', id, updates),
    delete: (id) => ipcRenderer.invoke('addressbook:delete', id)
  },
  security: {
    getStatus: () => ipcRenderer.invoke('security:getStatus'),
    setPassword: (payload) => ipcRenderer.invoke('security:setPassword', payload || {}),
    verifyPassword: (payload) => ipcRenderer.invoke('security:verifyPassword', payload || {}),
    removePassword: (payload) => ipcRenderer.invoke('security:removePassword', payload || {}),
    lockSession: () => ipcRenderer.invoke('security:lockSession'),
    checkSession: () => ipcRenderer.invoke('security:checkSession'),
    extendSession: () => ipcRenderer.invoke('security:extendSession'),
    touchSession: () => ipcRenderer.invoke('security:touchSession'),
    onSessionChanged: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('security:sessionChanged', handler);
      return () => {
        ipcRenderer.removeListener('security:sessionChanged', handler);
      };
    }
  },
  lumenSite: {
    onUiRequest: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, payload) => {
        try {
          callback(payload);
        } catch {
          // ignore callback errors
        }
      };
      ipcRenderer.on('lumenSite:uiRequest', handler);
      return () => {
        ipcRenderer.removeListener('lumenSite:uiRequest', handler);
      };
    },
    respondUiRequest: (id, response) => {
      ipcRenderer.send('lumenSite:uiResponse', { id, response: response ?? null });
    }
  },
  domainSite: {
    sendToken: (payload) => ipcRenderer.invoke('domainSite:sendToken', payload || {}),
    pin: (payload) => ipcRenderer.invoke('domainSite:pin', payload || {})
  }
});

// Also expose as electronAPI for compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  ipfsStatus: () => ipcRenderer.invoke('ipfs:status'),
  ipfsAdd: (data, filename) => ipcRenderer.invoke('ipfs:add', data, filename)
});
