const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumen', {
  ipfsStatus: () => ipcRenderer.invoke('ipfs:status'),
  ipfsAdd: (data, filename) => ipcRenderer.invoke('ipfs:add', data, filename),
  ipfsGet: (cid) => ipcRenderer.invoke('ipfs:get', cid),
  ipfsPinList: () => ipcRenderer.invoke('ipfs:pinList'),
  ipfsUnpin: (cid) => ipcRenderer.invoke('ipfs:unpin', cid),
  ipfsStats: () => ipcRenderer.invoke('ipfs:stats'),
  ipfsPublishToIPNS: (cid, key) => ipcRenderer.invoke('ipfs:publishToIPNS', cid, key),
  ipfsResolveIPNS: (name) => ipcRenderer.invoke('ipfs:resolveIPNS', name),
  ipfsKeyList: () => ipcRenderer.invoke('ipfs:keyList'),
  ipfsKeyGen: (name) => ipcRenderer.invoke('ipfs:keyGen', name),
  setWindowMode: (mode) => ipcRenderer.send('window:mode', mode),
  openMainWindow: () => ipcRenderer.invoke('window:open-main'),
  httpGet: (url, options) => ipcRenderer.invoke('http:get', url, options || {}),
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
    import: (json) => ipcRenderer.invoke('profiles:import', json),
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
  }
});

// Also expose as electronAPI for compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  ipfsStatus: () => ipcRenderer.invoke('ipfs:status'),
  ipfsAdd: (data, filename) => ipcRenderer.invoke('ipfs:add', data, filename)
});
