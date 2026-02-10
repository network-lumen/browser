const { app, BrowserWindow, ipcMain, webContents } = require('electron');

function safeString(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

const activeTargetByWindowWcId = new Map(); // windowWebContentsId -> targetWebContentsId
const findOpenByWindowWcId = new Map(); // windowWebContentsId -> boolean

function ownerWindowForContents(contents) {
  if (!contents || contents.isDestroyed?.()) return null;

  try {
    const win = contents.getOwnerBrowserWindow?.();
    if (win && !win.isDestroyed?.()) return win;
  } catch {}

  try {
    const win = BrowserWindow.fromWebContents(contents);
    if (win && !win.isDestroyed?.()) return win;
  } catch {}

  return null;
}

function resolveTargetWebContentsId(sourceContents, ownerWindow) {
  if (!sourceContents || sourceContents.isDestroyed?.()) return null;
  const sourceId = safeNumber(sourceContents.id);
  if (sourceId == null) return null;

  const windowWcId = safeNumber(ownerWindow?.webContents?.id);
  if (windowWcId == null) return sourceId;

  // If the shortcut came from the UI (BrowserWindow webContents), prefer the active tab's webContents.
  if (sourceId === windowWcId) {
    const active = safeNumber(activeTargetByWindowWcId.get(windowWcId));
    if (active != null) return active;
    return sourceId;
  }

  // If the shortcut came from a webview, treat it as active for subsequent UI shortcuts.
  activeTargetByWindowWcId.set(windowWcId, sourceId);
  return sourceId;
}

function shouldIgnoreInput(input) {
  const t = String(input?.type || '').toLowerCase();
  // We only care about keyDown events; ignore "char" and "keyUp".
  return t && t !== 'keydown';
}

function parseFindAction(input) {
  const key = String(input?.key || '').toUpperCase();
  const ctrlOrMeta = !!(input?.control || input?.meta);
  const shift = !!input?.shift;
  const alt = !!input?.alt;

  // Avoid Alt-based shortcuts to reduce accidental collisions.
  if (alt) return null;

  if (ctrlOrMeta && key === 'F') return { action: 'open' };
  if (key === 'F3') return { action: shift ? 'prev' : 'next' };
  if (ctrlOrMeta && key === 'G') return { action: shift ? 'prev' : 'next' };
  if (key === 'ESCAPE' || key === 'ESC') return { action: 'close' };

  return null;
}

function sendToOwnerWindow(contents, channel, payload) {
  const win = ownerWindowForContents(contents);
  const wc = win?.webContents;
  if (!wc || wc.isDestroyed?.()) return;
  try {
    wc.send(channel, payload);
  } catch {}
}

function attachFindHooks(contents) {
  if (!contents || contents.isDestroyed?.()) return;

  // Forward Chromium find results back to the UI so the find bar can display counts.
  try {
    contents.on('found-in-page', (_event, result) => {
      const res = result && typeof result === 'object' ? result : {};
      sendToOwnerWindow(contents, 'find:result', {
        targetWebContentsId: safeNumber(contents.id),
        result: {
          requestId: safeNumber(res.requestId) ?? 0,
          activeMatchOrdinal: safeNumber(res.activeMatchOrdinal) ?? 0,
          matches: safeNumber(res.matches) ?? 0,
          finalUpdate: !!res.finalUpdate,
        },
      });
    });
  } catch {}

  // Listen for keyboard shortcuts globally (works even when focus is inside <webview>).
  try {
    contents.on('before-input-event', (event, input) => {
      if (shouldIgnoreInput(input)) return;

      const parsed = parseFindAction(input);
      if (!parsed) return;

      const win = ownerWindowForContents(contents);
      const windowWcId = safeNumber(win?.webContents?.id);

      if (parsed.action === 'close') {
        // Only steal Escape when the find bar is currently open.
        if (windowWcId == null || !findOpenByWindowWcId.get(windowWcId)) return;
      }

      const targetWebContentsId = resolveTargetWebContentsId(contents, win);
      if (targetWebContentsId == null) return;

      try {
        event.preventDefault();
      } catch {}

      sendToOwnerWindow(contents, 'find:action', {
        action: parsed.action,
        targetWebContentsId,
        sourceWebContentsId: safeNumber(contents.id),
        windowWebContentsId: windowWcId,
      });
    });
  } catch {}
}

let hooksInstalled = false;
function installFindHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  if (!app || typeof app.on !== 'function') return;

  try {
    for (const w of BrowserWindow.getAllWindows()) {
      attachFindHooks(w?.webContents);
    }
  } catch {}

  app.on('web-contents-created', (_event, contents) => {
    attachFindHooks(contents);
  });
}

