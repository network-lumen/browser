// Tracking store for per-site data records: one dedicated IPNS key per
// (site, active profile) pair, auto-created the first time a site publishes
// through `window.lumen.siteData.publish()`. This is deliberately separate
// from the user's own "ugly domains" (raw IPNS keys the user creates by hand
// in Domains) - these records are tagged as site-managed from creation, kept
// in their own file, and surfaced in the Drive page's "Sites data" section
// instead of mixed into the raw ipfs key list.
//
// `datas`/`schema` are cached here in full (not just the IPNS pointer), so
// `siteDataGet()` (the hot path, called on every page load by a site trying
// to auto-login) never has to touch the network - it's a local read. The
// actual `ipfsAdd`+`ipfsPublishToIPNS` round trip only happens on publish,
// for durability/portability to other devices.
const crypto = require('node:crypto');
const { userDataPath, readJson, writeJson } = require('./utils/fs.cjs');

const FILE = () => userDataPath('site_data_records.json');
const VERSION = 1;
const MAX_DATAS_BYTES = 512 * 1024;

let cached = null;

function recordId(siteKey, profileId) {
  return `${String(siteKey || '')}|${String(profileId || '')}`;
}

/** Deterministic per-(site, profile) Kubo key name - same pair always resolves to the same key, never duplicated. */
function siteDataKeyName(siteKey, profileId) {
  const hash = crypto.createHash('sha256').update(`${siteKey}::${profileId}`).digest('hex').slice(0, 32);
  return `sitedata:${hash}`;
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

function upsertSiteDataRecord(siteKey, profileId, { keyName, ipnsName, schema, datas }) {
  const data = load();
  const id = recordId(siteKey, profileId);
  const now = Date.now();
  const existing = data.records[id];
  data.records[id] = {
    siteKey,
    profileId,
    keyName,
    ipnsName,
    schema: schema ?? existing?.schema ?? '',
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

module.exports = {
  siteDataKeyName,
  getSiteDataRecord,
  upsertSiteDataRecord,
  deleteSiteDataRecord,
  listSiteDataRecords,
  datasSizeOk,
  MAX_DATAS_BYTES
};
