const { app, BrowserWindow, shell } = require('electron');
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

function isRootUser() {
  try {
    return typeof process.getuid === 'function' && process.getuid() === 0;
  } catch {
    return false;
  }
}

function needsNoSandboxArg() {
  if (!isRootUser()) return false;
  const argv = Array.isArray(process.argv) ? process.argv : [];
  return !argv.includes('--no-sandbox');
}

function safeFilename(input) {
  const s = String(input || '').trim();
  if (!s) return 'update.bin';
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 180) || 'update.bin';
}

function getHttpModule(url) {
  return url.protocol === 'http:' ? http : https;
}

function shQuote(value) {
  const s = String(value ?? '');
  if (!s) return "''";
  return `'${s.replace(/'/g, `'\\''`)}'`;
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

async function ensureExecutable(filePath) {
  try {
    // rwxr-xr-x
    await fs.promises.chmod(filePath, 0o755);
  } catch {
    // ignore chmod failures (e.g. on filesystems that don't support it)
  }
}

function spawnDetached(cmd, args = [], options = {}) {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true, ...(options || {}) });
  child.unref();
  return child;
}

function spawnAfterExitPosix({ waitPid, command, args = [], env = {} }) {
  const pid = Number(waitPid) || process.pid;
  const cmd = shQuote(command);
  const quotedArgs = Array.isArray(args) ? args.map(shQuote).join(' ') : '';
  const exports = Object.entries(env || {})
    .filter(([k]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(k || '')))
    .map(([k, v]) => `${k}=${shQuote(String(v ?? ''))}`)
    .join(' ');

  const script = [
    `pid=${pid}`,
    'while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done',
    `${exports ? `${exports} ` : ''}${cmd}${quotedArgs ? ` ${quotedArgs}` : ''} >/dev/null 2>&1 &`
  ].join('; ');

  return spawnDetached('sh', ['-c', script]);
}

async function downloadAndInstall({ url, sha256Hex, sizeBytes, silent = true, label, senderWebContents }) {
  const u = new URL(String(url || ''));
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'invalid_url' };
  }
  const expectedSha = String(sha256Hex || '').trim().toLowerCase();
  if (expectedSha && !isValidSha256Hex(expectedSha)) return { ok: false, error: 'invalid_sha256' };

  const updatesDir = path.join(app.getPath('userData'), 'updates');
  const defaultName =
    process.platform === 'win32'
      ? 'LumenBrowser-Setup.exe'
      : process.platform === 'darwin'
        ? 'LumenBrowser.dmg'
        : 'LumenBrowser.AppImage';
  const filenameFromUrl = safeFilename(path.basename(u.pathname || '') || defaultName);
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

    if (process.platform === 'win32') {
      const launched = await launchInstaller(dl.path, { silent: !!silent });
      if (!launched || launched.ok === false) {
        const errMsg = String(launched?.error || 'installer_launch_failed');
        notify({ stage: 'error', error: errMsg, label: label || null });
        return { ok: false, error: errMsg };
      }
    } else if (process.platform === 'linux') {
      await ensureExecutable(dl.path);

      const extraArgs = [];
      if (needsNoSandboxArg()) extraArgs.push('--no-sandbox');

      // Best-effort: if running from an AppImage and we can write next to it,
      // replace it on disk so the next launch uses the updated binary.
      const currentAppImage = String(process.env.APPIMAGE || '').trim();
      const looksLikeAppImage = /\.appimage$/i.test(dl.path);
      const canSwapInPlace =
        looksLikeAppImage &&
        currentAppImage &&
        currentAppImage !== dl.path &&
        fs.existsSync(currentAppImage);

      if (canSwapInPlace) {
        // Use a helper so we can swap after this process exits (avoids running two versions at once).
        const src = dl.path;
        const dst = currentAppImage;
        const script = [
          `pid=${process.pid}`,
          `src=${shQuote(src)}`,
          `dst=${shQuote(dst)}`,
          'while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done',
          'chmod +x "$src" 2>/dev/null || true',
          'if [ -w "$(dirname \"$dst\")" ]; then',
          '  ts=$(date +%s 2>/dev/null || echo 0)',
          '  if [ -f "$dst" ]; then mv "$dst" "${dst}.bak-$ts" 2>/dev/null || true; fi',
          '  mv "$src" "$dst" 2>/dev/null || cp "$src" "$dst"',
          '  chmod +x "$dst" 2>/dev/null || true',
          `  "$dst"${extraArgs.length ? ` ${extraArgs.map(shQuote).join(' ')}` : ''} >/dev/null 2>&1 &`,
          'else',
          `  "$src"${extraArgs.length ? ` ${extraArgs.map(shQuote).join(' ')}` : ''} >/dev/null 2>&1 &`,
          'fi'
        ].join('; ');

        spawnDetached('sh', ['-c', script]);
      } else {
        // Relaunch the downloaded AppImage after exit.
        spawnAfterExitPosix({ waitPid: process.pid, command: dl.path, args: extraArgs });
      }

      // Quit so we don't keep ports/resources busy (IPFS, etc.).
      setTimeout(() => {
        try {
          app.quit();
        } catch {}
      }, 800);

      return { ok: true };
    } else if (process.platform === 'darwin') {
      // DMG install is user-driven. We download+verify, then open the DMG.
      try {
        const err = await shell.openPath(dl.path);
        if (err) throw new Error(err);
      } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        notify({ stage: 'error', error: msg || 'open_failed', label: label || null });
        return { ok: false, error: msg || 'open_failed' };
      }

      // Quit so the user can replace the app in /Applications if needed.
      setTimeout(() => {
        try {
          app.quit();
        } catch {}
      }, 1500);

      return { ok: true };
    } else {
      // Unknown platform: open download URL in external browser.
      try {
        await shell.openExternal(u.toString());
      } catch {}
      return { ok: false, error: 'unsupported_platform' };
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
