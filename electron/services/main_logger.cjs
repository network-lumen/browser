const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const util = require('util');

const LOG_FILE_NAME = 'electron-main.log';
/**
 * Errors, and only errors, also go to their own file.
 *
 * Everything used to land in one 8 MB log with the console proxy pouring
 * `[INFO]` into it - IPFS status polls, gateway probes, extension traces - so
 * the one crash worth reading was somewhere inside it. This file holds what a
 * bug report actually needs, from both processes, and stays small enough to
 * paste.
 */
const ERROR_LOG_FILE_NAME = 'errors.log';
const MAX_LOG_BYTES = 8 * 1024 * 1024;
const TRIM_TO_BYTES = 2 * 1024 * 1024;
/** Smaller, because it only ever holds errors and is meant to be read whole. */
const MAX_ERROR_LOG_BYTES = 1024 * 1024;
const TRIM_ERROR_LOG_TO_BYTES = 256 * 1024;

let initialized = false;
let logFilePath = '';
let errorLogFilePath = '';
let originalConsole = null;
let writeInProgress = false;
const lastTrimAt = new Map();

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

function getErrorLogFilePath() {
  return path.join(ensureLogsDir(), ERROR_LOG_FILE_NAME);
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

function trimLogFileIfNeeded(filePath, maxBytes, trimToBytes, force = false) {
  if (!filePath) return;
  const now = Date.now();
  if (!force && now - (lastTrimAt.get(filePath) || 0) < 5000) return;
  lastTrimAt.set(filePath, now);

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= maxBytes) return;

    const bytesToRead = Math.min(trimToBytes, stat.size);
    const buffer = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(filePath, 'r');
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

    const header = `[${new Date().toISOString()}] [${process.pid}] [WARN] Log file trimmed after exceeding ${maxBytes} bytes.\n`;
    fs.writeFileSync(filePath, header + tail, 'utf8');
  } catch {}
}

function appendLog(level, args) {
  if (!logFilePath || writeInProgress) return;
  // One guard for both files: a failure while writing must not re-enter
  // through the console proxy and write again.
  writeInProgress = true;
  try {
    const normalized = String(level || 'info').toUpperCase();
    const line = `[${new Date().toISOString()}] [${process.pid}] [${normalized}] ${normalizeMessage(args)}\n`;

    trimLogFileIfNeeded(logFilePath, MAX_LOG_BYTES, TRIM_TO_BYTES);
    fs.appendFileSync(logFilePath, line, 'utf8');

    if (normalized === 'ERROR' && errorLogFilePath) {
      trimLogFileIfNeeded(errorLogFilePath, MAX_ERROR_LOG_BYTES, TRIM_ERROR_LOG_TO_BYTES);
      fs.appendFileSync(errorLogFilePath, line, 'utf8');
    }
  } catch {} 
  finally {
    writeInProgress = false;
  }
}

/**
 * An error the renderer could not handle itself.
 *
 * Kept separate from `appendLog` so the caller cannot choose a level: whatever
 * arrives here is an error by definition, and labelling it otherwise would
 * keep it out of the file this exists to fill.
 */
function appendRendererError(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  appendLog('error', [
    '[renderer]',
    {
      kind: String(data.kind || 'error'),
      message: String(data.message || ''),
      source: String(data.source || ''),
      line: Number(data.line) || 0,
      column: Number(data.column) || 0,
      url: String(data.url || '')
    },
    String(data.stack || '(no stack)')
  ]);
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
  errorLogFilePath = getErrorLogFilePath();

  for (const file of [logFilePath, errorLogFilePath]) {
    try {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '', 'utf8');
      }
    } catch {}
  }

  trimLogFileIfNeeded(logFilePath, MAX_LOG_BYTES, TRIM_TO_BYTES, true);
  trimLogFileIfNeeded(errorLogFilePath, MAX_ERROR_LOG_BYTES, TRIM_ERROR_LOG_TO_BYTES, true);
  installConsoleProxy();
  installProcessHandlers();
  initialized = true;

  appendLog('info', ['[logger] initialized', { path: logFilePath, errors: errorLogFilePath }]);
  return { ok: true, path: logFilePath };
}

module.exports = {
  initializeMainLogger,
  getMainLogFilePath,
  getErrorLogFilePath,
  appendRendererError
};
