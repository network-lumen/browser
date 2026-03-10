const { ipcMain, app, clipboard, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getSettings,
  getSecurityStatus,
  loadGateways,
  loadPrivateCloudConfig
} = require('../settings.cjs');
const { getGatewayServerStatus, getGatewayDataDir } = require('../gateway-server.cjs');
const { checkIpfsStatus, ipfsStats, ipfsSwarmPeers } = require('../ipfs.cjs');

const LOGS_DIRNAME = 'logs';
const REPORT_FILENAME = 'debug-report.txt';
const MAX_LOG_TAIL_LINES = 200;
const MAX_LOG_TAIL_CHARS = 40_000;

function safeString(value, maxLen = 4096) {
  const out = String(value ?? '').trim();
  if (!out) return '';
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
}

function getUserDataDir() {
  return app.getPath('userData');
}

function getLogsDir() {
  try {
    const p = String(app.getPath('logs') || '').trim();
    if (p) return p;
  } catch {}
  return path.join(getUserDataDir(), LOGS_DIRNAME);
}

function getReportPath() {
  return path.join(getLogsDir(), REPORT_FILENAME);
}

function readJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function fileMeta(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      exists: true,
      type: stat.isDirectory() ? 'dir' : 'file',
      sizeBytes: Number(stat.size || 0),
      modifiedAt: stat.mtime instanceof Date ? stat.mtime.toISOString() : ''
    };
  } catch {
    return {
      exists: false,
      type: 'missing',
      sizeBytes: 0,
      modifiedAt: ''
    };
  }
}

function formatBytes(sizeBytes) {
  const n = Number(sizeBytes);
  if (!Number.isFinite(n) || n < 0) return 'unknown';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isoValue(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    try {
      return new Date(input).toISOString();
    } catch {
      return '';
    }
  }
  const s = safeString(input, 256);
  if (!s) return '';
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return s;
  try {
    return new Date(ms).toISOString();
  } catch {
    return s;
  }
}

function tailText(rawText) {
  let text = String(rawText || '').replace(/\u0000/g, '');
  if (!text) return '(empty file)';
  if (text.length > MAX_LOG_TAIL_CHARS) {
    text = text.slice(-MAX_LOG_TAIL_CHARS);
  }
  const allLines = text.split(/\r?\n/);
  if (allLines.length > MAX_LOG_TAIL_LINES) {
    const omitted = allLines.length - MAX_LOG_TAIL_LINES;
    text = `[... ${omitted} earlier lines omitted ...]\n${allLines.slice(-MAX_LOG_TAIL_LINES).join('\n')}`;
  }
  return text.trim() || '(empty file)';
}

function readLogTail(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return tailText(raw);
  } catch (error) {
    return `(unable to read file: ${safeString(error && error.message ? error.message : error, 512) || 'unknown_error'})`;
  }
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify(
      {
        error: safeString(error && error.message ? error.message : error, 512) || 'json_stringify_failed'
      },
      null,
      2
    );
  }
}

function describeFile(label, filePath) {
  const meta = fileMeta(filePath);
  if (!meta.exists) return `${label}: missing (${filePath})`;
  return `${label}: ${meta.type}, ${formatBytes(meta.sizeBytes)}, modified ${meta.modifiedAt || 'unknown'}, path ${filePath}`;
}

function getSafeSupportFiles() {
  const userDataDir = getUserDataDir();
  const logsDir = getLogsDir();
  const files = [
    {
      label: 'Electron main log',
      sourcePath: path.join(logsDir, 'electron-main.log'),
      copyAs: 'electron-main.log'
    },
    {
      label: 'Startup health',
      sourcePath: path.join(userDataDir, 'startup_health.json'),
      copyAs: 'startup_health.json'
    }
  ];

  const updatesDir = path.join(userDataDir, 'updates');
  try {
    const entries = fs.readdirSync(updatesDir, { withFileTypes: true });
    entries
      .filter((entry) => entry && entry.isFile() && /\.log$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        files.push({
          label: `Update log: ${entry.name}`,
          sourcePath: path.join(updatesDir, entry.name),
          copyAs: entry.name
        });
      });
  } catch {}

  return files;
}

