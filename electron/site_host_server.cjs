// Local HTTP front door that gives a domain-backed site a STABLE browser origin.
//
// Why this exists
// ---------------
// Browser storage (IndexedDB, localStorage, caches) is keyed by origin, and an
// origin is scheme+host+port. Sites are served today from the Kubo gateway as
// `<cid>.ipfs.localhost:8088`, so the host carries the CID: republish the site,
// get a new CID, get a new origin, and every byte the site had stored is gone.
// That is not a bug in Kubo - it is what content addressing means.
//
// A Lumen domain, on the other hand, is a stable name. So this server listens on
// loopback and serves each domain-backed site under `<domain>.localhost:<port>`,
// proxying the bytes straight from the gateway. The page receives exactly what it
// receives today; only the origin changes, and it never changes again.
//
// Consequence, deliberately: a site opened by bare CID gets no persistent
// storage, because it has no stable name to key it to. Publish under a domain if
// you want to keep data.
//
// The domain -> CID mapping is NOT resolved here. SitePage.vue already resolves
// it (DNS lookup, record parsing, gateway racing) and registers the result via
// `siteHost:register`, exactly like it already registers the domain identity for
// senderSiteContext. This server only ever consults that registry, so there is
// one resolution path in the app, not two.
const http = require('node:http');
const { getSettings, setSettings } = require('./settings.cjs');

/** Used only until a port has been pinned in settings. */
const DEFAULT_PORT = 8091;
/** A port can be held for a moment by an instance that is still shutting down. */
const BIND_RETRIES = 4;
const BIND_RETRY_DELAY_MS = 300;
/** Loopback only. Binding 0.0.0.0 would expose an IPFS proxy to the LAN. */
const BIND_HOST = '127.0.0.1';

/** host label (lowercase, no port) -> { proto, id, basePath } */
const registry = new Map();

let server = null;
let activePort = 0;

/** The pinned port, or the default until one has been recorded. */
function pinnedPort() {
  try {
    const value = Number(getSettings()?.siteHostPort);
    if (Number.isInteger(value) && value >= 1024 && value <= 65535) return value;
  } catch {
    // fall through
  }
  return DEFAULT_PORT;
}

/** Records the port so it survives a change of the built-in default. */
function rememberPort(port) {
  try {
    if (Number(getSettings()?.siteHostPort) === port) return;
    setSettings({ siteHostPort: port });
  } catch {
    // A settings write failure only means we retry the same default next boot.
  }
}

function gatewayBase() {
  try {
    const settings = getSettings();
    const configured = String(settings?.localGatewayBase || '').trim();
    if (configured) return configured.replace(/\/+$/, '');
  } catch {
    // fall through to the default below
  }
  return 'http://127.0.0.1:8088';
}

/** `monsite.lmn` -> `monsite.lmn.localhost`. */
function hostLabelFor(domainHost) {
  const host = String(domainHost || '').trim().toLowerCase();
  if (!host || !/^[a-z0-9.-]+$/.test(host)) return '';
  return `${host}.localhost`;
}

/**
 * Points a domain at the ipfs/ipns target currently backing it. Called again on
 * every republish, which is the whole point: the origin stays put while what it
 * serves moves.
 */
function registerSiteHost(domainHost, target) {
  const label = hostLabelFor(domainHost);
  const proto = String(target?.proto || '').toLowerCase();
  const id = String(target?.id || '').trim();
  if (!label || (proto !== 'ipfs' && proto !== 'ipns') || !id) return { ok: false, error: 'invalid_site_host' };
  if (!activePort) return { ok: false, error: 'site_host_server_unavailable' };

  registry.set(label, {
    proto,
    id,
    basePath: String(target?.basePath || '').replace(/\/+$/, '')
  });
  return { ok: true, origin: `http://${label}:${activePort}`, port: activePort };
}

function getSiteHostStatus() {
  return { ok: true, running: !!server, port: activePort, sites: registry.size };
}

/** Hop-by-hop headers must not be forwarded (RFC 7230 6.1). */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

function forwardableHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers || {})) {
    const k = key.toLowerCase();
    if (k === 'host' || HOP_BY_HOP.has(k)) continue;
    out[key] = value;
  }
  return out;
}

function handleRequest(req, res) {
  // The subdomain only ever reaches us in the Host header - *.localhost all
  // resolves to loopback, so every site lands on this one listener.
  const label = String(req.headers.host || '').toLowerCase().split(':')[0];
  const entry = registry.get(label);
  if (!entry) {
    // Strict allowlist: without it this would be an open proxy to any CID.
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Unknown Lumen site host');
    return;
  }

  let path = '/';
  try {
    path = new URL(req.url || '/', `http://${label}`).pathname || '/';
  } catch {
    path = '/';
  }
  const search = String(req.url || '').includes('?') ? String(req.url).slice(String(req.url).indexOf('?')) : '';

  // Path form against the loopback IP on purpose: Kubo only issues its
  // subdomain redirect for DNS-able hosts, so an IP literal serves directly and
  // a CIDv0 (which cannot be a DNS label) keeps working.
  const upstream = `${gatewayBase()}/${entry.proto}/${entry.id}${entry.basePath}${path}${search}`;

  let target;
  try {
    target = new URL(upstream);
  } catch {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Bad gateway target');
    return;
  }

  const proxied = http.request(
    {
      hostname: target.hostname,
      port: target.port || 80,
      path: target.pathname + target.search,
      method: req.method,
      headers: forwardableHeaders(req.headers)
    },
    (upstreamRes) => {
      // Status and headers are passed through untouched so Range/206,
      // Content-Type and caching behave exactly like a direct gateway hit -
      // without this, video and HLS break.
      const headers = {};
      for (const [key, value] of Object.entries(upstreamRes.headers || {})) {
        if (HOP_BY_HOP.has(key.toLowerCase())) continue;
        headers[key] = value;
      }
      res.writeHead(upstreamRes.statusCode || 502, headers);
      upstreamRes.pipe(res);
    }
  );

  proxied.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Gateway unreachable');
  });

  req.pipe(proxied);
}

function listenOn(port) {
  return new Promise((resolve) => {
    const candidate = http.createServer(handleRequest);
    candidate.once('error', () => {
      try {
        candidate.close();
      } catch {
        // already closing
      }
      resolve(null);
    });
    candidate.listen(port, BIND_HOST, () => resolve(candidate));
  });
}

/**
 * Idempotent. Binds the pinned port and only that port.
 *
 * The port is part of the origin a domain site is served from, so moving to a
 * different one would look to the browser like a different site and hand it an
 * empty IndexedDB. Falling back to a neighbouring port would therefore quietly
 * orphan exactly the data this server exists to protect. If the port cannot be
 * taken, we serve nothing: SitePage keeps using the gateway URL for this run,
 * and whatever the site stored stays where it is, readable again as soon as the
 * port is free.
 */
async function startSiteHostServer() {
  if (server) return activePort;

  const port = pinnedPort();
  for (let attempt = 0; attempt < BIND_RETRIES; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop -- retries are sequential by nature
    const started = await listenOn(port);
    if (started) {
      server = started;
      activePort = port;
      rememberPort(port);
      console.log(`[electron][site-host] listening on http://${BIND_HOST}:${port} (*.localhost)`);
      return port;
    }
    // eslint-disable-next-line no-await-in-loop -- deliberate backoff between attempts
    await new Promise((resolve) => setTimeout(resolve, BIND_RETRY_DELAY_MS));
  }

  console.warn(
    `[electron][site-host] port ${port} is busy; domain sites fall back to the CID origin this run ` +
      '(their stored data is not lost, just unreachable until the port frees up)'
  );
  return 0;
}

function stopSiteHostServer() {
  if (!server) return;
  try {
    server.close();
  } catch {
    // ignore
  }
  server = null;
  activePort = 0;
  registry.clear();
}

module.exports = {
  startSiteHostServer,
  stopSiteHostServer,
  registerSiteHost,
  getSiteHostStatus
};
