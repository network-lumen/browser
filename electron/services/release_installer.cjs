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

function detectDarwinAppBundlePath() {
  try {
    const exe = String(process.execPath || '').trim();
    if (exe && /\.app\/Contents\/MacOS\//.test(exe)) {
      const bundle = path.resolve(exe, '..', '..', '..');
      if (/\.app$/i.test(bundle)) return bundle;
    }
  } catch {}

  try {
    const appPath = app && typeof app.getAppPath === 'function' ? String(app.getAppPath() || '').trim() : '';
    const idx = appPath.toLowerCase().lastIndexOf('.app/contents/');
    if (idx !== -1) return appPath.slice(0, idx + 4);
  } catch {}

  return '';
}

function isDarwinTranslocated(appBundlePath) {
  const p = String(appBundlePath || '');
  return (
    p.includes('/AppTranslocation/') ||
    p.includes('/var/folders/') ||
    p.startsWith('/private/var/')
  );
}

function isDarwinDmgMountedPath(appBundlePath) {
  const p = String(appBundlePath || '');
  return p.startsWith('/Volumes/');
}

function isWritableDir(dirPath) {
  try {
    fs.accessSync(String(dirPath || ''), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function findDarwinInstalledApp(appName) {
  const name = String(appName || '').trim();
  if (!name) return '';

  const candidates = [];
  candidates.push(path.join('/Applications', `${name}.app`));
  try {
    const home = app && typeof app.getPath === 'function' ? String(app.getPath('home') || '').trim() : '';
    if (home) candidates.push(path.join(home, 'Applications', `${name}.app`));
  } catch {}

  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {}
  }
  return '';
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

function extractSystemdUnitName(output) {
  const s = String(output || '');
  const m = s.match(/Running as unit:\s*([^\s;]+)(?:;|\s|$)/i);
  if (m && m[1]) return String(m[1]).trim();
  return '';
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
  const installLogPath = path.join(updatesDir, 'update_install.log');
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
  await appendUpdateLog(
    installLogPath,
    `start platform=${process.platform} arch=${process.arch} version=${currentAppVersion() || 'n/a'} url=${u.toString()} target=${targetPath} label=${
      label ? String(label) : 'n/a'
    }`,
  );

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
    await appendUpdateLog(installLogPath, `downloaded path=${dl.path} size=${dl.sizeBytes} sha256=${dl.sha256Hex}`);

    // Quick check: we already verified during download, but keep payload consistent.
    if (expectedSha && dl.sha256Hex !== expectedSha) {
      notify({ stage: 'error', error: 'sha256_mismatch', label: label || null });
      await appendUpdateLog(installLogPath, 'error sha256_mismatch');
      return { ok: false, error: 'sha256_mismatch' };
    }

    notify({ stage: 'installing', path: dl.path, label: label || null });
    notify({ stage: 'launching_installer', path: dl.path, silent: !!silent, label: label || null });
    await appendUpdateLog(installLogPath, `installing path=${dl.path}`);

    if (process.platform === 'win32') {
      const launched = await launchInstaller(dl.path, { silent: !!silent });
      if (!launched || launched.ok === false) {
        const errMsg = String(launched?.error || 'installer_launch_failed');
        notify({ stage: 'error', error: errMsg, label: label || null });
        await appendUpdateLog(installLogPath, `error win32_installer_launch_failed err=${errMsg}`);
        return { ok: false, error: errMsg };
      }
    } else if (process.platform === 'linux') {
      await ensureExecutable(dl.path);

      const extraArgs = [];
      // For safety, always relaunch with --no-sandbox when running as root.
      // (Even if the current instance already had it, the relaunched process won't unless we pass it.)
      if (isRootUser() && !extraArgs.includes('--no-sandbox')) extraArgs.push('--no-sandbox');

      const relaunchLogPath = path.join(updatesDir, 'update_relaunch.log');
      await appendUpdateLog(
        relaunchLogPath,
        `linux_update start pid=${process.pid} isRoot=${isRootUser()} args=${extraArgs.join(' ') || 'n/a'} appImage=${
          String(process.env.APPIMAGE || '').trim() || 'n/a'
        } downloaded=${dl.path}`
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
      ].join('\n');

      const execDownloadedScript = [
        ...waitScriptPrelude,
        `src=${shQuote(src)}`,
        'chmod +x "$src" 2>/dev/null || true',
        `echo "[relaunch] exec src=$src" >>"$log" 2>&1 || true`,
        `exec "$src"${extraArgs.length ? ` ${extraArgs.map(shQuote).join(' ')}` : ''}`
      ].join('\n');

      const scriptToRun = canSwapInPlace ? swapAndExecScript : execDownloadedScript;

      let scheduled = false;

      // Desktop environments often launch apps in a transient systemd scope (app.slice/*.scope).
      // When the main process exits, systemd may kill remaining processes in that scope, including our helper.
      // To survive that cleanup, prefer scheduling the relaunch via systemd-run (separate unit).
      if (!isRootUser()) {
        const bin = pickSystemdRunBinary();
        const spawnEnv = buildSystemdRunSpawnEnv();
        const exportLines = collectPosixExportStatements(spawnEnv);
        const scriptWithExports = `${exportLines.join('\n')}\n${scriptToRun}`;

        const attempts = [
          { name: 'user-service', args: ['--user', '--expand-environment=no', '/bin/sh', '-c', scriptWithExports] },
          { name: 'user-service-legacy', args: ['--user', '/bin/sh', '-c', scriptWithExports] }
        ];

        for (const a of attempts) {
          const res = await runCommandForExit(bin, a.args, { timeoutMs: 4500, env: spawnEnv });
          if (res.ok) {
            scheduled = true;
            const unit = extractSystemdUnitName(`${res.stdout || ''}\n${res.stderr || ''}`);
            await appendUpdateLog(relaunchLogPath, `systemd-run scheduled via=${a.name}${unit ? ` unit=${unit}` : ''}`);
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
          const scriptWithExports = `${exportLines.join('\n')}\n${scriptToRun}`;

          const attempts = [
            { name: 'system-service', args: ['--expand-environment=no', '/bin/sh', '-c', scriptWithExports] },
            { name: 'system-service-legacy', args: ['/bin/sh', '-c', scriptWithExports] }
          ];

          for (const a of attempts) {
            const res = await runCommandForExit(bin, a.args, { timeoutMs: 4500, env: spawnEnv });
            if (res.ok) {
              scheduled = true;
              const unit = extractSystemdUnitName(`${res.stdout || ''}\n${res.stderr || ''}`);
              await appendUpdateLog(relaunchLogPath, `systemd-run scheduled via=${a.name}${unit ? ` unit=${unit}` : ''}`);
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
      const relaunchLogPath = path.join(updatesDir, 'update_relaunch.log');
      await appendUpdateLog(
        relaunchLogPath,
        `darwin_update start pid=${process.pid} exe=${String(process.execPath || '').trim() || 'n/a'} appPath=${
          (app && typeof app.getAppPath === 'function' ? String(app.getAppPath() || '') : '').trim() || 'n/a'
        } downloaded=${dl.path}`,
      );

      const appName = (() => {
        try {
          return app && typeof app.getName === 'function' ? String(app.getName() || '').trim() : '';
        } catch {
          return '';
        }
      })();

      let dstApp = detectDarwinAppBundlePath();
      if (
        !dstApp ||
        isDarwinTranslocated(dstApp) ||
        isDarwinDmgMountedPath(dstApp) ||
        !/\.app$/i.test(dstApp)
      ) {
        const found = findDarwinInstalledApp(appName || 'Lumen Browser');
        if (found) dstApp = found;
      }

      // If we still can't determine a reasonable destination, fall back to opening the DMG.
      if (!dstApp || !/\.app$/i.test(dstApp) || !isWritableDir(path.dirname(dstApp))) {
        if (dstApp && /\\.app$/i.test(dstApp)) {
          await appendUpdateLog(
            relaunchLogPath,
            `darwin_update dst_not_writable dst=${dstApp} dir=${path.dirname(dstApp)}`,
          );
        }
        await appendUpdateLog(relaunchLogPath, 'darwin_update dstApp_unavailable fallback=open_dmg');
        try {
          const err = await shell.openPath(dl.path);
          if (err) throw new Error(err);
          try { shell.showItemInFolder(dl.path); } catch {}
        } catch (e) {
          const msg = String(e && e.message ? e.message : e);
          notify({ stage: 'error', error: msg || 'open_failed', label: label || null });
          await appendUpdateLog(relaunchLogPath, `darwin_update open_dmg_failed err=${msg}`);
          return { ok: false, error: msg || 'open_failed' };
        }

        setTimeout(() => {
          try {
            app.quit();
          } catch {}
        }, 1500);
        return { ok: true };
      }

      const mountDir = path.join(updatesDir, `mnt-${Date.now()}`);
      const extraOpenArgs = [];
      const quotedExtraOpenArgs = extraOpenArgs.length ? ` --args ${extraOpenArgs.map(shQuote).join(' ')}` : '';

      const waitScriptPrelude = [
        `log=${shQuote(relaunchLogPath)}`,
        `pid=${process.pid}`,
        'echo "[relaunch] helper started (pid=$$) waiting for parent=$pid" >>"$log" 2>&1 || true',
        'deadline=$(date +%s 2>/dev/null || echo 0)',
        'deadline=$((deadline + 120))',
        'while kill -0 "$pid" 2>/dev/null; do',
        '  now=$(date +%s 2>/dev/null || echo 0)',
        '  if [ "$now" -ge "$deadline" ]; then echo "[relaunch] timeout waiting for parent" >>"$log" 2>&1 || true; break; fi',
        '  sleep 0.2',
        'done',
        'echo "[relaunch] parent exited, continuing" >>"$log" 2>&1 || true',
      ];

      const script = [
        ...waitScriptPrelude,
        `dmg=${shQuote(dl.path)}`,
        `mnt=${shQuote(mountDir)}`,
        `dst=${shQuote(dstApp)}`,
        'mkdir -p "$mnt" 2>/dev/null || true',
        'echo "[relaunch] mounting dmg=$dmg mnt=$mnt" >>"$log" 2>&1 || true',
        'hdiutil attach "$dmg" -nobrowse -noautoopen -noverify -mountpoint "$mnt" >>"$log" 2>&1 || { echo "[relaunch] hdiutil_attach_failed" >>"$log" 2>&1 || true; exit 1; }',
        'src="$(find "$mnt" -maxdepth 2 -name \'*.app\' -type d -print | head -n 1)"',
        'if [ -z "$src" ]; then echo "[relaunch] no_app_found_in_dmg" >>"$log" 2>&1 || true; hdiutil detach "$mnt" -quiet >/dev/null 2>&1 || true; exit 1; fi',
        'echo "[relaunch] found src=$src" >>"$log" 2>&1 || true',
        'ts=$(date +%s 2>/dev/null || echo 0)',
        'tmp="${dst}.new-$ts"',
        'bak="${dst}.bak-$ts"',
        'echo "[relaunch] copying to tmp=$tmp" >>"$log" 2>&1 || true',
        'rm -rf "$tmp" >>"$log" 2>&1 || true',
        'ditto "$src" "$tmp" >>"$log" 2>&1 || { echo "[relaunch] ditto_failed" >>"$log" 2>&1 || true; hdiutil detach "$mnt" -quiet >/dev/null 2>&1 || true; exit 1; }',
        'xattr -dr com.apple.quarantine "$tmp" >>"$log" 2>&1 || true',
        'if [ -d "$dst" ]; then echo "[relaunch] backing up existing dst=$dst to $bak" >>"$log" 2>&1 || true; mv "$dst" "$bak" >>"$log" 2>&1 || true; fi',
        'echo "[relaunch] swapping tmp into place" >>"$log" 2>&1 || true',
        'mv "$tmp" "$dst" >>"$log" 2>&1 || { echo "[relaunch] swap_failed" >>"$log" 2>&1 || true; if [ -d "$bak" ] && [ ! -d "$dst" ]; then mv "$bak" "$dst" >>"$log" 2>&1 || true; fi; hdiutil detach "$mnt" -quiet >/dev/null 2>&1 || true; exit 1; }',
        'hdiutil detach "$mnt" -quiet >>"$log" 2>&1 || hdiutil detach "$mnt" -force -quiet >>"$log" 2>&1 || true',
        'rmdir "$mnt" >/dev/null 2>&1 || true',
        'echo "[relaunch] relaunching" >>"$log" 2>&1 || true',
        `open -n "$dst"${quotedExtraOpenArgs} >>"$log" 2>&1 || { echo "[relaunch] open_failed" >>"$log" 2>&1 || true; exit 1; }`,
      ].join('\n');

      try {
        spawnDetached('sh', ['-c', script]);
        await appendUpdateLog(relaunchLogPath, `darwin_update scheduled helper dst=${dstApp} dmg=${dl.path} mnt=${mountDir}`);
      } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        await appendUpdateLog(relaunchLogPath, `darwin_update schedule_failed err=${msg}`);
        notify({ stage: 'error', error: msg || 'relaunch_failed', label: label || null });
        return { ok: false, error: msg || 'relaunch_failed' };
      }

      // Quit so we can swap files and relaunch cleanly.
      setTimeout(() => {
        try {
          app.quit();
        } catch {}
      }, 800);

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
    await appendUpdateLog(installLogPath, `error exception=${msg}`);
    return { ok: false, error: msg };
  }
}

module.exports = {
  downloadAndInstall
};
