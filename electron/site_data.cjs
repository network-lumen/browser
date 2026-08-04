// Tracking store for per-site data records: one dedicated IPNS key per
// (site, active profile) pair, auto-created the first time a site publishes
// through `window.lumen.siteData.publish()`. This is deliberately separate
// from the user's own "ugly domains" (raw IPNS keys the user creates by hand
// in Domains) - these records are tagged as site-managed from creation, kept
// in their own file, and surfaced in the Drive page's "Sites data" section
// instead of mixed into the raw ipfs key list.
//
// `datas` is cached here in full (not just the IPNS pointer), so
// `siteDataGet()` (the hot path, called on every page load by a site trying
// to auto-login) never has to touch the network - it's a local read. The
// actual `ipfsAdd`+`ipfsPublishToIPNS` round trip only happens on publish,
// for durability/portability to other devices.
const crypto = require('node:crypto');
const { userDataPath, readJson, writeJson } = require('./utils/fs.cjs');

const FILE = () => userDataPath('site_data_records.json');
const VERSION = 1;
const MAX_DATAS_BYTES = 512 * 1024;
const MAX_DEPTH = 4;
const MAX_ARRAY_LENGTH = 500;
const MAX_STRING_LENGTH = 10_000;
const PUBLISH_RATE_LIMIT_MS = 2000;

let cached = null;
const lastPublishAt = new Map(); // in-memory only, not persisted - resets on app restart, which is fine for a rate limit

function recordId(siteKey, profileId) {
  return `${String(siteKey || '')}|${String(profileId || '')}`;
}

/** Deterministic per-(site, profile) Kubo key name - same pair always resolves to the same key, never duplicated. */
function siteDataKeyName(siteKey, profileId) {
  const hash = crypto.createHash('sha256').update(`${siteKey}::${profileId}`).digest('hex').slice(0, 32);
  return `sitedata:${hash}`;
}

/**
 * Key name for a key the user imported for this (site, profile) pair.
 *
 * Deliberately NOT the deterministic name above, and deliberately unique per
 * import: Kubo key names have to be unique, so the key being replaced keeps
 * the deterministic name and stays in the keystore. An IPNS identity cannot
 * be revoked or reissued - removing the outgoing key would make a mis-click
 * permanent - so an import only ever moves the record's pointer. Recovering
 * the previous identity is then just a matter of pointing back at a key that
 * is still there.
 */
function importedSiteDataKeyName(siteKey, profileId) {
  return `${siteDataKeyName(siteKey, profileId)}-i${crypto.randomBytes(4).toString('hex')}`;
}

function load() {
  if (cached) return cached;
  const fallback = { version: VERSION, records: {} };
  const data = readJson(FILE(), fallback) || fallback;
  if (!data.records || typeof data.records !== 'object') data.records = {};
  cached = data;
  return cached;
}

function persist() {
  if (cached) writeJson(FILE(), cached);
}

function getSiteDataRecord(siteKey, profileId) {
  const data = load();
  return data.records[recordId(siteKey, profileId)] || null;
}

function upsertSiteDataRecord(siteKey, profileId, { keyName, ipnsName, datas }) {
  const data = load();
  const id = recordId(siteKey, profileId);
  const now = Date.now();
  const existing = data.records[id];
  data.records[id] = {
    siteKey,
    profileId,
    keyName,
    ipnsName,
    datas: datas ?? existing?.datas ?? {},
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  persist();
  return data.records[id];
}

/** Removes the tracking entry and returns it (caller is responsible for also calling ipfsKeyRm(keyName) to free the underlying Kubo key). */
function deleteSiteDataRecord(siteKey, profileId) {
  const data = load();
  const id = recordId(siteKey, profileId);
  const existing = data.records[id] || null;
  if (existing) {
    delete data.records[id];
    persist();
  }
  return existing;
}

function listSiteDataRecords() {
  const data = load();
  return Object.values(data.records);
}

function datasSizeOk(datas) {
  try {
    return JSON.stringify(datas ?? {}).length <= MAX_DATAS_BYTES;
  } catch {
    return false;
  }
}

/**
 * Structural bounds on `datas` - kept generic (any JSON shape a site wants:
 * objects, arrays, whatever), just capped so nothing pathological (unbounded
 * nesting, a single absurd string, a huge array) sneaks past the total-size
 * check by front-loading one field.
 */
function datasStructureOk(value, depth = 0) {
  if (depth > MAX_DEPTH) return false;
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length <= MAX_STRING_LENGTH;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) {
    return value.length <= MAX_ARRAY_LENGTH && value.every((item) => datasStructureOk(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.values(value).every((item) => datasStructureOk(item, depth + 1));
  }
  return false;
}

/** Combined size + structure check, with the specific rejection reason for the caller to surface. */
function validateDatas(datas) {
  if (!datasSizeOk(datas)) return { ok: false, error: 'datas_too_large' };
  if (!datasStructureOk(datas)) return { ok: false, error: 'datas_structure_invalid' };
  return { ok: true };
}

/** At most one publish per (site, profile) every PUBLISH_RATE_LIMIT_MS - closes the gap where, once "always allow" is granted, nothing else throttles repeated siteData.publish() calls. */
function canPublishNow(siteKey, profileId) {
  const last = lastPublishAt.get(recordId(siteKey, profileId)) || 0;
  return Date.now() - last >= PUBLISH_RATE_LIMIT_MS;
}

function markPublished(siteKey, profileId) {
  lastPublishAt.set(recordId(siteKey, profileId), Date.now());
}

module.exports = {
  siteDataKeyName,
  importedSiteDataKeyName,
  getSiteDataRecord,
  upsertSiteDataRecord,
  deleteSiteDataRecord,
  listSiteDataRecords,
  datasSizeOk,
  validateDatas,
  canPublishNow,
  markPublished,
  MAX_DATAS_BYTES,
  PUBLISH_RATE_LIMIT_MS
};
