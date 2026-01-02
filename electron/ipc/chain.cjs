const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { httpGet } = require('./http.cjs');

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function ensureHttp(u) {
  const trimmed = trimSlash(u);
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function resolvePeersFilePath() {
  const appPath = app && typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd();
  
  // Try multiple possible locations for peers.txt
  const candidates = [
    path.join(appPath, 'resources', 'peers.txt'),
    path.join(appPath, '..', 'resources', 'peers.txt'),  // dev mode: electron/../resources
    path.join(process.cwd(), 'resources', 'peers.txt'),
  ];
  
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        console.log('[rpc] found peers file at:', file);
        return file;
      }
    } catch {}
  }

  return null;
}

function parsePeerLine(line) {
  const cleaned = String(line || '').replace(/#.*/, '').trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return null;
  const rpc = parts[0];
  if (!rpc) return null;
  return { rpc };
}

function loadPeersFromFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const peers = [];
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parsePeerLine(line);
      if (parsed) peers.push(parsed);
    }
    return peers;
  } catch (e) {
    console.warn(
      '[rpc] unable to read peers file:',
      filePath,
      e && e.message ? e.message : e
    );
    return [];
  }
}

function getRpcBaseUrl() {
  const peersFile = resolvePeersFilePath();
  if (!peersFile) {
    console.warn('[rpc] peers file not found');
    return null;
  }

  const peers = loadPeersFromFile(peersFile);
  if (!peers.length) {
    console.warn('[rpc] no valid peers found in', peersFile);
    return null;
  }

  const first = peers[0];
  if (!first || !first.rpc) {
    return null;
  }

  const base = ensureHttp(first.rpc);
  console.log('[rpc] using base endpoint from peers file:', base);
  return base;
}

const chainState = {
  rpcBase: null,
  height: null,
  status: 'idle',
  error: null,
  lastUpdated: 0,
  polling: false
};

let chainPollTimer = null;

async function pollChainOnce(reason) {
  if (chainState.polling) return;
  chainState.polling = true;

  try {
    const base = getRpcBaseUrl();
    if (!base) {
      chainState.rpcBase = null;
      chainState.height = null;
      chainState.status = 'error';
      chainState.error = 'rpc_base_missing';
      chainState.lastUpdated = Date.now();
      return;
    }

    chainState.rpcBase = base;

    const url = `${trimSlash(base)}/status`;
    const res = await httpGet(url, { timeout: 7000 });

    let data = res && res.json ? res.json : null;
    if (!data && res && typeof res.text === 'string' && res.text) {
      try {
        data = JSON.parse(res.text);
      } catch {
        data = null;
      }
    }

    const raw =
      data &&
      data.result &&
      data.result.sync_info &&
      data.result.sync_info.latest_block_height;
    const height = Number(raw);

    if (!Number.isFinite(height) || height <= 0) {
      chainState.height = null;
      chainState.status = 'error';
      chainState.error = 'invalid_height';
      chainState.lastUpdated = Date.now();
      return;
    }

    const prevHeight = chainState.height;
    chainState.height = height;
    chainState.status = 'ok';
    chainState.error = null;
    chainState.lastUpdated = Date.now();

    if (height !== prevHeight) {
      broadcastChainState();
    }
  } catch (e) {
    chainState.height = null;
    chainState.status = 'error';
    chainState.error = String(e && e.message ? e.message : e);
    chainState.lastUpdated = Date.now();
  } finally {
    chainState.polling = false;
  }
}

function broadcastChainState() {
  const payload = {
    height: chainState.height,
    status: chainState.status,
    error: chainState.error,
    lastUpdated: chainState.lastUpdated,
    rpcBase: chainState.rpcBase
  };
  try {
    const all = BrowserWindow.getAllWindows();
    for (const win of all) {
      try {
        win.webContents.send('rpc:heightChanged', payload);
      } catch {}
    }
  } catch {}
}

function scheduleNextChainPoll(delayMs) {
  if (chainPollTimer) clearTimeout(chainPollTimer);
  chainPollTimer = setTimeout(() => {
    pollChainOnce('interval').catch(() => {});
    scheduleNextChainPoll(5000);
  }, delayMs);
}

function startChainPoller() {
  if (chainPollTimer) return;
  scheduleNextChainPoll(1000);
}

function stopChainPoller() {
  if (chainPollTimer) {
    clearTimeout(chainPollTimer);
    chainPollTimer = null;
  }
}

function registerChainIpc() {
  ipcMain.handle('rpc:getHeight', async () => {
    if (!chainState.lastUpdated && !chainState.polling) {
      await pollChainOnce('ipc');
    }

    return {
      ok: chainState.status === 'ok',
      height: chainState.height,
      status: chainState.status,
      error: chainState.error,
      lastUpdated: chainState.lastUpdated,
      rpcBase: chainState.rpcBase
    };
  });
}

module.exports = {
  registerChainIpc,
  startChainPoller,
  stopChainPoller
};
