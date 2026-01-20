const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Cache to reduce log spam
let _cachedPeersFilePath = null;
let _loggedPeersPath = false;

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function ensureHttp(u) {
  const trimmed = trimSlash(u);
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function resolvePeersFilePath() {
  if (_cachedPeersFilePath !== null) return _cachedPeersFilePath || null;

  const appPath = app && typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd();
  const packagedResourcesPath = app && app.isPackaged ? process.resourcesPath : null;

  // Try multiple possible locations for peers.txt
  const candidates = [
    ...(packagedResourcesPath ? [path.join(packagedResourcesPath, 'peers.txt')] : []),
    ...(packagedResourcesPath ? [path.join(packagedResourcesPath, 'resources', 'peers.txt')] : []),
    path.join(appPath, 'resources', 'peers.txt'),
    path.join(appPath, '..', 'peers.txt'),
    path.join(appPath, '..', 'resources', 'peers.txt'), // dev mode: electron/../resources
    path.join(process.cwd(), 'resources', 'peers.txt')
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        if (!_loggedPeersPath) {
          console.log('[net] found peers file at:', file);
          _loggedPeersPath = true;
        }
        _cachedPeersFilePath = file;
        return file;
      }
    } catch {}
  }

  _cachedPeersFilePath = '';
  return null;
}

function parsePeerLine(line) {
  const cleaned = String(line || '').replace(/#.*/, '').trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return null;
  const rpc = parts[0];
  if (!rpc) return null;
  const rest = parts[1] || null;
  const grpc = parts[2] || null;
  return { rpc, rest, grpc };
}

function loadBootstrapPeers() {
  const filePath = resolvePeersFilePath();
  if (!filePath) return [];

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const peers = [];
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parsePeerLine(line);
      if (!parsed) continue;
      peers.push({
        rpc: ensureHttp(parsed.rpc),
        rest: parsed.rest ? ensureHttp(parsed.rest) : null,
        grpc: parsed.grpc ? String(parsed.grpc).trim() : null
      });
    }
    return peers;
  } catch (e) {
    console.warn('[net] unable to read peers file:', filePath, e && e.message ? e.message : e);
    return [];
  }
}

module.exports = {
  trimSlash,
  ensureHttp,
  resolvePeersFilePath,
  loadBootstrapPeers
};

