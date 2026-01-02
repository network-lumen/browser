const { app } = require('electron');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');

let ipfsProcess = null;

function resolveKuboBin() {
  try {
    const kubo = require('kubo');
    const p = typeof kubo?.path === 'function' ? kubo.path() : kubo?.path;
    if (typeof p === 'string' && p.length > 0) return p;
  } catch (_e) {
    // fall through
  }
  return 'ipfs';
}

function getIpfsRepoPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'ipfs');
}

function ensureIpfsRepo(bin) {
  const repoPath = getIpfsRepoPath();
  try {
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
    }
    const configFile = path.join(repoPath, 'config');
    if (!fs.existsSync(configFile)) {
      console.log('[electron][ipfs] initializing repo at', repoPath);
      const r = spawnSync(bin, ['init'], {
        env: { ...process.env, IPFS_PATH: repoPath },
        stdio: 'pipe'
      });
      if (r.error) {
        console.warn('[electron][ipfs] ipfs init error', r.error);
      } else if (r.status !== 0) {
        console.warn(
          '[electron][ipfs] ipfs init failed with code',
          r.status,
          String(r.stderr || '')
        );
      }
    }
  } catch (e) {
    console.warn('[electron][ipfs] ensureIpfsRepo failed', e);
  }
  return repoPath;
}

function startIpfsDaemon() {
  if (ipfsProcess) return;
  const bin = resolveKuboBin();
  console.log('[electron][ipfs] using binary:', bin);
  const repoPath = ensureIpfsRepo(bin);
  console.log('[electron][ipfs] starting daemon with repo:', repoPath);
  try {
    ipfsProcess = spawn(
      bin,
      [ 'daemon', '--migrate=true', '--enable-gc', '--routing', 'dhtclient', '--enable-pubsub-experiment' ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env: {
          ...process.env,
          IPFS_PATH: repoPath,
          IPFS_ALLOW_BIG_BLOCK: '1'
        }
      }
    );
    ipfsProcess.stdout?.setEncoding('utf8');
    ipfsProcess.stderr?.setEncoding('utf8');
    ipfsProcess.stdout?.on('data', (d) => {
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => console.log('[electron][ipfs][stdout]', line));
    });
    ipfsProcess.stderr?.on('data', (d) => {
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => console.warn('[electron][ipfs][stderr]', line));
    });
    ipfsProcess.on('exit', () => {
      console.log('[electron][ipfs] daemon exited');
      ipfsProcess = null;
    });
  } catch (e) {
    console.error('[electron][ipfs] failed to spawn daemon:', e);
    ipfsProcess = null;
  }
}

