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

function isoNow() {
  try {
    return new Date().toISOString();
  } catch {
    return String(Date.now());
  }
}

async function appendUpdateLog(logPath, message) {
  if (!logPath) return;
  try {
    await ensureDir(path.dirname(logPath));
  } catch {}
  try {
    const line = `[${isoNow()}] ${String(message || '').trim()}\n`;
    await fs.promises.appendFile(logPath, line, 'utf8');
  } catch {}
}

function isInSystemdAppScope() {
  if (process.platform !== 'linux') return false;
  try {
    const raw = fs.readFileSync('/proc/self/cgroup', 'utf8');
    return /app\.slice\/.+\.scope/.test(raw);
  } catch {
    return false;
  }
}

function pickSystemdRunBinary() {
  const candidates = ['/usr/bin/systemd-run', '/bin/systemd-run'];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return 'systemd-run';
}

function collectSystemdSetenvArgs() {
  const keys = ['DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR', 'LANG', 'LC_ALL'];
  const args = [];
  for (const k of keys) {
    const v = String(process.env[k] || '').trim();
    if (!v) continue;
    // Avoid absurdly long env values in argv.
    if (v.length > 4096) continue;
    args.push(`--setenv=${k}=${v}`);
  }
  return args;
}

function collectPosixExportStatements(envObj) {
  const env = envObj && typeof envObj === 'object' ? envObj : process.env;
  const keys = [
    'PATH',
    'HOME',
    'USER',
    'LOGNAME',
    'SHELL',
    'DISPLAY',
    'WAYLAND_DISPLAY',
    'XAUTHORITY',
    'DBUS_SESSION_BUS_ADDRESS',
    'XDG_RUNTIME_DIR',
    'LANG',
    'LC_ALL'
  ];
  const out = [];
  for (const k of keys) {
    const raw = String(env[k] || '').trim();
    if (!raw) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    if (raw.length > 4096) continue;
    out.push(`export ${k}=${shQuote(raw)}`);
  }
  if (!out.find((s) => s.startsWith('export PATH='))) {
    out.unshift("export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'");
  }
  return out;
}

