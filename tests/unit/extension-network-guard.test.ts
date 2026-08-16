import { beforeEach, describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * The gate every extension request goes through.
 *
 * Extensions share `persist:lumen` with IPFS sites and the wallet shims, so
 * "which hosts may this extension talk to" is a real boundary rather than a
 * courtesy. It is enforced with webRequest listeners, and the thing that makes
 * it safe is the shape of its failure: when the decision cannot be made, the
 * request is cancelled. A guard that fails open is not a guard.
 */

type Http = {
  registerExtensionNetworkRequestGuard: (session: unknown) => boolean;
};

type Listener = (details: unknown, callback: (response: any) => void) => void;

let onBeforeRequest: Listener | null;
let onBeforeSendHeaders: Listener | null;
let filters: any[];
let http: Http;
/** Stands in for a window torn down while a request was in flight. */
let resolvingTheWindowThrows = false;

function fakeSession() {
  return {
    webRequest: {
      onBeforeRequest: (filter: any, fn: Listener) => {
        filters.push(filter);
        onBeforeRequest = fn;
      },
      onBeforeSendHeaders: (filter: any, fn: Listener) => {
        filters.push(filter);
        onBeforeSendHeaders = fn;
      }
    }
  };
}

/** Runs a listener and resolves with what it told Electron to do. */
function decide(listener: Listener, details: unknown): Promise<any> {
  return new Promise((resolve) => listener(details, resolve));
}

beforeEach(() => {
  onBeforeRequest = null;
  onBeforeSendHeaders = null;
  filters = [];
  resolvingTheWindowThrows = false;
  http = stubElectron({
    BrowserWindow: {
      getAllWindows: () => [],
      fromWebContents: () => null,
      getFocusedWindow: () => {
        if (resolvingTheWindowThrows) throw new Error('window is gone');
        return null;
      }
    },
    webContents: { fromId: () => null, getAllWebContents: () => [] }
  }).load<Http>('ipc/http.cjs');
});

describe('installing the guard', () => {
  it('watches both request stages, for http and websockets alike', () => {
    expect(http.registerExtensionNetworkRequestGuard(fakeSession())).toBe(true);
    expect(onBeforeRequest, 'onBeforeRequest').toBeTypeOf('function');
    expect(onBeforeSendHeaders, 'onBeforeSendHeaders').toBeTypeOf('function');
    // ws:// too: a socket is as good as a fetch for reaching a host.
    for (const filter of filters) {
      expect(filter.urls).toEqual(['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']);
    }
  });

  it('installs once per session, however often it is asked', () => {
    const session = fakeSession();
    expect(http.registerExtensionNetworkRequestGuard(session)).toBe(true);
    filters = [];
    expect(http.registerExtensionNetworkRequestGuard(session)).toBe(true);
    expect(filters, 'a second set of listeners would double every decision').toEqual([]);
  });

  it('says no when there is no session to guard', () => {
    expect(http.registerExtensionNetworkRequestGuard(null)).toBe(false);
    expect(http.registerExtensionNetworkRequestGuard({})).toBe(false);
  });
});

describe('deciding a request', () => {
  beforeEach(() => {
    http.registerExtensionNetworkRequestGuard(fakeSession());
  });

  it('lets an ordinary page through - the guard is about extensions', () => {
    // No extension behind it, so there is nothing to authorise. A guard that
    // cancelled here would break every site in the browser.
    return decide(onBeforeRequest!, {
      url: 'https://example.com/data.json',
      webContentsId: 1
    }).then((res) => expect(res.cancel).toBe(false));
  });

  it('cancels when deciding throws, rather than letting the request run', async () => {
    // A window torn down mid-request. The guard cannot know what the answer
    // would have been, and an extension reaching an unapproved host is worse
    // than a dropped request.
    resolvingTheWindowThrows = true;
    const res = await decide(onBeforeRequest!, { url: 'https://example.com/', webContentsId: 1 });
    expect(res.cancel).toBe(true);
  });

  it('allows a request it cannot attribute to any extension', async () => {
    // Worth stating plainly: "no extension behind this" and "cannot tell who
    // is behind this" are the same answer here - nine signals are checked
    // (initiator, origin, referrer, documentURL, frameUrl, the Origin and
    // Referer headers, webContentsId) and if none names an extension the
    // request goes through. That is what keeps ordinary browsing working; it
    // also means the gate depends on Electron labelling extension requests.
    // The cancel-on-throw above is a different path and does not cover this.
    for (const details of [null, undefined, { url: 'https://example.com/', webContentsId: NaN }]) {
      const res = await decide(onBeforeRequest!, details);
      expect(res.cancel, JSON.stringify(details ?? null)).toBe(false);
    }
  });

  it('keeps the request headers it was given when it allows one', async () => {
    const headers = { 'x-thing': '1' };
    const res = await decide(onBeforeSendHeaders!, {
      url: 'https://example.com/',
      requestHeaders: headers
    });
    expect(res.requestHeaders).toEqual(headers);
  });
});
