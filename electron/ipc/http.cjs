const { URL } = require('node:url');
const { ipcMain } = require('electron');

async function httpGet(url, options = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, status: 0, error: 'unsupported_scheme' };
    }
  } catch (_e) {
    return { ok: false, status: 0, error: 'invalid_url' };
  }

  try {
    const controller = new AbortController();
    const timeoutMs =
      typeof options.timeout === 'number' && options.timeout > 0
        ? options.timeout
        : 60000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'GET',
      headers: options.headers || {},
      signal: controller.signal
    });
    clearTimeout(t);

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text().catch(() => '');
    let json = null;
    if (contentType.includes('application/json')) {
      try {
        json = JSON.parse(text);
      } catch (_e) {
        // ignore JSON parse error, caller can inspect raw text
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      text,
      json
    };
  } catch (e) {
    const isTimeout = e.name === 'AbortError' || String(e).includes('aborted');
    if (!isTimeout) {
      console.warn('[electron][http:get] error', e);
    }
    return {
      ok: false,
      status: 0,
      error: String(e && e.message ? e.message : e),
      timeout: isTimeout
    };
  }
}

async function httpHead(url, options = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, status: 0, error: 'unsupported_scheme' };
    }
  } catch (_e) {
    return { ok: false, status: 0, error: 'invalid_url' };
  }

  try {
    const controller = new AbortController();
    const timeoutMs =
      typeof options.timeout === 'number' && options.timeout > 0
        ? options.timeout
        : 30000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'HEAD',
      headers: options.headers || {},
      signal: controller.signal
    });
    clearTimeout(t);

    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries())
    };
  } catch (e) {
    const isTimeout = e.name === 'AbortError' || String(e).includes('aborted');
    if (!isTimeout) {
      console.warn('[electron][http:head] error', e);
    }
    return {
      ok: false,
      status: 0,
      error: String(e && e.message ? e.message : e),
      timeout: isTimeout
    };
  }
}

function registerHttpIpc() {
  ipcMain.handle('http:get', async (_evt, url, options) => {
    return httpGet(String(url || ''), options || {});
  });
  ipcMain.handle('http:head', async (_evt, url, options) => {
    return httpHead(String(url || ''), options || {});
  });
}

module.exports = {
  httpGet,
  httpHead,
  registerHttpIpc
};
