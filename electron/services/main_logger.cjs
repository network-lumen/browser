const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const util = require('util');

const LOG_FILE_NAME = 'electron-main.log';
const MAX_LOG_BYTES = 8 * 1024 * 1024;
const TRIM_TO_BYTES = 2 * 1024 * 1024;

let initialized = false;
let logFilePath = '';
let originalConsole = null;
let writeInProgress = false;
let lastTrimAt = 0;

function ensureLogsDir() {
  const preferred = (() => {
    try {
      const p = String(app.getPath('logs') || '').trim();
      if (p) return p;
    } catch {}
    try {
      const p = path.join(app.getPath('userData'), 'logs');
      if (p) return p;
    } catch {}
    return path.join(process.cwd(), 'logs');
  })();

  try {
    fs.mkdirSync(preferred, { recursive: true });
  } catch {}
  return preferred;
}

function getMainLogFilePath() {
  return path.join(ensureLogsDir(), LOG_FILE_NAME);
}

function formatValue(value) {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') return value;
  return util.inspect(value, {
    depth: 5,
    colors: false,
    compact: false,
    breakLength: 120,
    maxArrayLength: 100,
    maxStringLength: 20_000
  });
}

function normalizeMessage(args) {
  const parts = Array.isArray(args) ? args.map(formatValue) : [];
  const message = parts.join(' ').replace(/\u0000/g, '');
  if (!message) return '(empty log message)';
  return message
    .split(/\r?\n/)
    .map((line, index) => (index === 0 ? line : `    ${line}`))
    .join('\n');
}

function trimLogFileIfNeeded(force = false) {
  if (!logFilePath) return;
  const now = Date.now();
  if (!force && now - lastTrimAt < 5000) return;
  lastTrimAt = now;

  try {
    const stat = fs.statSync(logFilePath);
    if (!stat.isFile() || stat.size <= MAX_LOG_BYTES) return;

    const bytesToRead = Math.min(TRIM_TO_BYTES, stat.size);
    const buffer = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(logFilePath, 'r');
    try {
      fs.readSync(fd, buffer, 0, bytesToRead, stat.size - bytesToRead);
    } finally {
      fs.closeSync(fd);
    }

    let tail = buffer.toString('utf8');
    const firstNewline = tail.indexOf('\n');
    if (firstNewline >= 0) {
      tail = tail.slice(firstNewline + 1);
    }

    const header = `[${new Date().toISOString()}] [${process.pid}] [WARN] Log file trimmed after exceeding ${MAX_LOG_BYTES} bytes.\n`;
    fs.writeFileSync(logFilePath, header + tail, 'utf8');
  } catch {}
}

function appendLog(level, args) {
  if (!logFilePath || writeInProgress) return;
  writeInProgress = true;
  try {
    trimLogFileIfNeeded(false);
    const line = `[${new Date().toISOString()}] [${process.pid}] [${String(level || 'info').toUpperCase()}] ${normalizeMessage(args)}\n`;
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch {
    // ignore logging failures
  } finally {
    writeInProgress = false;
  }
}

function installConsoleProxy() {
  if (originalConsole) return;
  originalConsole = {
    log: typeof console.log === 'function' ? console.log.bind(console) : () => {},
    info: typeof console.info === 'function' ? console.info.bind(console) : () => {},
    warn: typeof console.warn === 'function' ? console.warn.bind(console) : () => {},
    error: typeof console.error === 'function' ? console.error.bind(console) : () => {},
    debug: typeof console.debug === 'function' ? console.debug.bind(console) : () => {}
  };

  console.log = (...args) => {
    appendLog('info', args);
    originalConsole.log(...args);
  };
  console.info = (...args) => {
    appendLog('info', args);
    originalConsole.info(...args);
  };
  console.warn = (...args) => {
    appendLog('warn', args);
    originalConsole.warn(...args);
  };
  console.error = (...args) => {
    appendLog('error', args);
    originalConsole.error(...args);
  };
  console.debug = (...args) => {
    appendLog('debug', args);
    originalConsole.debug(...args);
  };
}

function installProcessHandlers() {
  try {
    process.on('warning', (warning) => {
      appendLog('warn', ['[process][warning]', warning]);
    });
  } catch {}

  try {
    process.on('unhandledRejection', (reason) => {
      appendLog('error', ['[process][unhandledRejection]', reason]);
    });
  } catch {}

  try {
    process.on('uncaughtExceptionMonitor', (error, origin) => {
      appendLog('error', ['[process][uncaughtException]', { origin: String(origin || '') }, error]);
    });
  } catch {}
}

function initializeMainLogger() {
  if (initialized) return { ok: true, path: logFilePath || getMainLogFilePath() };
  logFilePath = getMainLogFilePath();

  try {
    if (!fs.existsSync(logFilePath)) {
      fs.writeFileSync(logFilePath, '', 'utf8');
    }
  } catch {}

  trimLogFileIfNeeded(true);
  installConsoleProxy();
  installProcessHandlers();
  initialized = true;

  appendLog('info', ['[logger] initialized', { path: logFilePath }]);
  return { ok: true, path: logFilePath };
}

module.exports = {
  initializeMainLogger,
  getMainLogFilePath
};
