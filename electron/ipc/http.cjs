const { URL } = require('node:url');
const { ipcMain } = require('electron');

function normalizeHeaders(h) {
  return h && typeof h === 'object' ? { ...h } : {};
}

function rewriteLocalhostSubdomain(url, headers) {
  try {
    const u = new URL(String(url || ''));
    const host = String(u.hostname || '').trim();
    if (!host) return { url: String(url || ''), headers };

    const lower = host.toLowerCase();

    // Browsers treat *.localhost as loopback, but Node/undici does not always resolve it.
    // Instead of relying on a custom Host header (often restricted), convert subdomain gateway
    // URLs to path-style gateway URLs which always resolve locally.
    //
    //   http://<cid>.ipfs.localhost:8080/path  -> http://127.0.0.1:8080/ipfs/<cid>/path
    //   http://<name>.ipns.localhost:8080/path -> http://127.0.0.1:8080/ipns/<name>/path
    const m = lower.match(/^([a-z0-9]+)\.(ipfs|ipns)\.localhost$/i);
    if (m && m[1] && m[2]) {
      const id = String(m[1] || '').trim();
      const kind = String(m[2] || '').trim().toLowerCase();
      if (!id || (kind !== 'ipfs' && kind !== 'ipns')) return { url: String(url || ''), headers };

      const path = String(u.pathname || '/');
      const rest = path.startsWith('/') ? path : '/' + path;
      u.hostname = '127.0.0.1';
      u.pathname = `/${kind}/${id}${rest}`;
      return { url: u.toString(), headers: normalizeHeaders(headers) };
    }

    return { url: String(url || ''), headers };
  } catch {
    return { url: String(url || ''), headers };
  }
}

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
    const rewritten = rewriteLocalhostSubdomain(url, options.headers);
    const res = await fetch(rewritten.url, {
      method: 'GET',
      headers: rewritten.headers || {},
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
    const isDnsError = e.cause && (e.cause.code === 'ENOTFOUND' || e.cause.code === 'EAI_AGAIN');
    
    // Only log non-timeout and non-DNS errors
    if (!isTimeout && !isDnsError) {
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

async function httpGetBytes(url, options = {}) {
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
    const rewritten = rewriteLocalhostSubdomain(url, options.headers);
    const res = await fetch(rewritten.url, {
      method: 'GET',
      headers: rewritten.headers || {},
      signal: controller.signal
    });
    clearTimeout(t);

    const buf = await res.arrayBuffer().catch(() => null);
    const bytes = buf ? Buffer.from(buf) : Buffer.alloc(0);

    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      dataB64: bytes.toString('base64')
    };
  } catch (e) {
    const isTimeout = e.name === 'AbortError' || String(e).includes('aborted');
    const isDnsError = e.cause && (e.cause.code === 'ENOTFOUND' || e.cause.code === 'EAI_AGAIN');
    
    // Only log non-timeout and non-DNS errors
    if (!isTimeout && !isDnsError) {
      console.warn('[electron][http:getBytes] error', e);
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
    const rewritten = rewriteLocalhostSubdomain(url, options.headers);
    const res = await fetch(rewritten.url, {
      method: 'HEAD',
      headers: rewritten.headers || {},
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
  ipcMain.handle('http:getBytes', async (_evt, url, options) => {
    return httpGetBytes(String(url || ''), options || {});
  });
  ipcMain.handle('http:head', async (_evt, url, options) => {
    return httpHead(String(url || ''), options || {});
  });
}

module.exports = {
  httpGet,
  httpGetBytes,
  httpHead,
  registerHttpIpc
};