function copySupportArtifacts(logsDir) {
  const files = getSafeSupportFiles();
  return files.map((file) => {
    const meta = fileMeta(file.sourcePath);
    const out = {
      label: file.label,
      sourcePath: file.sourcePath,
      bundlePath: '',
      exists: meta.exists,
      type: meta.type,
      sizeBytes: meta.sizeBytes,
      modifiedAt: meta.modifiedAt,
      copyError: '',
      tail: ''
    };

    if (!meta.exists || meta.type !== 'file') return out;

    out.bundlePath = path.join(logsDir, file.copyAs);
    out.tail = readLogTail(file.sourcePath);

    try {
      if (path.resolve(file.sourcePath) !== path.resolve(out.bundlePath)) {
        fs.copyFileSync(file.sourcePath, out.bundlePath);
      }
    } catch (error) {
      out.copyError = safeString(error && error.message ? error.message : error, 512) || 'copy_failed';
    }

    return out;
  });
}

function sanitizeSettings(settings) {
  const src = settings && typeof settings === 'object' ? settings : {};
  return {
    localGatewayBase: safeString(src.localGatewayBase, 1024),
    ipfsApiBase: safeString(src.ipfsApiBase, 1024),
    showSexualContent: !!src.showSexualContent,
    showViolentContent: !!src.showViolentContent,
    showDisturbingImagery: !!src.showDisturbingImagery,
    securityPasswordEnabled: !!src.securityPasswordEnabled
  };
}

function sanitizeGateways(gateways) {
  const list = Array.isArray(gateways) ? gateways : [];
  return list.map((gateway) => ({
    id: safeString(gateway && gateway.id, 128),
    name: safeString(gateway && gateway.name, 128),
    url: safeString(gateway && gateway.url, 1024),
    status: safeString((gateway && gateway.status) || 'unknown', 64),
    hasApiKey: !!safeString(gateway && gateway.apiKey, 64),
    ownerPresent: !!safeString(gateway && gateway.owner, 64),
    createdAt: isoValue(gateway && gateway.createdAt),
    updatedAt: isoValue(gateway && gateway.updatedAt)
  }));
}

function getProfilesSummary(userDataDir) {
  const data = readJsonFile(path.join(userDataDir, 'profiles.json'), { profiles: [], activeId: '' }) || {};
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];

  let keystoreCount = 0;
  for (const profile of profiles) {
    const id = safeString(profile && profile.id, 128);
    if (!id) continue;
    if (fileMeta(path.join(userDataDir, 'profiles', id, 'keystore.json')).exists) {
      keystoreCount += 1;
    }
  }

  return {
    profileCount: profiles.length,
    activeProfileConfigured: !!safeString(data.activeId, 128),
    keystoreCount,
    profilesDirPresent: fileMeta(path.join(userDataDir, 'profiles')).exists,
    pqcKeysPresent: fileMeta(path.join(userDataDir, 'pqc_keys', 'keys.json')).exists
  };
}

function getRuntimeSummary() {
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  })();

  const locale = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale || '';
    } catch {
      return '';
    }
  })();

  const osVersion = typeof os.version === 'function' ? safeString(os.version(), 256) : '';
  const isRoot = (() => {
    try {
      return typeof process.getuid === 'function' && process.getuid() === 0;
    } catch {
      return false;
    }
  })();

  return {
    appName: safeString(app.getName(), 128),
    appVersion: safeString(app.getVersion(), 128),
    isPackaged: !!app.isPackaged,
    platform: safeString(process.platform, 64),
    arch: safeString(process.arch, 64),
    osRelease: safeString(os.release(), 128),
    osVersion,
    locale,
    timeZone,
    cpuCount: Array.isArray(os.cpus()) ? os.cpus().length : 0,
    totalMemory: formatBytes(os.totalmem()),
    freeMemory: formatBytes(os.freemem()),
    nodeVersion: safeString(process.versions && process.versions.node, 64),
    electronVersion: safeString(process.versions && process.versions.electron, 64),
    chromeVersion: safeString(process.versions && process.versions.chrome, 64),
    v8Version: safeString(process.versions && process.versions.v8, 64),
    execPath: safeString(process.execPath, 2048),
    isRoot,
    hasSessionBus: !!safeString(process.env.DBUS_SESSION_BUS_ADDRESS, 32),
    hasRuntimeDir: !!safeString(process.env.XDG_RUNTIME_DIR, 32),
    gtkUsePortal: safeString(process.env.GTK_USE_PORTAL, 64) || '(unset)',
    releaseChannel: safeString(process.env.LUMEN_RELEASE_CHANNEL, 64) || '(default)',
    releaseKind: safeString(process.env.LUMEN_RELEASE_KIND, 64) || '(default)',
    releasePlatform: safeString(process.env.LUMEN_RELEASE_PLATFORM, 64) || '(default)',
    debugElectron: safeString(process.env.DEBUG_LUMEN_ELECTRON, 64) || '(unset)',
    debugRelease: safeString(process.env.DEBUG_LUMEN_RELEASE, 64) || '(unset)'
  };
}

