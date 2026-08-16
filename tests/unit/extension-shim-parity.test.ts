import { Module } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * The two `chrome`/`browser` shims, compared member by member.
 *
 * There are two implementations of one surface: webview-preload builds it for
 * a content script inside a <webview>, extension-preload for an extension's
 * own pages. `check:ipc` rule 5 compares the namespace *names* and says so
 * explicitly - it stops short of the members because they differ for real
 * reasons, and a blanket comparison would fire constantly.
 *
 * This goes the rest of the way without the noise: every difference has to be
 * named below, with why. A member added to one shim and forgotten in the other
 * fails here instead of surfacing as "undefined is not a function" in whichever
 * context nobody tested.
 *
 * The shapes are read by loading both preloads and looking at what they hand
 * to contextBridge - the objects themselves, not a regex over the source.
 */

/**
 * Differences that are correct, and why.
 *
 * All of them are the same shape: things only an extension's own page or its
 * background can do. A content script injected into a web page has no business
 * being told the extension was just installed, or closing a browser window.
 */
const ALLOWED: Record<string, string> = {
  'management.onDisabled': 'extension lifecycle, meaningless to a content script',
  'management.onEnabled': 'extension lifecycle, meaningless to a content script',
  'runtime.onInstalled': 'background event; a content script does not exist yet when it fires',
  'runtime.onStartup': 'background event, same reason',
  'runtime.onSuspend': 'background lifecycle',
  'runtime.onSuspendCanceled': 'background lifecycle',
  'runtime.onUpdateAvailable': 'background lifecycle',
  'runtime.reload': 'reloads the extension itself, not something a page may trigger',
  'tabs.TAB_ID_NONE': 'constant only used with the tab-management calls below',
  'tabs.executeScript': 'injecting into other tabs is an extension-page power',
  'tabs.onActivated': 'tab lifecycle, watched from extension pages',
  'tabs.onRemoved': 'tab lifecycle',
  'tabs.onUpdated': 'tab lifecycle',
  'tabs.reload': 'acting on other tabs',
  'windows.WINDOW_ID_CURRENT': 'constant for the window calls below',
  'windows.WINDOW_ID_NONE': 'constant for the window calls below',
  'windows.get': 'window management is an extension-page power',
  'windows.onCreated': 'window lifecycle',
  'windows.onFocusChanged': 'window lifecycle',
  'windows.onRemoved': 'window lifecycle',
  'windows.remove': 'window management',
  'windows.update': 'window management'
};

function loadPreload(file: string, href: string) {
  const captured = new Map<string, any>();
  const electron = {
    contextBridge: {
      exposeInMainWorld: (name: string, value: any) => captured.set(name, value),
      executeInMainWorld: () => {}
    },
    ipcRenderer: {
      invoke: async () => ({ ok: true }),
      sendSync: () => ({ keplr: false, leap: false, ethereum: false }),
      on: () => {},
      removeListener: () => {},
      sendToHost: () => {},
      send: () => {}
    },
    webFrame: { executeJavaScript: () => {}, insertCSS: () => {} }
  };

  const originalLoad = (Module as any)._load;
  (Module as any)._load = function (request: string) {
    if (request === 'electron') return electron;
    return originalLoad.apply(this, arguments as any);
  };

  const g = globalThis as any;
  g.window = g.window || {};
  g.window.location = { href };
  g.location = g.window.location;
  g.window.document = { title: 'parity', documentElement: {}, addEventListener() {} };
  g.document = g.window.document;

  try {
    const req = require as unknown as { resolve: (p: string) => string; cache: Record<string, unknown> };
    delete req.cache[req.resolve(file)];
    require(file);
  } finally {
    (Module as any)._load = originalLoad;
  }
  return captured;
}

/** namespace -> sorted member names. */
function shapeOf(api: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const ns of Object.keys(api || {})) {
    const value = api[ns];
    if (value && typeof value === 'object') out[ns] = Object.keys(value).sort();
  }
  return out;
}

// The webview shim only installs off a chrome-extension: page (it is for a
// guest on ordinary content); the extension one only on one.
const fromExtensionPage = loadPreload(
  '../../electron/preloads/extension-preload.cjs',
  'chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup.html'
);
const fromWebview = loadPreload(
  '../../electron/preloads/webview-preload.cjs',
  'http://127.0.0.1:8080/ipfs/bafyabc/'
);

const extensionApi = [...fromExtensionPage.values()].find((v) => v && typeof v === 'object' && v.runtime);
const webviewApi = fromWebview.get('chrome');

describe('the chrome shim in both preloads', () => {
  it('is actually installed in both contexts', () => {
    expect(extensionApi, 'extension-preload exposed no api').toBeTruthy();
    expect(webviewApi, 'webview-preload exposed no chrome').toBeTruthy();
  });

  it('offers the same namespaces', () => {
    expect(Object.keys(shapeOf(webviewApi)).sort()).toEqual(
      Object.keys(shapeOf(extensionApi)).sort()
    );
  });

  it('offers the same members, apart from the ones named above', () => {
    const a = shapeOf(extensionApi);
    const b = shapeOf(webviewApi);
    const unexpected: string[] = [];

    for (const ns of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const inExtension = a[ns] || [];
      const inWebview = b[ns] || [];
      for (const member of inExtension) {
        if (!inWebview.includes(member) && !ALLOWED[`${ns}.${member}`]) {
          unexpected.push(`${ns}.${member} - in extension-preload only`);
        }
      }
      for (const member of inWebview) {
        if (!inExtension.includes(member) && !ALLOWED[`${ns}.${member}`]) {
          unexpected.push(`${ns}.${member} - in webview-preload only`);
        }
      }
    }

    expect(unexpected, 'add it to the other shim, or to ALLOWED with a reason').toEqual([]);
  });

  it('has no entry in the list that stopped being a difference', () => {
    // Otherwise the list quietly becomes a backlog of things someone once
    // meant to reconcile. Same rule as check-tests' UNREACHABLE.
    const a = shapeOf(extensionApi);
    const b = shapeOf(webviewApi);
    const stale = Object.keys(ALLOWED).filter((entry) => {
      const [ns, member] = entry.split('.');
      const inExtension = (a[ns] || []).includes(member);
      const inWebview = (b[ns] || []).includes(member);
      return inExtension === inWebview;
    });
    expect(stale, 'these no longer differ - drop them from ALLOWED').toEqual([]);
  });

  it('does not carry a member Chrome has never had', () => {
    // runtime.onStateChanged lived here: an idle event copy-pasted onto
    // runtime, present in one shim and not the other. An extension adding a
    // listener to it got silence rather than an error.
    expect(Object.keys((webviewApi as any).runtime)).not.toContain('onStateChanged');
    expect(Object.keys((extensionApi as any).runtime)).not.toContain('onStateChanged');
  });
});