async function checkIpfsStatus(retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[electron][ipfs] checking status on 127.0.0.1:5001 (attempt ${attempt}/${retries})`);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('http://127.0.0.1:5001/api/v0/id?enc=json', {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(t);
      if (!res.ok) {
        console.warn('[electron][ipfs] status HTTP not ok:', res.status);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return { ok: false, error: 'http_' + res.status };
      }
      await res.text().catch(() => '');
      console.log('[electron][ipfs] status ok');
      return { ok: true };
    } catch (e) {
      console.warn('[electron][ipfs] status error:', e.message || e);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }
  return { ok: false, error: 'max retries exceeded' };
}

async function ipfsAdd(data, filename) {
  try {
    console.log('[electron][ipfs] adding file:', filename, 'size:', data?.length || 0);
    const FormData = (await import('node:buffer')).Blob ? global.FormData : require('form-data');
    
    // Create multipart form data
    const boundary = '----LumenIPFS' + Date.now();
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename || 'file'}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    
    const headerBuf = Buffer.from(header, 'utf8');
    const footerBuf = Buffer.from(footer, 'utf8');
    const dataBuf = Buffer.from(data);
    const body = Buffer.concat([headerBuf, dataBuf, footerBuf]);

    const res = await fetch('http://127.0.0.1:5001/api/v0/add?pin=true', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] add failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] add success:', json.Hash);
    return { ok: true, cid: json.Hash, name: json.Name, size: json.Size };
  } catch (e) {
    console.error('[electron][ipfs] add error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsGet(cid) {
  try {
    console.log('[electron][ipfs] getting file:', cid);
    const res = await fetch(`http://127.0.0.1:5001/api/v0/cat?arg=${cid}`, {
      method: 'POST'
    });

    if (!res.ok) {
      console.warn('[electron][ipfs] get failed:', res.status);
      return { ok: false, error: 'http_' + res.status };
    }

    const buffer = await res.arrayBuffer();
    console.log('[electron][ipfs] get success, size:', buffer.byteLength);
    return { ok: true, data: Array.from(new Uint8Array(buffer)) };
  } catch (e) {
    console.error('[electron][ipfs] get error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsPinList() {
  try {
    const res = await fetch('http://127.0.0.1:5001/api/v0/pin/ls?type=recursive', {
      method: 'POST'
    });

    if (!res.ok) {
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    const pins = Object.keys(json.Keys || {});
    console.log('[electron][ipfs] pin list:', pins.length, 'items');
    return { ok: true, pins };
  } catch (e) {
    console.error('[electron][ipfs] pin list error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsUnpin(cid) {
  try {
    console.log('[electron][ipfs] unpinning:', cid);
    const res = await fetch(`http://127.0.0.1:5001/api/v0/pin/rm?arg=${cid}`, {
      method: 'POST'
    });

    if (!res.ok) {
      console.warn('[electron][ipfs] unpin failed:', res.status);
      return { ok: false, error: 'http_' + res.status };
    }

    console.log('[electron][ipfs] unpin success');
    return { ok: true };
  } catch (e) {
    console.error('[electron][ipfs] unpin error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsStats() {
  try {
    const res = await fetch('http://127.0.0.1:5001/api/v0/repo/stat', {
      method: 'POST'
    });

    if (!res.ok) {
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    return { 
      ok: true, 
      repoSize: json.RepoSize,
      storageMax: json.StorageMax,
      numObjects: json.NumObjects
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsPublishToIPNS(cid, key = 'self') {
  try {
    console.log('[electron][ipfs] publishing to IPNS:', cid, 'key:', key);
    const res = await fetch(`http://127.0.0.1:5001/api/v0/name/publish?arg=/ipfs/${cid}&key=${key}`, {
      method: 'POST'
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] IPNS publish failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] IPNS publish success:', json.Name);
    return { ok: true, name: json.Name, value: json.Value };
  } catch (e) {
    console.error('[electron][ipfs] IPNS publish error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsResolveIPNS(name) {
  try {
    console.log('[electron][ipfs] resolving IPNS:', name);
    const res = await fetch(`http://127.0.0.1:5001/api/v0/name/resolve?arg=${name}`, {
      method: 'POST'
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] IPNS resolve failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] IPNS resolve success:', json.Path);
    return { ok: true, path: json.Path };
  } catch (e) {
    console.error('[electron][ipfs] IPNS resolve error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsKeyList() {
  try {
    const res = await fetch('http://127.0.0.1:5001/api/v0/key/list', {
      method: 'POST'
    });

    if (!res.ok) {
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] key list:', json.Keys?.length || 0, 'keys');
    return { ok: true, keys: json.Keys || [] };
  } catch (e) {
    console.error('[electron][ipfs] key list error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsKeyGen(name) {
  try {
    console.log('[electron][ipfs] generating key:', name);
    const res = await fetch(`http://127.0.0.1:5001/api/v0/key/gen?arg=${name}&type=rsa&size=2048`, {
      method: 'POST'
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] key gen failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] key gen success:', json.Name, json.Id);
    return { ok: true, name: json.Name, id: json.Id };
  } catch (e) {
    console.error('[electron][ipfs] key gen error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

function stopIpfsDaemon() {
  if (ipfsProcess && !ipfsProcess.killed) {
    try { ipfsProcess.kill(); } catch {}
  }
}

module.exports = {
  startIpfsDaemon,
  checkIpfsStatus,
  stopIpfsDaemon,
  ipfsAdd,
  ipfsGet,
  ipfsPinList,
  ipfsUnpin,
  ipfsStats,
  ipfsPublishToIPNS,
  ipfsResolveIPNS,
  ipfsKeyList,
  ipfsKeyGen
};