async function withTimeout(label, promiseLike, timeoutMs) {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve(promiseLike).catch((error) => ({
        ok: false,
        error: safeString(error && error.message ? error.message : error, 512) || `${label}_failed`
      })),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({ ok: false, error: `${label}_timeout_after_${timeoutMs}ms` });
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildReport(input) {
  const sections = [];

  sections.push(
    [
      '# Lumen Debug Report',
      `Generated at: ${input.generatedAt}`,
      `Logs folder: ${input.logsDir}`,
      '',
      'Passwords, password hashes, API keys and private key material are intentionally excluded.',
      ''
    ].join('\n')
  );

  sections.push(
    [
      '## App',
      safeJson(input.runtime)
    ].join('\n\n')
  );

  sections.push(
    [
      '## Paths',
      safeJson(input.paths)
    ].join('\n\n')
  );

  sections.push(
    [
      '## Settings',
      safeJson(input.settings)
    ].join('\n\n')
  );

  sections.push(
    [
      '## Security',
      safeJson(input.security)
    ].join('\n\n')
  );

  sections.push(
    [
      '## Private Cloud',
      safeJson(input.privateCloud)
    ].join('\n\n')
  );

  sections.push(
    [
      '## Gateway Summary',
      safeJson({
        configuredGatewayCount: input.gateways.length,
        gateways: input.gateways
      })
    ].join('\n\n')
  );

  sections.push(
    [
      '## Profiles',
      safeJson(input.profiles)
    ].join('\n\n')
  );

  sections.push(
    [
      '## Embedded Services',
      safeJson(input.services)
    ].join('\n\n')
  );

  sections.push(
    [
      '## File Inventory',
      input.fileInventory.join('\n')
    ].join('\n\n')
  );

  if (input.artifacts.length) {
    const logSections = ['## Recent Log Excerpts'];
    for (const artifact of input.artifacts) {
      logSections.push('');
      logSections.push(`### ${artifact.label}`);
      logSections.push(`Source: ${artifact.sourcePath}`);
      logSections.push(`Copied to: ${artifact.bundlePath || '(not copied)'}`);
      logSections.push(`Exists: ${artifact.exists ? 'yes' : 'no'}`);
      if (artifact.exists) {
        logSections.push(`Size: ${formatBytes(artifact.sizeBytes)}`);
        logSections.push(`Modified: ${artifact.modifiedAt || 'unknown'}`);
      }
      if (artifact.copyError) {
        logSections.push(`Copy error: ${artifact.copyError}`);
      }
      logSections.push('');
      logSections.push(artifact.tail || '(no excerpt available)');
    }
    sections.push(logSections.join('\n'));
  } else {
    sections.push('## Recent Log Excerpts\n\nNo safe log files were found.');
  }

  return sections.join('\n\n').trim() + '\n';
}

async function prepareDebugBundle() {
  const userDataDir = getUserDataDir();
  const logsDir = getLogsDir();
  ensureDir(logsDir);

  const runtime = getRuntimeSummary();
  const settings = sanitizeSettings(getSettings());
  const security = getSecurityStatus();
  const privateCloud = loadPrivateCloudConfig();
  const gateways = sanitizeGateways(loadGateways());
  const profiles = getProfilesSummary(userDataDir);
  const gatewayServerStatus = getGatewayServerStatus();
  const gatewayDataDir = getGatewayDataDir();

  const ipfsStatus = await withTimeout('ipfsStatus', checkIpfsStatus(1, 0), 3500);
  const ipfsRepoStats = ipfsStatus && ipfsStatus.ok
    ? await withTimeout('ipfsStats', ipfsStats(), 2500)
    : { ok: false, error: 'skipped_because_ipfs_is_unavailable' };
  const ipfsSwarm = ipfsStatus && ipfsStatus.ok
    ? await withTimeout('ipfsSwarmPeers', ipfsSwarmPeers(), 2500)
    : { ok: false, error: 'skipped_because_ipfs_is_unavailable' };

  const artifacts = copySupportArtifacts(logsDir);

  const paths = {
    userData: userDataDir,
    logsDir,
    reportPath: getReportPath(),
    updatesDir: path.join(userDataDir, 'updates'),
    ipfsRepo: path.join(userDataDir, 'ipfs'),
    gatewayDataDir
  };

  const services = {
    ipfsStatus,
    ipfsRepoStats,
    ipfsSwarm: ipfsSwarm && ipfsSwarm.ok
      ? { ok: true, peerCount: Array.isArray(ipfsSwarm.peers) ? ipfsSwarm.peers.length : 0 }
      : ipfsSwarm,
    gatewayServer: {
      ...gatewayServerStatus,
      apiKeyFilePresent: fileMeta(path.join(gatewayDataDir, 'api-key.txt')).exists,
      databasePresent: fileMeta(path.join(gatewayDataDir, 'gateway.db')).exists
    }
  };

  const fileInventory = [
    describeFile('Logs directory', logsDir),
    describeFile('Electron main log', path.join(logsDir, 'electron-main.log')),
    describeFile('Settings file', path.join(userDataDir, 'settings.json')),
    describeFile('Gateways file', path.join(userDataDir, 'gateways.json')),
    describeFile('Private cloud config', path.join(userDataDir, 'private-cloud.json')),
    describeFile('Profiles file', path.join(userDataDir, 'profiles.json')),
    describeFile('Profiles directory', path.join(userDataDir, 'profiles')),
    describeFile('PQC keys file', path.join(userDataDir, 'pqc_keys', 'keys.json')),
    describeFile('Startup health file', path.join(userDataDir, 'startup_health.json')),
    describeFile('Updates directory', path.join(userDataDir, 'updates')),
    describeFile('IPFS repo config', path.join(userDataDir, 'ipfs', 'config')),
    describeFile('Gateway API key file', path.join(gatewayDataDir, 'api-key.txt')),
    describeFile('Gateway database', path.join(gatewayDataDir, 'gateway.db'))
  ];

  const report = buildReport({
    generatedAt: new Date().toISOString(),
    logsDir,
    runtime,
    paths,
    settings,
    security,
    privateCloud,
    gateways,
    profiles,
    services,
    fileInventory,
    artifacts
  });

  fs.writeFileSync(getReportPath(), report, 'utf8');

  return {
    ok: true,
    dir: logsDir,
    reportPath: getReportPath(),
    report,
    copiedFiles: artifacts.filter((artifact) => artifact.bundlePath).map((artifact) => artifact.bundlePath)
  };
}

function registerTroubleshootingIpc() {
  ipcMain.handle('troubleshooting:copyDebugReport', async () => {
    try {
      const bundle = await prepareDebugBundle();
      clipboard.writeText(bundle.report || '');
      return bundle;
    } catch (error) {
      return { ok: false, error: safeString(error && error.message ? error.message : error, 512) || 'copy_debug_report_failed' };
    }
  });

  ipcMain.handle('troubleshooting:openLogsFolder', async () => {
    try {
      const bundle = await prepareDebugBundle();
      const openError = await shell.openPath(bundle.dir);
      if (openError) {
        return {
          ok: false,
          error: safeString(openError, 512) || 'open_logs_folder_failed',
          dir: bundle.dir,
          reportPath: bundle.reportPath
        };
      }
      return bundle;
    } catch (error) {
      return { ok: false, error: safeString(error && error.message ? error.message : error, 512) || 'open_logs_folder_failed' };
    }
  });
}

module.exports = {
  registerTroubleshootingIpc
};