function getWebContentsById(id) {
  const targetId = safeNumber(id);
  if (targetId == null) return null;
  try {
    const wc = webContents.fromId(targetId);
    if (!wc || wc.isDestroyed?.()) return null;
    return wc;
  } catch {
    return null;
  }
}

function isUiSender(evt) {
  const sender = evt?.sender;
  if (!sender || sender.isDestroyed?.()) return false;

  try {
    const t = sender.getType?.();
    if (String(t || '').toLowerCase() === 'webview') return false;
  } catch {
    // ignore
  }

  return true;
}

function registerFindIpc() {
  installFindHooks();

  ipcMain.on('find:setOpen', (evt, openMaybe) => {
    if (!isUiSender(evt)) return;
    const windowWcId = safeNumber(evt?.sender?.id);
    if (windowWcId == null) return;
    findOpenByWindowWcId.set(windowWcId, !!openMaybe);
  });

  ipcMain.on('find:setActiveTarget', (evt, targetIdMaybe) => {
    if (!isUiSender(evt)) return;
    const windowWcId = safeNumber(evt?.sender?.id);
    if (windowWcId == null) return;
    const targetId = safeNumber(targetIdMaybe);
    if (targetId == null) activeTargetByWindowWcId.delete(windowWcId);
    else activeTargetByWindowWcId.set(windowWcId, targetId);
  });

  ipcMain.handle('find:findInPage', async (evt, payload) => {
    if (!isUiSender(evt)) return { ok: false, error: 'forbidden' };

    const targetWebContentsId = safeNumber(payload?.targetWebContentsId);
    const text = safeString(payload?.text, 2048);
    const opts = payload?.options && typeof payload.options === 'object' ? payload.options : {};
    const options = {
      forward: opts.forward !== false,
      findNext: !!opts.findNext,
      matchCase: !!opts.matchCase,
    };

    if (targetWebContentsId == null) return { ok: false, error: 'missing_target' };
    const target = getWebContentsById(targetWebContentsId);
    if (!target) return { ok: false, error: 'target_missing' };

    try {
      const requestId = target.findInPage(text, options);
      return { ok: true, requestId: safeNumber(requestId) ?? 0 };
    } catch (e) {
      return { ok: false, error: safeString(e?.message || e || 'find_failed', 256) };
    }
  });

  ipcMain.handle('find:stopFindInPage', async (evt, payload) => {
    if (!isUiSender(evt)) return { ok: false, error: 'forbidden' };

    const targetWebContentsId = safeNumber(payload?.targetWebContentsId);
    const actionRaw = safeString(payload?.action, 64);
    const action =
      actionRaw === 'keepSelection' || actionRaw === 'activateSelection' || actionRaw === 'clearSelection'
        ? actionRaw
        : 'clearSelection';

    if (targetWebContentsId == null) return { ok: false, error: 'missing_target' };
    const target = getWebContentsById(targetWebContentsId);
    if (!target) return { ok: false, error: 'target_missing' };

    try {
      target.stopFindInPage(action);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: safeString(e?.message || e || 'stop_failed', 256) };
    }
  });

  ipcMain.handle('find:focusTarget', async (evt, targetWebContentsId) => {
    if (!isUiSender(evt)) return { ok: false, error: 'forbidden' };

    const targetId = safeNumber(targetWebContentsId);
    if (targetId == null) return { ok: false, error: 'missing_target' };
    const target = getWebContentsById(targetId);
    if (!target) return { ok: false, error: 'target_missing' };

    try {
      target.focus();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: safeString(e?.message || e || 'focus_failed', 256) };
    }
  });
}

module.exports = {
  registerFindIpc,
};