function buildSystemdRunSpawnEnv() {
  const env = { ...(process.env || {}) };
  if (process.platform !== 'linux') return env;

  try {
    if (!String(env.XDG_RUNTIME_DIR || '').trim() && typeof process.getuid === 'function') {
      const uid = process.getuid();
      const runtimeDir = `/run/user/${uid}`;
      if (runtimeDir && fs.existsSync(runtimeDir)) env.XDG_RUNTIME_DIR = runtimeDir;
    }
  } catch {}

  try {
    if (!String(env.DBUS_SESSION_BUS_ADDRESS || '').trim()) {
      const rd = String(env.XDG_RUNTIME_DIR || '').trim();
      if (rd) {
        const busPath = `${rd.replace(/\/$/, '')}/bus`;
        if (busPath && fs.existsSync(busPath)) env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${busPath}`;
      }
    }
  } catch {}

  return env;
}

async function runCommandForExit(cmd, args, { timeoutMs = 3500, env } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const cap = (s) => (s.length > 6000 ? s.slice(0, 6000) : s);
    const done = (payload) => {
      if (settled) return;
      settled = true;
      resolve({ ...(payload || {}), stdout, stderr });
    };

    try {
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: env || process.env });
      if (child.stdout) {
        child.stdout.on('data', (d) => {
          stdout = cap(stdout + String(d));
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (d) => {
          stderr = cap(stderr + String(d));
        });
      }

      const t = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {}
        done({ ok: false, error: 'timeout' });
      }, timeoutMs);

      child.once('error', (err) => {
        clearTimeout(t);
        done({ ok: false, error: String(err && err.message ? err.message : err) });
      });
      child.once('close', (code) => {
        clearTimeout(t);
        const ok = Number(code) === 0;
        done({ ok, code: Number.isFinite(Number(code)) ? Number(code) : null, error: ok ? null : `exit_${code}` });
      });
    } catch (e) {
      done({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
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

      const relaunchLogPath = path.join(updatesDir, 'update_relaunch.log');
      await appendUpdateLog(
        relaunchLogPath,
        `linux_update start pid=${process.pid} appImage=${String(process.env.APPIMAGE || '').trim() || 'n/a'} downloaded=${dl.path}`
      );

      // Best-effort: if running from an AppImage and we can write next to it,
      // replace it on disk so the next launch uses the updated binary.
      const currentAppImage = String(process.env.APPIMAGE || '').trim();
      const looksLikeAppImage = /\.appimage$/i.test(dl.path);
      const canSwapInPlace =
        looksLikeAppImage &&
        currentAppImage &&
        currentAppImage !== dl.path &&
        fs.existsSync(currentAppImage);

      const inSystemdAppScope = isInSystemdAppScope();
      const src = dl.path;
      const dst = currentAppImage;

      const waitScriptPrelude = [
        `log=${shQuote(relaunchLogPath)}`,
        `pid=${process.pid}`,
        'echo "[relaunch] helper started (pid=$$) waiting for parent=$pid" >>"$log" 2>&1 || true',
        // Avoid hanging forever in case of PID reuse or weird shutdowns.
        'deadline=$(date +%s 2>/dev/null || echo 0)',
        'deadline=$((deadline + 90))',
        'while kill -0 "$pid" 2>/dev/null; do',
        '  now=$(date +%s 2>/dev/null || echo 0)',
        '  if [ "$now" -ge "$deadline" ]; then echo "[relaunch] timeout waiting for parent" >>"$log" 2>&1 || true; break; fi',
        '  sleep 0.2',
        'done',
        'echo "[relaunch] parent exited, continuing" >>"$log" 2>&1 || true'
      ];

      const swapAndExecScript = [
        ...waitScriptPrelude,
        `src=${shQuote(src)}`,
        `dst=${shQuote(dst)}`,
        'chmod +x "$src" 2>/dev/null || true',
        'if [ -w "$(dirname "$dst")" ]; then',
        '  ts=$(date +%s 2>/dev/null || echo 0)',
        '  if [ -f "$dst" ]; then mv "$dst" "${dst}.bak-$ts" 2>/dev/null || true; fi',
        '  mv "$src" "$dst" 2>/dev/null || cp "$src" "$dst"',
        '  chmod +x "$dst" 2>/dev/null || true',
        `  echo "[relaunch] exec swapped dst=$dst" >>"$log" 2>&1 || true`,
        `  exec "$dst"${extraArgs.length ? ` ${extraArgs.map(shQuote).join(' ')}` : ''}`,
        'else',
        `  echo "[relaunch] no write access, exec src=$src" >>"$log" 2>&1 || true`,
        `  exec "$src"${extraArgs.length ? ` ${extraArgs.map(shQuote).join(' ')}` : ''}`,
        'fi'
      ].join('; ');

      const execDownloadedScript = [
        ...waitScriptPrelude,
        `src=${shQuote(src)}`,
        'chmod +x "$src" 2>/dev/null || true',
        `echo "[relaunch] exec src=$src" >>"$log" 2>&1 || true`,
        `exec "$src"${extraArgs.length ? ` ${extraArgs.map(shQuote).join(' ')}` : ''}`
      ].join('; ');

      const scriptToRun = canSwapInPlace ? swapAndExecScript : execDownloadedScript;

      let scheduled = false;

      // Desktop environments often launch apps in a transient systemd scope (app.slice/*.scope).
      // When the main process exits, systemd may kill remaining processes in that scope, including our helper.
      // To survive that cleanup, prefer scheduling the relaunch via systemd-run (separate unit).
      if (!isRootUser()) {
        const bin = pickSystemdRunBinary();
        const spawnEnv = buildSystemdRunSpawnEnv();
        const exportLines = collectPosixExportStatements(spawnEnv);
        const scriptWithExports = `${exportLines.join('; ')}; ${scriptToRun}`;

        const attempts = [
          { name: 'user-scope', args: ['--user', '--expand-environment=no', '--scope', '/bin/sh', '-c', scriptWithExports] },
          { name: 'user-service', args: ['--user', '--expand-environment=no', '/bin/sh', '-c', scriptWithExports] },
          { name: 'user-scope-legacy', args: ['--user', '--scope', '/bin/sh', '-c', scriptWithExports] },
          { name: 'user-service-legacy', args: ['--user', '/bin/sh', '-c', scriptWithExports] }
        ];

        for (const a of attempts) {
          const res = await runCommandForExit(bin, a.args, { timeoutMs: 4500, env: spawnEnv });
          if (res.ok) {
            scheduled = true;
            await appendUpdateLog(relaunchLogPath, `systemd-run scheduled via=${a.name}`);
            break;
          }
          await appendUpdateLog(
            relaunchLogPath,
            `systemd-run failed via=${a.name} err=${String(res.error || '').trim()} stdout=${JSON.stringify(res.stdout || '')} stderr=${JSON.stringify(
              res.stderr || ''
            )}`
          );
        }
      }

      if (!scheduled) {
        // If running as root (or via sudo), try scheduling in the system manager (no --user).
        if (isRootUser()) {
          const bin = pickSystemdRunBinary();
          const spawnEnv = buildSystemdRunSpawnEnv();
          const exportLines = collectPosixExportStatements(spawnEnv);
          const scriptWithExports = `${exportLines.join('; ')}; ${scriptToRun}`;

          const attempts = [
            { name: 'system-scope', args: ['--expand-environment=no', '--scope', '/bin/sh', '-c', scriptWithExports] },
            { name: 'system-service', args: ['--expand-environment=no', '/bin/sh', '-c', scriptWithExports] },
            { name: 'system-scope-legacy', args: ['--scope', '/bin/sh', '-c', scriptWithExports] },
            { name: 'system-service-legacy', args: ['/bin/sh', '-c', scriptWithExports] }
          ];

          for (const a of attempts) {
            const res = await runCommandForExit(bin, a.args, { timeoutMs: 4500, env: spawnEnv });
            if (res.ok) {
              scheduled = true;
              await appendUpdateLog(relaunchLogPath, `systemd-run scheduled via=${a.name}`);
              break;
            }
            await appendUpdateLog(
              relaunchLogPath,
              `systemd-run failed via=${a.name} err=${String(res.error || '').trim()} stdout=${JSON.stringify(res.stdout || '')} stderr=${JSON.stringify(
                res.stderr || ''
              )}`
            );
          }
        }
      }

      if (!scheduled) {
        if (inSystemdAppScope) {
          const msg =
            'Could not relaunch automatically from this Linux environment (systemd app scope). The update was downloaded.';
          await appendUpdateLog(relaunchLogPath, `systemd_app_scope relaunch_unavailable msg=${msg}`);
          try {
            shell.showItemInFolder(dl.path);
          } catch {}

          // Last-resort UX improvement: ask the OS to open the downloaded AppImage. If the desktop environment
          // launches it outside of our current scope, it can survive our shutdown.
          if (!isRootUser()) {
            try {
              const err = await shell.openPath(dl.path);
              if (!err) {
                await appendUpdateLog(relaunchLogPath, 'fallback openPath ok');
                setTimeout(() => {
                  try {
                    app.quit();
                  } catch {}
                }, 800);
                return { ok: true };
              }
              await appendUpdateLog(relaunchLogPath, `fallback openPath failed err=${String(err || '').trim()}`);
            } catch (e) {
              await appendUpdateLog(relaunchLogPath, `fallback openPath exception err=${String(e && e.message ? e.message : e)}`);
            }
          }

          const displayMsg = `${msg} Please launch it manually from the opened folder.`;
          notify({ stage: 'error', error: displayMsg, label: label || null });
          return { ok: false, error: displayMsg };
        }

        // Fallback: relaunch helper in the current environment (best-effort).
        try {
          spawnDetached('sh', ['-c', scriptToRun]);
          scheduled = true;
          await appendUpdateLog(relaunchLogPath, 'fallback scheduled via sh -c');
        } catch (e) {
          const msg = String(e && e.message ? e.message : e);
          await appendUpdateLog(relaunchLogPath, `fallback_spawn_failed err=${msg}`);
          notify({ stage: 'error', error: msg || 'relaunch_failed', label: label || null });
          return { ok: false, error: msg || 'relaunch_failed' };
        }
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
