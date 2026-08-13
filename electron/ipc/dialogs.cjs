const { BrowserWindow, dialog, ipcMain } = require('electron');
const { safeString } = require('../utils/strings.cjs');

/**
 * The native file and folder pickers.
 *
 * Two things here are not obvious. The options a caller sends are rebuilt
 * rather than forwarded, because they end up in an OS dialog and a filter list
 * from a page is not something to hand Electron unchecked. And on Linux the
 * dialog is opened without a parent window: parenting it to a window under a
 * portal-backed picker is what makes the picker hang instead of appearing.
 */

function sanitizeDialogOptions(input = {}) {
  const o = input && typeof input === 'object' ? input : {};
  const title = safeString(o.title, 256) || '';
  const multi = !!o.multi;
  const allowFiles = o.allowFiles !== false;
  const allowDirs = !!o.allowDirs;
  const filtersRaw = Array.isArray(o.filters) ? o.filters : [];
  const filters = filtersRaw
    .map((f) => ({
      name: safeString(f && f.name, 64) || 'Files',
      extensions: Array.isArray(f && f.extensions)
        ? f.extensions
            .map((x) => safeString(x, 16).replace(/^\./, '').toLowerCase())
            .filter(Boolean)
        : []
    }))
    .filter((f) => f.extensions.length > 0)
    .slice(0, 10);
  return { title, multi, allowFiles, allowDirs, filters };
}

/**
 * A Linux session without a user bus - a container, a system service, a root
 * shell - has no portal to answer the picker, and the call never returns.
 * Better to say so than to hang.
 */
function isLinuxDialogEnvironmentSupported() {
  try {
    if (process.platform !== 'linux') return true;
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const hasSessionBus = !!String(process.env.DBUS_SESSION_BUS_ADDRESS || '').trim();
    const hasRuntimeDir = !!String(process.env.XDG_RUNTIME_DIR || '').trim();
    return !isRoot && hasSessionBus && hasRuntimeDir;
  } catch {
    return true;
  }
}

function uniquePaths(filePaths) {
  return Array.from(
    new Set((filePaths || []).map((p) => String(p || '').trim()).filter(Boolean)),
  );
}

async function openPicker(evt, options, kind) {
  const channel = kind === 'directory' ? 'dialog:openFolder' : 'dialog:openFiles';
  try {
    console.log(`[electron][ipc] ${channel} requested`);
    if (!isLinuxDialogEnvironmentSupported()) {
      console.log(`[electron][ipc] ${channel} unsupported_environment`);
      return { ok: false, error: 'unsupported_environment' };
    }

    const win = evt && evt.sender ? BrowserWindow.fromWebContents(evt.sender) : null;
    try { win?.focus?.(); } catch {}

    const o = sanitizeDialogOptions(options);
    const properties = [kind === 'directory' ? 'openDirectory' : 'openFile'];
    if (o.multi) properties.push('multiSelections');

    const dialogOptions = {
      title: o.title || (kind === 'directory' ? 'Select folder' : 'Select files'),
      properties,
      ...(kind !== 'directory' && o.filters.length ? { filters: o.filters } : {}),
    };

    const useParent = !!win && process.platform !== 'linux';
    const res = useParent
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (res.canceled || !res.filePaths || !res.filePaths.length) {
      return { ok: false, error: 'canceled' };
    }
    return { ok: true, paths: uniquePaths(res.filePaths) };
  } catch (e) {
    console.warn(`[electron][ipc] ${channel} failed:`, e);
    return { ok: false, error: String(e?.message || e || 'dialog_failed') };
  }
}

function registerDialogIpc() {
  ipcMain.handle('dialog:openFiles', async (evt, options) => openPicker(evt, options, 'file'));
  ipcMain.handle('dialog:openFolder', async (evt, options) => openPicker(evt, options, 'directory'));
}

module.exports = {
  registerDialogIpc,
  sanitizeDialogOptions,
  isLinuxDialogEnvironmentSupported,
};
