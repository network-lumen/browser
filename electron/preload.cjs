const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumen', {
  ipfsStatus: () => ipcRenderer.invoke('ipfs:status'),
  ipfsAdd: (data, filename) => ipcRenderer.invoke('ipfs:add', data, filename),
  ipfsAddDirectory: (payload) => ipcRenderer.invoke('ipfs:addDirectory', payload || {}),
  ipfsGet: (cid, options) => ipcRenderer.invoke('ipfs:get', cid, options || {}),
  ipfsLs: (cidOrPath) => ipcRenderer.invoke('ipfs:ls', cidOrPath),
  ipfsPinList: () => ipcRenderer.invoke('ipfs:pinList'),
  ipfsPinAdd: (cidOrPath) => ipcRenderer.invoke('ipfs:pinAdd', cidOrPath),
  ipfsUnpin: (cid) => ipcRenderer.invoke('ipfs:unpin', cid),
  ipfsStats: () => ipcRenderer.invoke('ipfs:stats'),
  ipfsPublishToIPNS: (cid, key) => ipcRenderer.invoke('ipfs:publishToIPNS', cid, key),
  ipfsResolveIPNS: (name) => ipcRenderer.invoke('ipfs:resolveIPNS', name),
  ipfsKeyList: () => ipcRenderer.invoke('ipfs:keyList'),
  ipfsKeyGen: (name) => ipcRenderer.invoke('ipfs:keyGen', name),
  ipfsSwarmPeers: () => ipcRenderer.invoke('ipfs:swarmPeers'),
  setWindowMode: (mode) => ipcRenderer.send('window:mode', mode),
  openMainWindow: () => ipcRenderer.invoke('window:open-main'),
  httpGet: (url, options) => ipcRenderer.invoke('http:get', url, options || {}),
  httpHead: (url, options) => ipcRenderer.invoke('http:head', url, options || {}),
  http: {
    get: (url, options) => ipcRenderer.invoke('http:get', url, options || {})
  },
  pqc: {
    getParams: () => ipcRenderer.invoke('pqc:getParams')
  },
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    getActive: () => ipcRenderer.invoke('profiles:getActive'),
    select: (id) => ipcRenderer.invoke('profiles:setActive', id),
    create: (name) => ipcRenderer.invoke('profiles:create', name),
    export: (id) => ipcRenderer.invoke('profiles:export', id),
    exportBackup: (id) => ipcRenderer.invoke('profiles:exportBackup', id),
    import: (json) => ipcRenderer.invoke('profiles:import', json),
    importBackup: () => ipcRenderer.invoke('profiles:importBackup'),
    delete: (id) => ipcRenderer.invoke('profiles:delete', id)
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
  dns: {
    getParams: () => ipcRenderer.invoke('dns:getParams'),
    getDomainInfo: (name) => ipcRenderer.invoke('dns:getDomainInfo', name),
    listByOwnerDetailed: (owner) => ipcRenderer.invoke('dns:listByOwnerDetailed', owner),
    estimateRegisterPrice: (input) => ipcRenderer.invoke('dns:estimateRegisterPrice', input || {}),
    createDomain: (input) => ipcRenderer.invoke('dns:createDomain', input || {}),
    updateDomain: (input) => ipcRenderer.invoke('dns:updateDomain', input || {})
  },
  wallet: {
    getBalance: (address, opts) => ipcRenderer.invoke('wallet:getBalance', { address, ...(opts || {}) }),
    getTokenomicsParams: () => ipcRenderer.invoke('chain:getTokenomicsParams'),
    sendTokens: (payload) => ipcRenderer.invoke('wallet:sendTokens', payload),
    listSendTxs: (address, opts) => ipcRenderer.invoke('wallet:listSendTxs', { address, ...(opts || {}) })
  },
  gateway: {
    getWalletUsage: (profileId, baseUrl) =>
      ipcRenderer.invoke('gateway:getWalletUsage', { profileId, baseUrl }),
    getWalletPinnedCids: (profileId, baseUrl, page) =>
      ipcRenderer.invoke('gateway:getWalletPinnedCids', { profileId, baseUrl, page }),
    getBaseUrl: (profileId, baseUrl) =>
      ipcRenderer.invoke('gateway:getBaseUrl', { profileId, baseUrl }),
    getPlansOverview: (profileId, options) =>
      ipcRenderer.invoke('gateway:getPlansOverview', { profileId, ...(options || {}) }),
    searchPq: (payload) => ipcRenderer.invoke('gateway:searchPq', payload || {}),
    pinCid: (payload) => ipcRenderer.invoke('gateway:pinCid', payload || {}),
    unpinCid: (payload) => ipcRenderer.invoke('gateway:unpinCid', payload || {}),
    subscribePlan: (payload) =>
      ipcRenderer.invoke('gateway:subscribePlan', payload || {})
  },
  addressBook: {
    list: () => ipcRenderer.invoke('addressbook:list'),
    add: (contact) => ipcRenderer.invoke('addressbook:add', contact),
    update: (id, updates) => ipcRenderer.invoke('addressbook:update', id, updates),
    delete: (id) => ipcRenderer.invoke('addressbook:delete', id)
  }
});

// Also expose as electronAPI for compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  ipfsStatus: () => ipcRenderer.invoke('ipfs:status'),
  ipfsAdd: (data, filename) => ipcRenderer.invoke('ipfs:add', data, filename)
});
