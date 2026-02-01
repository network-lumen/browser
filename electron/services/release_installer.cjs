const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

function currentAppVersion() {
  const vElectron = String((process.versions && process.versions.electron) || '').trim();
  let v = '';
  try {
    v = app && typeof app.getVersion === 'function' ? String(app.getVersion() || '').trim() : '';
  } catch {
    v = '';
  }
  if (v && vElectron && v !== vElectron) return v;
  try {
    // electron/services -> electron -> app root
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const pkg = require('../../package.json');
    const pv = String(pkg && pkg.version ? pkg.version : '').trim();
    if (pv) return pv;
  } catch {}
  return v || '';
}

function isValidSha256Hex(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || '').trim());
}

function sendToWebContents(webContents, channel, payload) {
  try {
    webContents?.send?.(channel, payload);
  } catch {}
}

function broadcast(channel, payload) {
  try {
    const wins = typeof BrowserWindow.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
    for (const w of wins) sendToWebContents(w?.webContents, channel, payload);
  } catch {}
}

function safeFilename(input) {
  const s = String(input || '').trim();
  if (!s) return 'update.exe';
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 180) || 'update.exe';
}

function getHttpModule(url) {
  return url.protocol === 'http:' ? http : https;
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function downloadToFile({ url, targetPath, expectedSha256Hex, expectedSizeBytes, onProgress }) {
  const u = new URL(url);
  const mod = getHttpModule(u);

  await ensureDir(path.dirname(targetPath));

  return new Promise((resolve, reject) => {
    const req = mod.get(
      u,
      {
        headers: {
          'User-Agent': `LumenBrowser/${currentAppVersion()}`.trim() || 'LumenBrowser'
        }
      },
      (res) => {
        const status = Number(res.statusCode || 0);
        if (status >= 300 && status < 400 && res.headers.location) {
          const next = new URL(res.headers.location, u).toString();
          res.resume();
          downloadToFile({
            url: next,
            targetPath,
            expectedSha256Hex,
            expectedSizeBytes,
            onProgress
          })
            .then(resolve)
            .catch(reject);
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`download_failed_http_${status || 'unknown'}`));
          return;
        }

        const totalHeader = res.headers['content-length'];
        const total = Number(totalHeader) || Number(expectedSizeBytes) || null;

        const tmpPath = `${targetPath}.part`;
        const out = fs.createWriteStream(tmpPath);
        const hash = crypto.createHash('sha256');

        let received = 0;
        let lastEmit = 0;

        function emitProgress(force) {
          const now = Date.now();
          if (!force && now - lastEmit < 150) return;
          lastEmit = now;
          onProgress?.({ receivedBytes: received, totalBytes: total });
        }

        res.on('data', (chunk) => {
          received += chunk.length;
          hash.update(chunk);
          emitProgress(false);
        });
        res.on('error', (e) => reject(e));
        out.on('error', (e) => reject(e));

        out.on('finish', async () => {
          try {
            emitProgress(true);
            const digest = hash.digest('hex').toLowerCase();
            const expected = String(expectedSha256Hex || '').trim().toLowerCase();
            if (expected && digest !== expected) {
              try {
                await fs.promises.unlink(tmpPath);
              } catch {}
              reject(new Error('sha256_mismatch'));
              return;
            }
            if (Number.isFinite(Number(expectedSizeBytes)) && Number(expectedSizeBytes) > 0) {
              if (received !== Number(expectedSizeBytes)) {
                // Size mismatch is suspicious, but don't block if content-length is missing.
                // Only block if caller explicitly provided a size.
                try {
                  await fs.promises.unlink(tmpPath);
                } catch {}
                reject(new Error('size_mismatch'));
                return;
              }
            }
            await fs.promises.rename(tmpPath, targetPath);
            resolve({ ok: true, path: targetPath, sha256Hex: digest, sizeBytes: received });
          } catch (e) {
            reject(e);
          }
        });

        res.pipe(out);
      }
    );
    req.on('error', (e) => reject(e));
  });
}

function launchInstaller(installerPath, { silent }) {
  return new Promise((resolve) => {
    try {
      const args = [];
      if (silent) args.push('/S');

      const child = spawn(installerPath, args, { detached: true, stdio: 'ignore', windowsHide: false });

      let settled = false;
      const done = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };

      child.once('error', (err) => done({ ok: false, error: String(err && err.message ? err.message : err) }));
      child.once('spawn', () => done({ ok: true }));

      // Fallback: if neither event fires, don't hang forever.
      setTimeout(() => done({ ok: true }), 800);

      child.unref();
    } catch (e) {
      resolve({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
}

async function downloadAndInstall({ url, sha256Hex, sizeBytes, silent = true, label, senderWebContents }) {
  const u = new URL(String(url || ''));
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'invalid_url' };
  }
  const expectedSha = String(sha256Hex || '').trim().toLowerCase();
  if (expectedSha && !isValidSha256Hex(expectedSha)) return { ok: false, error: 'invalid_sha256' };

  if (process.platform !== 'win32') return { ok: false, error: 'unsupported_platform' };

  const updatesDir = path.join(app.getPath('userData'), 'updates');
  const filenameFromUrl = safeFilename(path.basename(u.pathname || '') || 'LumenBrowser-Setup.exe');
  const targetPath = path.join(updatesDir, filenameFromUrl);

  const notify = (payload) => {
    const msg = { kind: 'release_update', ...(payload || {}) };
    sendToWebContents(senderWebContents, 'release:updateProgress', msg);
    broadcast('release:updateProgress', msg);
  };

  notify({ stage: 'downloading', receivedBytes: 0, totalBytes: Number(sizeBytes) || null, label: label || null });

  try {
    const dl = await downloadToFile({
      url: u.toString(),
      targetPath,
      expectedSha256Hex: expectedSha,
      expectedSizeBytes: sizeBytes,
      onProgress: ({ receivedBytes, totalBytes }) => {
        notify({ stage: 'downloading', receivedBytes, totalBytes, label: label || null });
      }
    });

    notify({ stage: 'verifying', receivedBytes: dl.sizeBytes, totalBytes: dl.sizeBytes, sha256Hex: dl.sha256Hex, label: label || null });

    // Quick check: we already verified during download, but keep payload consistent.
    if (expectedSha && dl.sha256Hex !== expectedSha) {
      notify({ stage: 'error', error: 'sha256_mismatch', label: label || null });
      return { ok: false, error: 'sha256_mismatch' };
    }

    notify({ stage: 'installing', path: dl.path, label: label || null });
    notify({ stage: 'launching_installer', path: dl.path, silent: !!silent, label: label || null });
    const launched = await launchInstaller(dl.path, { silent: !!silent });
    if (!launched || launched.ok === false) {
      const errMsg = String(launched?.error || 'installer_launch_failed');
      notify({ stage: 'error', error: errMsg, label: label || null });
      return { ok: false, error: errMsg };
    }

    // Give the renderer a moment to paint the "installing" state.
    setTimeout(() => {
      try {
        app.quit();
      } catch {}
    }, 1500);

    return { ok: true };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    notify({ stage: 'error', error: msg, label: label || null });
    return { ok: false, error: msg };
  }
}

module.exports = {
  downloadAndInstall
};
