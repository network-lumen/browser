const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('../utils/fs.cjs');

/**
 * Which site owns an IPNS key name.
 *
 * `window.lumen.ipfsPublishToIPNS(cid, key)` takes the key name from the page,
 * and the key lives on the one local Kubo node shared by every site. Nothing
 * tied a name to a caller, so any site could publish any CID under any name
 * that already existed - including the key another site publishes its live
 * stream under, and including a key the user created for a site of their own.
 * Whoever published last decided what the name resolved to.
 *
 * The name cannot be namespaced per site instead: a site publishes under a name
 * and later resolves that same name, and `resolveIPNS` has to keep resolving
 * names that came from anywhere. So ownership is recorded on first use and
 * enforced afterwards, which leaves every existing site working with the names
 * it already publishes.
 */

const FILE_NAME = 'lumen_ipns_ownership.json';
const VERSION = 1;

/** Keys the site-data subsystem manages. It has its own guarded channel. */
const RESERVED_KEY_PREFIXES = ['sitedata:', 'siteidentity:'];

let cached = null;

function ownershipPath() {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function loadFromDisk() {
  try {
    const raw = fs.readFileSync(ownershipPath(), 'utf8');
    const parsed = raw ? JSON.parse(raw) : null;
    const keys = parsed && typeof parsed.keys === 'object' && parsed.keys ? parsed.keys : {};
    const owners = {};
    for (const [key, value] of Object.entries(keys)) {
      const owner = String(value?.siteKey || '').trim();
      if (owner) owners[key] = { siteKey: owner, claimedAt: Number(value?.claimedAt) || 0 };
    }
    return { version: VERSION, keys: owners };
  } catch {
    return { version: VERSION, keys: {} };
  }
}

function getAll() {
  if (!cached) cached = loadFromDisk();
  return cached;
}

function persist(data) {
  try {
    fs.mkdirSync(path.dirname(ownershipPath()), { recursive: true });
    writeFileAtomic(ownershipPath(), JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('[electron][ipns] failed to persist key ownership:', e);
  }
}

function isReservedKeyName(keyName) {
  const name = String(keyName || '').trim().toLowerCase();
  return RESERVED_KEY_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** The site that owns a key name, or `null` while nobody has claimed it. */
function ownerOfKey(keyName) {
  const name = String(keyName || '').trim();
  if (!name) return null;
  const entry = getAll().keys[name];
  return entry ? entry.siteKey : null;
}

/**
 * Whether this site may publish under this key name, claiming it if it is free.
 *
 * Returns a reason rather than a boolean so the caller can say which of the two
 * refusals happened without repeating the rules.
 */
function claimKeyForSite(keyName, siteKey) {
  const name = String(keyName || '').trim();
  const site = String(siteKey || '').trim();
  if (!name) return { ok: false, error: 'missing_key' };
  if (!site) return { ok: false, error: 'missing_siteKey' };
  if (isReservedKeyName(name)) return { ok: false, error: 'reserved_key' };

  const existing = ownerOfKey(name);
  if (existing && existing !== site) return { ok: false, error: 'key_owned_by_another_site' };
  if (existing === site) return { ok: true };

  const data = getAll();
  data.keys[name] = { siteKey: site, claimedAt: Date.now() };
  cached = data;
  persist(data);
  return { ok: true };
}

module.exports = {
  claimKeyForSite,
  ownerOfKey,
  isReservedKeyName,
};
