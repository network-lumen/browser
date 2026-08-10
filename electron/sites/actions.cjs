// What a *site* is allowed to ask the browser to do, and how the browser asks
// the user about it.
//
// Everything a page can reach through window.lumen and that needs a decision
// lands here: deriving which site is calling (the anti-spoofing frontier), the
// one-at-a-time lock, the cooldown between modals, the permission prompt, and
// the eighteen handlers themselves.
//
// It lived inline in main.cjs, which is why it had no tests: reaching any of
// it meant starting the app. The shape is unchanged - the same handlers, in
// the same order, registered at the same point in startup - only the file is
// different.
//
// The rule that runs through all of it: a site's identity comes from the URL
// its webContents is on *right now*, never from what it says about itself, and
// it is re-checked after every await. A page can navigate while a modal is
// open, and the answer must not be applied to whoever moved in.
const { BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const { safeString } = require('../utils/strings.cjs');
const { sleep } = require('../utils/values.cjs');
const { getMainWindow, browserWindowForWebContents } = require('../windows.cjs');
const { getSettings } = require('../settings.cjs');
const {
  ipfsAdd,
  ipfsPublishToIPNS,
  ipfsKeyList,
  ipfsKeyGen,
  ipfsKeyImportFromPath,
  ipfsKeyExportToPath,
  ipfsKeyRm
} = require('../ipfs.cjs');
const { invalidateIpnsCache } = require('../daemons/ipfs_cache.cjs');
const { loadProfilesFile } = require('../ipc/profiles.cjs');
const { isAllowed: isLumenSiteAllowed, setAllowed: setLumenSiteAllowed } = require('./permissions.cjs');
const siteData = require('./data.cjs');

function deriveSiteKeyFromHref(href) {
  try {
    const u = new URL(String(href || ''));
    const p = String(u.pathname || '/');
    const host = String(u.hostname || '').trim();

    // Subdomain gateway: http://<id>.ipfs.localhost:8080/...
    if (host) {
      const h = host.toLowerCase();
      const mSub = h.match(/^([a-z0-9]+)\.(ipfs|ipns)\./i);
      if (mSub && mSub[1] && mSub[2]) {
        const id = String(mSub[1] || '').trim();
        const kind = String(mSub[2] || '').trim().toLowerCase();
        if (id && (kind === 'ipfs' || kind === 'ipns')) return `${kind}:${id}`;
      }
    }

    let m = p.match(/^\/ipfs\/([^/]+)(\/.*)?$/i);
    if (m && m[1]) return `ipfs:${m[1]}`;
    m = p.match(/^\/ipns\/([^/]+)(\/.*)?$/i);
    if (m && m[1]) return `ipns:${m[1]}`;
    return null;
  } catch {
    return null;
  }
}

// Domain-backed <webview> instances (SitePage.vue's lumen://mysite.lmn) navigate to the
// resolved gateway URL under the hood, so sender.getURL() alone only ever reveals the
// backing ipfs:/ipns: identity - never the domain the user actually visited. SitePage.vue
// (trusted renderer only, see site:registerDomainTarget in preload.cjs - untrusted webview
// content has no route to this channel) registers its own webContents id -> host here so
// senderSiteContext can report the domain identity instead.
const siteDomainByWebContentsId = new Map();

/**
 * Drops a destroyed webContents from the domain map.
 *
 * Called from main.cjs's teardown hook rather than from a listener of our own,
 * because one place watching web-contents-created is enough. It has to happen:
 * ids are recycled, and a stale entry would hand the next page another site's
 * identity.
 */
function forgetSiteWebContents(id) {
  siteDomainByWebContentsId.delete(id);
}

function senderSiteContext(evt) {
  const sender = evt && evt.sender ? evt.sender : null;
  if (!sender || sender.isDestroyed()) return { ok: false, error: 'sender_missing' };

  try {
    if (typeof sender.getType === 'function') {
      const t = String(sender.getType() || '').toLowerCase();
      if (t && t !== 'webview') return { ok: false, error: 'not_webview' };
    }
  } catch {
    // ignore
  }

  const href = safeString(typeof sender.getURL === 'function' ? sender.getURL() : '', 4096);
  const domainHost = siteDomainByWebContentsId.get(sender.id);
  const siteKey = domainHost ? `domain:${domainHost}` : deriveSiteKeyFromHref(href);
  if (!siteKey) return { ok: false, error: 'unsupported_origin' };

  return { ok: true, sender, href, siteKey };
}

/**
 * Same as senderSiteContext(), but tolerant of the brief window right after
 * a webview starts loading where the guest page's own script can already be
 * running (and calling window.lumen) before SitePage.vue's
 * registerDomainTargetWithRetry() has landed its site:registerDomainTarget
 * IPC call - without this, a site loaded through a registered Lumen domain
 * would briefly report/show its raw resolved ipfs/ipns address instead (e.g.
 * in the permission modal's "Site" field) if it calls a gated API eagerly on
 * load, which a real domain lookup would otherwise never show the user.
 * Only worth the extra latency for permission-gated site actions, not the
 * high-frequency ones (ipfsGet, etc).
 *
 * maxWaitMs must stay comfortably above SitePage.vue's own worst-case
 * registration budget (registerDomainTargetWithRetry: 40 attempts * 50ms =
 * 2000ms) - anything shorter can legitimately time out a hair before the
 * registration lands and silently fall back to the raw address, which is
 * exactly the bug this function exists to avoid.
 */
async function senderSiteContextAwaitingDomain(evt, maxWaitMs = 3000) {
  const ctx = senderSiteContext(evt);
  if (!ctx.ok || ctx.siteKey.startsWith('domain:')) return ctx;
  const sender = evt && evt.sender ? evt.sender : null;
  if (!sender) return ctx;
  const start = Date.now();
  console.log(`[electron][siteData-domain-wait] waiting: webContentsId=${sender.id} initialSiteKey=${ctx.siteKey} knownDomainIds=[${[...siteDomainByWebContentsId.keys()].join(',')}]`);
  while (Date.now() - start < maxWaitMs) {
    if (sender.isDestroyed()) return ctx;
    if (siteDomainByWebContentsId.has(sender.id)) {
      const retried = senderSiteContext(evt);
      console.log(`[electron][siteData-domain-wait] resolved after ${Date.now() - start}ms: webContentsId=${sender.id} siteKey=${retried.ok ? retried.siteKey : '(context lost)'}`);
      return retried.ok ? retried : ctx;
    }
    await sleep(50);
  }
  console.log(`[electron][siteData-domain-wait] TIMED OUT after ${maxWaitMs}ms: webContentsId=${sender.id} still siteKey=${ctx.siteKey} knownDomainIds=[${[...siteDomainByWebContentsId.keys()].join(',')}]`);
  return ctx;
}

function isSenderSiteContextStillValid(ctx) {
  try {
    const sender = ctx && ctx.sender ? ctx.sender : null;
    if (!sender || sender.isDestroyed()) return false;
    const hrefNow = safeString(typeof sender.getURL === 'function' ? sender.getURL() : '', 4096);
    const domainHost = siteDomainByWebContentsId.get(sender.id);
    const siteKeyNow = domainHost ? `domain:${domainHost}` : deriveSiteKeyFromHref(hrefNow);
    return !!(siteKeyNow && siteKeyNow === ctx.siteKey);
  } catch {
    return false;
  }
}

function getUiWebContents() {
  const win = getMainWindow() || BrowserWindow.getAllWindows()[0] || null;
  const wc = win && win.webContents ? win.webContents : null;
  if (!wc || wc.isDestroyed()) return null;
  return wc;
}

let uiSeq = 0;
const pendingUi = new Map(); // id -> { resolve, timeout }
const UI_REQUEST_TIMEOUT_MS = 60_000;
const UI_INTERACTIVE_TIMEOUT_MS = 10 * 60_000;

function requestUi(type, data, options = {}) {
  const wc = getUiWebContents();
  if (!wc) return Promise.resolve({ ok: false, error: 'ui_unavailable' });

  uiSeq += 1;
  const id = `lumenSite-${Date.now().toString(36)}-${uiSeq.toString(36)}`;
  const payload = { id, type: safeString(type, 64), data: data ?? null };
  const timeoutMsRaw = Number(options && Object.prototype.hasOwnProperty.call(options, 'timeoutMs') ? options.timeoutMs : UI_REQUEST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? Math.floor(timeoutMsRaw) : 0;

  return new Promise((resolve) => {
    const timeout = timeoutMs
      ? setTimeout(() => {
          pendingUi.delete(id);
          resolve({ ok: false, error: 'ui_timeout' });
        }, timeoutMs)
      : null;
    pendingUi.set(id, { resolve, timeout });
    try {
      wc.send('lumenSite:uiRequest', payload);
    } catch {
      pendingUi.delete(id);
      if (timeout) clearTimeout(timeout);
      resolve({ ok: false, error: 'ui_send_failed' });
    }
  });
}

let uiChain = Promise.resolve();
function enqueueUi(fn) {
  const run = uiChain.then(fn, fn);
  uiChain = run.catch(() => {});
  return run;
}

const siteLastModalAt = new Map(); // siteKey -> nextAllowedAt (ms)
const siteInFlight = new Map(); // siteKey -> count
let uiTabsStateReady = false;
const uiOpenTabIds = new Set(); // tabId -> true

function isUiTabOpen(tabId) {
  const id = safeString(tabId, 256);
  if (!id) return false;
  if (!uiTabsStateReady) return true;
  return uiOpenTabIds.has(id);
}

function tryBeginSiteAction(siteKey) {
  const key = safeString(siteKey, 256);
  if (!key) return { ok: false, error: 'missing_siteKey' };
  const cur = siteInFlight.get(key) || 0;
  if (cur >= 1) return { ok: false, error: 'busy' };
  siteInFlight.set(key, cur + 1);
  return { ok: true, key };
}

function endSiteAction(siteKey) {
  const key = safeString(siteKey, 256);
  if (!key) return;
  const cur = (siteInFlight.get(key) || 0) - 1;
  if (cur <= 0) siteInFlight.delete(key);
  else siteInFlight.set(key, cur);
}

async function enforceSiteModalDelay(siteKey) {
  const key = safeString(siteKey, 256);
  if (!key) return;
  const now = Date.now();
  const nextAllowedAt = siteLastModalAt.get(key) || 0;
  const waitMs = nextAllowedAt - now;
  if (waitMs > 0) await sleep(waitMs);
}

function markSiteModalCooldown(siteKey, ms = 3000) {
  const key = safeString(siteKey, 256);
  if (!key) return;
  const cooldownMs = typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 3000;
  siteLastModalAt.set(key, Date.now() + cooldownMs);
}

async function ensureLumenSitePermission(siteKey, meta, actionKind, actionDetails) {
  const key = safeString(siteKey, 256);
  if (!key) return { ok: false, error: 'missing_siteKey' };
  if (isLumenSiteAllowed(key)) return { ok: true, decision: 'always' };

  const res = await requestUi('permission', {
    siteKey: key,
    meta: meta ?? null,
    actionKind: safeString(actionKind, 64),
    actionDetails: actionDetails ?? null
  }, { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS });

  if (!res || res.ok === false) return res || { ok: false, error: 'permission_prompt_failed' };

  const decision = safeString(res.decision || '', 16).toLowerCase();
  if (decision === 'always') {
    setLumenSiteAllowed(key, true);
    return { ok: true, decision: 'always' };
  }
  if (decision === 'once') return { ok: true, decision: 'once' };
  return { ok: false, error: 'user_denied' };
}

function ensureUiSender(evt) {
  const ui = getUiWebContents();
  if (!ui) return { ok: false, error: 'ui_unavailable' };
  if (!evt || evt.sender !== ui) return { ok: false, error: 'not_ui' };
  return { ok: true };
}

/**
 * Active wallet profile id, read directly (no IPC round trip needed - this
 * runs in the main process already). Site-data records are scoped per
 * (site, profile) so switching profiles naturally gets a separate record,
 * same as switching accounts on a real site would.
 */
function activeProfileIdForSiteData() {
  try {
    const { profiles, activeId } = loadProfilesFile();
    const userProfiles = profiles.filter((p) => p && p.role !== 'guest');
    const active = userProfiles.find((p) => p.id === activeId) || userProfiles[0] || null;
    return active ? String(active.id || '').trim() : '';
  } catch {
    return '';
  }
}

/**
 * Writes a site identity's private key to a file the user picks. Shared by
 * the export flow and by the import flow's "save the one I'm replacing"
 * option, so both produce the same kind of file and either can restore the
 * other. Never returns the key material to its caller - only whether the
 * write happened - so no path leads from here back to a page.
 */
async function saveSiteIdentityKeyToDisk(keyName, siteKey) {
  const label = safeString(siteKey, 128).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
  const win = getMainWindow();
  const options = {
    title: 'Save site identity key',
    defaultPath: `lumen-identity-${label}.pem`,
    filters: [
      { name: 'PEM private key', extensions: ['pem'] },
      { name: 'All files', extensions: ['*'] },
    ],
  };
  const selected = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
  if (selected.canceled || !selected.filePath) return { ok: false, canceled: true, error: 'user_cancelled' };
  const exported = await ipfsKeyExportToPath(keyName, selected.filePath);
  if (!exported?.ok) return { ok: false, error: exported?.error || 'key_export_failed' };
  return { ok: true };
}

/** Registers every channel a site can reach. Called once, at startup. */
function registerSiteIpc() {
  /**
   * Writes the map `senderSiteContext` reads to decide a site's identity, so the
   * sender is checked here rather than trusted because of which preload happens
   * to expose the channel today. A caller that could reach this could otherwise
   * claim any webContents belongs to a domain of its choosing - which is the one
   * thing the site context exists to prevent.
   */

  ipcMain.on('site:registerDomainTarget', (evt, targetWebContentsId, host) => {
    if (!ensureUiSender(evt).ok) return;
    const id = Number(targetWebContentsId);
    const h = safeString(host, 256).toLowerCase();
    if (!Number.isFinite(id)) return;
    console.log(`[electron][site-domain] register: webContentsId=${id} host=${h || '(empty, deleting)'}`);
    if (h) siteDomainByWebContentsId.set(id, h);
    else siteDomainByWebContentsId.delete(id);
  });

  ipcMain.on('site:unregisterDomainTarget', (evt, targetWebContentsId) => {
    if (!ensureUiSender(evt).ok) return;
    const id = Number(targetWebContentsId);
    console.log(`[electron][site-domain] unregister: webContentsId=${id} hadEntry=${siteDomainByWebContentsId.has(id)}`);
    if (Number.isFinite(id)) siteDomainByWebContentsId.delete(id);
  });

  /**
   * Answers a pending permission or modal request by id. Only the window that
   * shows those modals may answer them: without this check, anything able to
   * reach the channel could approve its own prompt by guessing an id.
   */
  ipcMain.on('lumenSite:uiResponse', (evt, payload) => {
    if (!ensureUiSender(evt).ok) return;
    const id = safeString(payload && payload.id ? payload.id : '', 128);
    if (!id) return;
    const pending = pendingUi.get(id);
    if (!pending) return;
    pendingUi.delete(id);
    try {
      if (pending.timeout) clearTimeout(pending.timeout);
    } catch {}
    try {
      pending.resolve(payload && Object.prototype.hasOwnProperty.call(payload, 'response') ? payload.response : null);
    } catch {}
  });

  ipcMain.on('tabs:state', (evt, tabIds) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return;
    uiTabsStateReady = true;
    uiOpenTabIds.clear();
    const ids = Array.isArray(tabIds) ? tabIds : [];
    for (const id of ids) {
      const key = safeString(id, 256);
      if (key) uiOpenTabIds.add(key);
    }
  });

  ipcMain.handle('lumenSite:getLocalGatewayBase', async () => {
    const s = getSettings();
    return safeString(s && s.localGatewayBase ? s.localGatewayBase : '', 1024);
  });

  // A registered Lumen domain (e.g. lumen://social.lumen.lmn) is main-process-only
  // metadata (siteDomainByWebContentsId, set via site:registerDomainTarget) - the
  // <webview> itself still navigates to the resolved ipfs/ipns gateway URL under
  // the hood, so a site's own window.location can NEVER reveal its pretty domain.
  // This is the one place that can answer "what's my own shareable address".
  ipcMain.handle('lumenSite:getSiteDomain', async (evt) => {
    const ctx = await senderSiteContextAwaitingDomain(evt);
    if (!ctx.ok) return '';
    return ctx.siteKey.startsWith('domain:') ? ctx.siteKey.slice('domain:'.length) : '';
  });

  ipcMain.handle('lumenSite:setFullscreen', async (evt, input) => {
    const ctx = senderSiteContext(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const active = !!(input && input.active);
    const win = browserWindowForWebContents(evt.sender);
    if (!win || win.isDestroyed?.()) return { ok: false, error: 'window_unavailable' };
    try {
      win.setFullScreen(active);
      return {
        ok: true,
        active: typeof win.isFullScreen === 'function' ? !!win.isFullScreen() : active
      };
    } catch (e) {
      return { ok: false, error: safeString(e?.message || e || 'window_fullscreen_failed', 512) };
    }
  });

  ipcMain.handle('lumenSite:sendToken', async (evt, input) => {
    const ctx = senderSiteContext(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const to = safeString(input && input.to ? input.to : '', 256);
    const memo = safeString(input && input.memo ? input.memo : '', 1024);
    const amountLmn =
      typeof (input && input.amountLmn) === 'number' && Number.isFinite(input.amountLmn)
        ? input.amountLmn
        : null;

    const meta = {
      href: ctx.href,
      title: safeString(input && input.title ? input.title : '', 256)
    };

    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'SendToken', {
          to,
          memo,
          amountLmn
        });
        if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        await enforceSiteModalDelay(ctx.siteKey);

        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const res = await requestUi('sendToken', {
          siteKey: ctx.siteKey,
          meta,
          defaults: { to, memo, amountLmn, denom: 'LMN' }
        });
        markSiteModalCooldown(ctx.siteKey);
        return res || { ok: false, error: 'send_modal_failed' };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  /**
   * Approval for a signature requested through the Keplr/Leap shims.
   *
   * Those shims stand in for a wallet extension, and a real one always shows its
   * own approval window before signing. Nothing showed one here, so a site could
   * sign with an unlocked session and never surface it - unlike
   * lumenSite:sendToken above, which has always prompted.
   *
   * Deliberately does NOT go through ensureLumenSitePermission: that persists an
   * "always allow", which is right for reading a domain and wrong for
   * authorising signatures. Every call prompts.
   */
  ipcMain.handle('lumenSite:approveWalletSigning', async (evt, input) => {
    const ctx = senderSiteContext(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const operation = safeString(input && input.operation ? input.operation : '', 64);
    const chainId = safeString(input && input.chainId ? input.chainId : '', 128);
    const signerAddress = safeString(input && input.signerAddress ? input.signerAddress : '', 256);
    const details = safeString(input && input.details ? input.details : '', 8192);

    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        await enforceSiteModalDelay(ctx.siteKey);

        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const res = await requestUi(
          'walletSign',
          { siteKey: ctx.siteKey, meta: { href: ctx.href }, operation, chainId, signerAddress, details },
          { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS }
        );
        markSiteModalCooldown(ctx.siteKey);

        // Anything short of an explicit approval is a refusal - a timeout, a
        // closed window, a malformed reply. The safe default is not to sign.
        if (res && res.ok === true && res.approved === true) return { ok: true };
        return { ok: false, error: safeString((res && res.error) || 'user_denied', 128) };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  ipcMain.handle('lumenSite:pin', async (evt, input) => {
    const ctx = senderSiteContext(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const cidOrUrl = safeString(input && (input.cid || input.url || input.cidOrUrl) ? (input.cid || input.url || input.cidOrUrl) : '', 2048);
    if (!cidOrUrl) return { ok: false, error: 'missing_cid' };
    const name = safeString(input && (input.name || input.filename || input.saveName) ? (input.name || input.filename || input.saveName) : '', 256);

    const meta = {
      href: ctx.href,
      title: safeString(input && input.title ? input.title : '', 256)
    };

    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'Save', { cidOrUrl, name });
        if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        await enforceSiteModalDelay(ctx.siteKey);

        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const res = await requestUi('pin', {
          siteKey: ctx.siteKey,
          meta,
          cidOrUrl,
          name
        });
        markSiteModalCooldown(ctx.siteKey);
        return res || { ok: false, error: 'pin_modal_failed' };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  ipcMain.handle('lumenSite:stableLinkForLive', async (evt, input) => {
    const ctx = senderSiteContext(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const title = safeString(input && input.title ? input.title : '', 256);
    const suggestedName = safeString(input && input.suggestedName ? input.suggestedName : '', 128);
    const records = Array.isArray(input && input.records)
      ? input.records
          .map((record) => ({
            key: safeString(record && record.key ? record.key : '', 128),
            value: safeString(record && record.value ? record.value : '', 4096),
          }))
          .filter((record) => record.key && record.value)
          .slice(0, 16)
      : [];
    if (!records.length) return { ok: false, error: 'missing_records' };

    const meta = { href: ctx.href, title };
    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'StableLink', {
          title,
          suggestedName,
        });
        if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        await enforceSiteModalDelay(ctx.siteKey);

        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const res = await requestUi('stableLink', {
          siteKey: ctx.siteKey,
          meta,
          title,
          suggestedName,
          records,
        }, { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS });
        markSiteModalCooldown(ctx.siteKey);
        return res || { ok: false, error: 'stable_link_modal_failed' };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  ipcMain.handle('lumenSite:stableLinkSetup', async (evt, input) => {
    const ctx = senderSiteContext(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const title = safeString(input && input.title ? input.title : '', 256);
    const meta = { href: ctx.href, title };
    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
        const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'StableLink', { title, mode: 'setup' });
        if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
        await enforceSiteModalDelay(ctx.siteKey);
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
        const res = await requestUi('stableLinkSetup', { siteKey: ctx.siteKey, meta, title }, { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS });
        markSiteModalCooldown(ctx.siteKey);
        return res || { ok: false, error: 'stable_link_setup_modal_failed' };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  ipcMain.handle('lumenSite:publishStableLinkForLive', async (evt, input) => {
    const ctx = senderSiteContext(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const title = safeString(input && input.title ? input.title : '', 256);
    const keyName = safeString(input && input.keyName ? input.keyName : '', 256);
    if (!keyName || !keyName.startsWith('stable:')) return { ok: false, error: 'invalid_key_name' };
    const records = Array.isArray(input && input.records)
      ? input.records
          .map((record) => ({
            key: safeString(record && record.key ? record.key : '', 128),
            value: safeString(record && record.value ? record.value : '', 4096),
          }))
          .filter((record) => record.key && record.value)
          .slice(0, 24)
      : [];
    if (!records.length) return { ok: false, error: 'missing_records' };

    const meta = { href: ctx.href, title };
    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
        const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'StableLink', { title, keyName, mode: 'publish' });
        if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

        const body = JSON.stringify({
          lumenRecordsVersion: 1,
          type: 'lumen.stable-link.records',
          updatedAt: new Date().toISOString(),
          records,
        }, null, 2);
        const added = await ipfsAdd(Buffer.from(body, 'utf8'), 'stable-live.lumen-records.json');
        if (!added?.ok || !added.cid) return { ok: false, error: added?.error || 'ipfs_add_failed' };
        const published = await ipfsPublishToIPNS(added.cid, keyName, { timeoutMs: 60000 });
        if (!published?.ok) return { ok: false, error: published?.error || 'ipns_publish_failed' };

        const keys = await ipfsKeyList().catch(() => null);
        const list = Array.isArray(keys?.keys) ? keys.keys : [];
        const key = list.find((item) => String(item?.Name || item?.name || '') === keyName);
        const ipnsName = String(key?.Id || key?.id || published.name || '').trim();
        try {
          invalidateIpnsCache(ipnsName);
          invalidateIpnsCache(keyName);
        } catch {}
        const url = ipnsName ? `lumen://ipns/${ipnsName}/` : '';
        if (url) clipboard.writeText(url);
        markSiteModalCooldown(ctx.siteKey);
        return { ok: true, url, keyName, ipnsName, copied: !!url };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  // Site-facing: a site's own durable data record, one dedicated IPNS key per
  // (site, active profile), auto-created on first publish. Deliberately
  // separate from the user's own "ugly domains" (see site_data.cjs header) -
  // tracked in its own file, never mixed into ipfsKeyList()-backed UI.
  ipcMain.handle('lumenSite:siteDataGet', async (evt) => {
    const ctx = await senderSiteContextAwaitingDomain(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const profileId = activeProfileIdForSiteData();
    if (!profileId) return { ok: false, error: 'no_active_profile' };

    const meta = { href: ctx.href, title: '' };

    // Deliberately NOT gated behind tryBeginSiteAction/endSiteAction: unlike
    // publish (a real IPFS add + IPNS publish worth serializing against
    // itself), get() is a synchronous local read once permission is granted -
    // modal-stacking is already prevented by enqueueUi below. Sharing the
    // per-site busy lock with publish caused a real bug: a site's own
    // publish() from just before a page refresh keeps that lock held in the
    // main process until its ipfsAdd/ipfsPublishToIPNS round trip finishes
    // (page reloads don't cancel in-flight main-process work) - the freshly
    // reloaded page's very next get() call would hit "busy", be treated as
    // "no profile exists", and show the registration screen despite the data
    // being sitting right there.
    if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
    return enqueueUi(async () => {
      const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'SiteData', { mode: 'get' });
      if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

      const record = siteData.getSiteDataRecord(ctx.siteKey, profileId);
      if (!record) return { ok: true, exists: false };
      return { ok: true, exists: true, datas: record.datas, updatedAt: record.updatedAt, ipnsName: record.ipnsName };
    });
  });

  ipcMain.handle('lumenSite:siteDataPublish', async (evt, input) => {
    const ctx = await senderSiteContextAwaitingDomain(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const profileId = activeProfileIdForSiteData();
    if (!profileId) return { ok: false, error: 'no_active_profile' };

    const datas = input && typeof input.datas === 'object' && input.datas !== null && !Array.isArray(input.datas) ? input.datas : null;
    if (!datas) return { ok: false, error: 'missing_datas' };
    const validation = siteData.validateDatas(datas);
    if (!validation.ok) return validation;
    if (!siteData.canPublishNow(ctx.siteKey, profileId)) return { ok: false, error: 'rate_limited' };

    const meta = { href: ctx.href, title: '' };
    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
        const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'SiteData', { mode: 'publish' });
        if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const existing = siteData.getSiteDataRecord(ctx.siteKey, profileId);
        const keyName = existing?.keyName || siteData.siteDataKeyName(ctx.siteKey, profileId);

        if (!existing) {
          // keyName is a deterministic hash of (siteKey, profileId) - the same
          // pair always resolves to the same name, so a prior key can outlive
          // its tracking record (e.g. Drive's "Sites data" delete removes the
          // record and best-effort ipfsKeyRm()s the key, but doesn't roll back
          // the record deletion if that rm fails - see siteData:delete).
          // Blindly ipfsKeyGen()-ing here would then 500 with "already
          // exists" and permanently block this site from ever publishing
          // again. Checking first makes this self-healing: if the key is
          // already there, just reuse it instead of erroring.
          const keys = await ipfsKeyList().catch(() => null);
          const keyList = Array.isArray(keys?.keys) ? keys.keys : [];
          const alreadyExists = keyList.some((item) => String(item?.Name || item?.name || '') === keyName);
          if (!alreadyExists) {
            const created = await ipfsKeyGen(keyName);
            if (!created?.ok) return { ok: false, error: created?.error || 'ipns_key_create_failed' };
          }
        }

        const body = JSON.stringify({
          lumenSiteDataVersion: 1,
          type: 'lumen.site-data.record',
          origin: ctx.siteKey,
          updatedAt: new Date().toISOString(),
          datas,
        }, null, 2);
        const added = await ipfsAdd(Buffer.from(body, 'utf8'), 'site-data.json');
        if (!added?.ok || !added.cid) return { ok: false, error: added?.error || 'ipfs_add_failed' };
        const published = await ipfsPublishToIPNS(added.cid, keyName, { timeoutMs: 60000 });
        if (!published?.ok) return { ok: false, error: published?.error || 'ipns_publish_failed' };

        let ipnsName = existing?.ipnsName || '';
        if (!ipnsName) {
          const keys = await ipfsKeyList().catch(() => null);
          const list = Array.isArray(keys?.keys) ? keys.keys : [];
          const key = list.find((item) => String(item?.Name || item?.name || '') === keyName);
          ipnsName = String(key?.Id || key?.id || published.name || '').trim();
        }
        try {
          invalidateIpnsCache(ipnsName);
          invalidateIpnsCache(keyName);
        } catch {}

        siteData.upsertSiteDataRecord(ctx.siteKey, profileId, { keyName, ipnsName, datas });
        siteData.markPublished(ctx.siteKey, profileId);
        markSiteModalCooldown(ctx.siteKey);
        return { ok: true, keyName, ipnsName };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  // Exporting hands over the private key behind a site identity - the one
  // secret here that cannot be revoked, rotated or reissued. Two rules follow
  // from that, and both are deliberate departures from the usual site-action
  // shape:
  //
  //  1. The key material NEVER goes back to the page. The site gets {ok}; the
  //     browser writes the file itself. A page that received the key could post
  //     it anywhere, and no modal wording undoes that.
  //  2. No ensureLumenSitePermission() - that helper short-circuits on a stored
  //     "always allow", and an identity export must never be auto-approved by a
  //     decision the user made about something else. The dedicated modal IS the
  //     consent, every single time.
  //
  // Import is the mirror image: the file is chosen through the native picker,
  // so a site can never supply key material of its own choosing (which would
  // let it hand you an identity whose secret it already knows).
  ipcMain.handle('lumenSite:siteDataKeyExport', async (evt) => {
    const ctx = await senderSiteContextAwaitingDomain(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const profileId = activeProfileIdForSiteData();
    if (!profileId) return { ok: false, error: 'no_active_profile' };

    const record = siteData.getSiteDataRecord(ctx.siteKey, profileId);
    if (!record?.keyName) return { ok: false, error: 'no_site_data' };

    const meta = { href: ctx.href, title: '' };
    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
        const res = await requestUi('siteDataKeyExport', {
          siteKey: ctx.siteKey,
          meta,
          ipnsName: record.ipnsName || ''
        }, { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS });
        if (!res || res.ok === false || !res.confirm) return { ok: false, error: 'user_cancelled' };
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const saved = await saveSiteIdentityKeyToDisk(record.keyName, ctx.siteKey);
        if (!saved.ok) return saved;
        markSiteModalCooldown(ctx.siteKey);
        return { ok: true };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  ipcMain.handle('lumenSite:siteDataKeyImport', async (evt) => {
    const ctx = await senderSiteContextAwaitingDomain(evt);
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const profileId = activeProfileIdForSiteData();
    if (!profileId) return { ok: false, error: 'no_active_profile' };

    const meta = { href: ctx.href, title: '' };
    const lock = tryBeginSiteAction(ctx.siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
        const existing = siteData.getSiteDataRecord(ctx.siteKey, profileId);
        const res = await requestUi('siteDataKeyImport', {
          siteKey: ctx.siteKey,
          meta,
          hasExisting: !!existing?.keyName,
          ipnsName: existing?.ipnsName || ''
        }, { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS });
        if (!res || res.ok === false || !res.confirm) return { ok: false, error: 'user_cancelled' };
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        // The user ticked "save the identity I'm replacing first". Backing out
        // of that save aborts the whole import rather than quietly continuing:
        // they asked for the safety net, so proceeding without it is precisely
        // the outcome they were guarding against.
        if (res.backupFirst && existing?.keyName) {
          const backed = await saveSiteIdentityKeyToDisk(existing.keyName, ctx.siteKey);
          if (!backed.ok) return backed.canceled ? { ok: false, error: 'user_cancelled' } : backed;
          if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
        }

        const win = getMainWindow();
        const options = {
          title: 'Import a site identity key',
          properties: ['openFile'],
          filters: [
            { name: 'Private key files', extensions: ['key', 'pem', 'txt'] },
            { name: 'All files', extensions: ['*'] },
          ],
        };
        const selected = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
        if (selected.canceled || !selected.filePaths?.length) return { ok: false, error: 'user_cancelled' };
        if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

        const keyName = siteData.importedSiteDataKeyName(ctx.siteKey, profileId);
        const imported = await ipfsKeyImportFromPath(keyName, selected.filePaths[0]);
        if (!imported?.ok) return { ok: false, error: imported?.error || 'key_import_failed' };

        const ipnsName = String(imported.id || '').trim();
        if (!ipnsName) return { ok: false, error: 'key_import_no_ipns_name' };
        try {
          invalidateIpnsCache(ipnsName);
          invalidateIpnsCache(keyName);
        } catch {}

        // `datas` is reset, not carried over: it is this site's own cached JSON
        // about the PREVIOUS identity (for lumen-social, the head commit of a
        // chain that has nothing to do with the imported one). The browser
        // cannot rebuild it - the shape belongs to the site - so it hands back
        // an empty record plus the new ipnsName and lets the site resolve its
        // own state from what that name points at.
        siteData.upsertSiteDataRecord(ctx.siteKey, profileId, { keyName, ipnsName, datas: {} });
        markSiteModalCooldown(ctx.siteKey);
        return { ok: true, ipnsName };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  // Internal/trusted only (main app window, e.g. Drive's "Sites data" section) -
  // no site permission gate, just the same ensureUiSender check other
  // UI-only channels use, since this isn't reachable from any <webview>.
  ipcMain.handle('siteData:list', async (evt) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;
    return { ok: true, records: siteData.listSiteDataRecords() };
  });

  ipcMain.handle('siteData:delete', async (evt, siteKey, profileId) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;
    const key = safeString(siteKey, 256);
    const profile = safeString(profileId, 256);
    if (!key || !profile) return { ok: false, error: 'missing_site_or_profile' };
    const removed = siteData.deleteSiteDataRecord(key, profile);
    if (!removed) return { ok: false, error: 'not_found' };
    if (removed.keyName) {
      // Best-effort: the tracking record is already gone either way (nothing
      // sane to roll back to), but a failed rm here used to be swallowed
      // completely - leaving an orphaned Kubo key behind that a future
      // publish for this same (site, profile) would collide with (see the
      // ipfsKeyList() check added in lumenSite:siteDataPublish, which is what
      // actually makes that collision harmless now). Logging it at least
      // makes the failure visible instead of silent.
      const rm = await ipfsKeyRm(removed.keyName).catch((e) => ({ ok: false, error: String(e?.message || e) }));
      if (!rm?.ok) console.warn('[electron][site-data] delete: failed to remove underlying Kubo key', removed.keyName, rm?.error);
      try {
        invalidateIpnsCache(removed.ipnsName);
        invalidateIpnsCache(removed.keyName);
      } catch {}
    }
    return { ok: true };
  });

  ipcMain.handle('domainSite:sendToken', async (evt, input) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;

    const tabId = safeString(input && input.tabId ? input.tabId : '', 256);
    if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

    const host = safeString(input && input.host ? input.host : '', 256);
    if (!host) return { ok: false, error: 'missing_host' };

    const to = safeString(input && input.to ? input.to : '', 256);
    const memo = safeString(input && input.memo ? input.memo : '', 1024);
    const amountLmn =
      typeof (input && input.amountLmn) === 'number' && Number.isFinite(input.amountLmn)
        ? input.amountLmn
        : null;

    const siteKey = `domain:${host}`;
    const meta = {
      href: safeString(input && input.href ? input.href : `lumen://${host}`, 4096),
      title: safeString(input && input.title ? input.title : '', 256)
    };

    const lock = tryBeginSiteAction(siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

        const perm = await ensureLumenSitePermission(siteKey, meta, 'SendToken', { to, memo, amountLmn });
        if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

        if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

        await enforceSiteModalDelay(siteKey);

        if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

        const res = await requestUi('sendToken', {
          siteKey,
          meta,
          defaults: { to, memo, amountLmn, denom: 'LMN' }
        });
        markSiteModalCooldown(siteKey);
        return res || { ok: false, error: 'send_modal_failed' };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });

  ipcMain.handle('domainSite:pin', async (evt, input) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;

    const tabId = safeString(input && input.tabId ? input.tabId : '', 256);
    if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

    const host = safeString(input && input.host ? input.host : '', 256);
    if (!host) return { ok: false, error: 'missing_host' };

    const cidOrUrl = safeString(input && (input.cid || input.url || input.cidOrUrl) ? (input.cid || input.url || input.cidOrUrl) : '', 2048);
    if (!cidOrUrl) return { ok: false, error: 'missing_cid' };
    const name = safeString(input && (input.name || input.filename || input.saveName) ? (input.name || input.filename || input.saveName) : '', 256);

    const siteKey = `domain:${host}`;
    const meta = {
      href: safeString(input && input.href ? input.href : `lumen://${host}`, 4096),
      title: safeString(input && input.title ? input.title : '', 256)
    };

    const lock = tryBeginSiteAction(siteKey);
    if (!lock.ok) return lock;

    return enqueueUi(async () => {
      try {
        if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

        const perm = await ensureLumenSitePermission(siteKey, meta, 'Save', { cidOrUrl, name });
        if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

        if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

        await enforceSiteModalDelay(siteKey);

        if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

        const res = await requestUi('pin', {
          siteKey,
          meta,
          cidOrUrl,
          name
        });
        markSiteModalCooldown(siteKey);
        return res || { ok: false, error: 'pin_modal_failed' };
      } finally {
        endSiteAction(lock.key);
      }
    });
  });
}

module.exports = {
  registerSiteIpc,
  forgetSiteWebContents,
  // Used by main.cjs for the channels that stayed there, and by the tests:
  // these are the decisions, the handlers around them are plumbing.
  ensureUiSender,
  deriveSiteKeyFromHref,
  senderSiteContext,
  isSenderSiteContextStillValid,
  tryBeginSiteAction,
  endSiteAction,
  enforceSiteModalDelay,
  markSiteModalCooldown,
  isUiTabOpen,
  ensureLumenSitePermission
};
