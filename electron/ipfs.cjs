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

async function checkIpfsStatus() {
  try {
    console.log('[electron][ipfs] checking status on 127.0.0.1:5001');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('http://127.0.0.1:5001/api/v0/id?enc=json', {
      method: 'POST',
      signal: controller.signal
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn('[electron][ipfs] status HTTP not ok:', res.status);
      return { ok: false, error: 'http_' + res.status };
    }
    await res.text().catch(() => '');
    console.log('[electron][ipfs] status ok');
    return { ok: true };
  } catch (e) {
    console.warn('[electron][ipfs] status error:', e);
    return { ok: false, error: String(e && e.message ? e.message : e) };
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
  stopIpfsDaemon
};

