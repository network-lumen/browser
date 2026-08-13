const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('../utils/fs.cjs');

/**
 * What a site is allowed to ask the browser to do.
 *
 * `allowModals` is the gate: a site that has never been granted it is asked
 * every time. What it has actually been granted is recorded per action kind
 * next to it, so the rights a site holds can be read back and taken away one
 * at a time rather than only in one lump. An action explicitly set to false is
 * refused without a prompt - that is what revoking one right means, and it has
 * to outrank the blanket grant or it would be undone by the next `Always`.
 */

const FILE_NAME = 'lumen_site_permissions.json';
const VERSION = 1;

/** Every action kind a site can be granted, in the order they are shown. */
const ACTION_KINDS = ['SendToken', 'Save', 'StableLink', 'SiteData'];

let cached = null;

function permissionsPath() {
  const userData = app.getPath('userData');
  return path.join(userData, FILE_NAME);
}

function normalizeEntry(raw) {
  const entry = raw && typeof raw === 'object' ? raw : {};
  const actions = {};
  const rawActions = entry.actions && typeof entry.actions === 'object' ? entry.actions : {};
  for (const kind of ACTION_KINDS) {
    const action = rawActions[kind];
    if (!action || typeof action !== 'object') continue;
    if (typeof action.allowed !== 'boolean') continue;
    actions[kind] = {
      allowed: action.allowed,
      updatedAt: Number(action.updatedAt) || 0,
    };
  }
  return {
    allowModals: entry.allowModals === true,
    actions,
    updatedAt: Number(entry.updatedAt) || 0,
  };
}

function loadFromDisk() {
  const fp = permissionsPath();
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { version: VERSION, sites: {} };
    const rawSites = parsed.sites && typeof parsed.sites === 'object' ? parsed.sites : {};
    const sites = {};
    for (const [key, value] of Object.entries(rawSites)) {
      sites[key] = normalizeEntry(value);
    }
    return { version: VERSION, sites };
  } catch {
    return { version: VERSION, sites: {} };
  }
}

function persistToDisk(data) {
  const fp = permissionsPath();
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    writeFileAtomic(fp, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('[electron][lumenSite] failed to persist permissions:', e);
  }
}

function getAll() {
  if (!cached) cached = loadFromDisk();
  return cached;
}

function entryFor(siteKey) {
  const key = String(siteKey || '').trim();
  if (!key) return null;
  const data = getAll();
  return (data.sites && data.sites[key]) || null;
}

function isAllowed(siteKey) {
  const entry = entryFor(siteKey);
  return !!(entry && entry.allowModals === true);
}

function setAllowed(siteKey, allow) {
  const key = String(siteKey || '').trim();
  if (!key) return { ok: false, error: 'missing_siteKey' };
  const data = getAll();
  if (!data.sites || typeof data.sites !== 'object') data.sites = {};
  const existing = data.sites[key] ? normalizeEntry(data.sites[key]) : normalizeEntry(null);
  data.sites[key] = {
    ...existing,
    allowModals: !!allow,
    updatedAt: Date.now(),
  };
  cached = data;
  persistToDisk(data);
  return { ok: true };
}

/** `true` granted, `false` revoked, `null` never decided. */
function isActionAllowed(siteKey, actionKind) {
  const kind = String(actionKind || '').trim();
  if (!ACTION_KINDS.includes(kind)) return null;
  const entry = entryFor(siteKey);
  const action = entry && entry.actions ? entry.actions[kind] : null;
  return action ? action.allowed : null;
}

function setActionAllowed(siteKey, actionKind, allowed) {
  const key = String(siteKey || '').trim();
  const kind = String(actionKind || '').trim();
  if (!key) return { ok: false, error: 'missing_siteKey' };
  if (!ACTION_KINDS.includes(kind)) return { ok: false, error: 'unknown_action' };

  const data = getAll();
  if (!data.sites || typeof data.sites !== 'object') data.sites = {};
  const existing = data.sites[key] ? normalizeEntry(data.sites[key]) : normalizeEntry(null);
  data.sites[key] = {
    ...existing,
    actions: { ...existing.actions, [kind]: { allowed: !!allowed, updatedAt: Date.now() } },
    updatedAt: Date.now(),
  };
  cached = data;
  persistToDisk(data);
  return { ok: true };
}

/**
 * Notes that a site was just allowed to perform an action, so the right shows
 * up in the list. Never downgrades a right the user revoked by hand.
 */
function recordActionGrant(siteKey, actionKind) {
  if (isActionAllowed(siteKey, actionKind) === false) return { ok: true };
  if (isActionAllowed(siteKey, actionKind) === true) return { ok: true };
  return setActionAllowed(siteKey, actionKind, true);
}

/** Forgets a site entirely: the next action it asks for prompts again. */
function revokeSite(siteKey) {
  const key = String(siteKey || '').trim();
  if (!key) return { ok: false, error: 'missing_siteKey' };
  const data = getAll();
  if (!data.sites || !data.sites[key]) return { ok: false, error: 'not_found' };
  delete data.sites[key];
  cached = data;
  persistToDisk(data);
  return { ok: true };
}

/** Every site that holds (or has had revoked) a right, newest change first. */
function listSitePermissions() {
  const data = getAll();
  const sites = data.sites && typeof data.sites === 'object' ? data.sites : {};
  return Object.entries(sites)
    .map(([siteKey, raw]) => {
      const entry = normalizeEntry(raw);
      return {
        siteKey,
        allowModals: entry.allowModals,
        updatedAt: entry.updatedAt,
        actions: ACTION_KINDS.filter((kind) => entry.actions[kind]).map((kind) => ({
          kind,
          allowed: entry.actions[kind].allowed,
          updatedAt: entry.actions[kind].updatedAt,
        })),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt || a.siteKey.localeCompare(b.siteKey));
}

module.exports = {
  ACTION_KINDS,
  isAllowed,
  setAllowed,
  isActionAllowed,
  setActionAllowed,
  recordActionGrant,
  revokeSite,
  listSitePermissions,
};
