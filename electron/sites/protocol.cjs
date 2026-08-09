// Serves domain-backed sites under a real `lumen://<domain>` origin.
//
// Why a custom scheme
// -------------------
// Browser storage is keyed by origin, and an origin is scheme+host+port. Served
// from the Kubo gateway, a site's host carries its CID, so republishing it hands
// the site a brand new origin and an empty IndexedDB. Serving it over a local
// HTTP proxy fixes the host but not the port: the port is part of the origin
// too, so it has to be pinned, reserved, and defended against whatever else on
// the machine might want it.
//
// A custom scheme has no port at all. `lumen://monsite.lmn` is the origin, it
// is derived from a name the user owns, and nothing can take it. It is also the
// address the user already sees in the address bar, so what a developer debugs
// is what the browser actually loaded.
//
// Deliberately unsolved: a site opened by bare CID still gets no persistent
// storage. It has no stable name, so there is nothing honest to key storage to.
//
// The domain -> CID mapping is NOT resolved here. SitePage.vue already does the
// DNS lookup, record parsing and gateway racing, and registers the outcome; this
// module only consults that registry, so the app keeps one resolution path.
const { protocol, net } = require('electron');
const { getSettings } = require('../settings.cjs');

const SCHEME = 'lumen';

/** host (lowercase) -> { proto, id, basePath } */
const registry = new Map();

function gatewayBase() {
  try {
    const configured = String(getSettings()?.localGatewayBase || '').trim();
    if (configured) return configured.replace(/\/+$/, '');
  } catch {
    // fall through to the default below
  }
  return 'http://127.0.0.1:8088';
}

/**
 * Must run before app 'ready'.
 *
 * `standard` gives the scheme real origin semantics (host, relative URL
 * resolution, per-origin storage) instead of being treated as opaque; `secure`
 * puts it in a secure context, which IndexedDB, crypto.subtle and service
 * workers all require; `stream` is what lets a Range response be piped through
 * rather than buffered, so media keeps working.
 */
function registerSiteSchemePrivileges() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ]);
}

/** `monsite.lmn` -> a usable origin host, or '' when it could not be one. */
function normalizeHost(domainHost) {
  const host = String(domainHost || '').trim().toLowerCase();
  if (!host || !/^[a-z0-9.-]+$/.test(host)) return '';
  return host;
}

/**
 * Points a domain at the ipfs/ipns target currently behind it. Called again on
 * every republish - that is the point: the origin stays put while what it serves
 * moves underneath.
 */
function registerSiteHost(domainHost, target) {
  const host = normalizeHost(domainHost);
  const proto = String(target?.proto || '').toLowerCase();
  const id = String(target?.id || '').trim();
  if (!host || (proto !== 'ipfs' && proto !== 'ipns') || !id) {
    return { ok: false, error: 'invalid_site_host' };
  }

  registry.set(host, {
    proto,
    id,
    basePath: String(target?.basePath || '').replace(/\/+$/, '')
  });
  return { ok: true, origin: `${SCHEME}://${host}` };
}

function getSiteHostStatus() {
  return { ok: true, scheme: SCHEME, sites: registry.size };
}

/**
 * Installs the handler on a session. Sites live in the webview partition, so
 * that is the session that needs it.
 */
function installSiteProtocol(ses) {
  if (!ses?.protocol?.handle) return false;

  ses.protocol.handle(SCHEME, async (request) => {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const entry = registry.get(String(url.hostname || '').toLowerCase());
    if (!entry) {
      // Strict allowlist. It also keeps the app's own internal addresses
      // (lumen://home, lumen://ipfs/<cid>, ...) from ever being answered here:
      // those are routes the renderer handles, not sites.
      return new Response('Unknown Lumen site', { status: 404 });
    }

    const upstream = `${gatewayBase()}/${entry.proto}/${entry.id}${entry.basePath}${url.pathname}${url.search}`;

    try {
      // The upstream Response is returned as-is so status, Content-Type and
      // Range/206 survive untouched, and the body streams instead of buffering.
      return await net.fetch(upstream, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        duplex: 'half',
        // Without this the gateway request could be routed back through a
        // custom protocol handler instead of the network.
        bypassCustomProtocolHandlers: true
      });
    } catch {
      return new Response('Gateway unreachable', { status: 502 });
    }
  });

  return true;
}

module.exports = {
  SCHEME,
  registerSiteSchemePrivileges,
  installSiteProtocol,
  registerSiteHost,
  getSiteHostStatus
};
