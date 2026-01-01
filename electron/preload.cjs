const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumen', {
  ipfsStatus: () => ipcRenderer.invoke('ipfs:status'),
  setWindowMode: (mode) => ipcRenderer.send('window:mode', mode),
  openMainWindow: () => ipcRenderer.invoke('window:open-main'),
  httpGet: (url, options) => ipcRenderer.invoke('http:get', url, options || {}),
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
  }
});
