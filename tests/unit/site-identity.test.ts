import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Who the browser thinks is calling.
 *
 * This is the frontier: every permission, every stored "always allow", every
 * site-data record is keyed on what these functions return. A site that could
 * influence the answer could act as another one - spend its allowance, read
 * its data, publish under its identity.
 *
 * The rule is that identity comes from the URL the sender's webContents is on
 * right now, and from a domain map only the trusted renderer can write to.
 * Nothing a page says about itself is an input.
 */

type Actions = {
  deriveSiteKeyFromHref: (href: unknown) => string | null;
  senderSiteContext: (evt: unknown) => { ok: boolean; error?: string; siteKey?: string; href?: string };
  isSenderSiteContextStillValid: (ctx: unknown) => boolean;
  forgetSiteWebContents: (id: number) => void;
  registerSiteIpc: () => void;
};

const handlers = new Map<string, (...args: any[]) => any>();
let actions: Actions;
let uiWebContents: unknown;

/** A <webview> guest: the only sender a site action will look at. */
function guest(url: string, id = 42) {
  return {
    id,
    getType: () => 'webview',
    getURL: () => url,
    isDestroyed: () => false
  };
}

beforeEach(() => {
  handlers.clear();
  uiWebContents = { id: 1, isDestroyed: () => false, send: () => {} };
  const stub = stubElectron({
    ipcMain: {
      handle: (c: string, fn: (...a: any[]) => any) => handlers.set(c, fn),
      on: (c: string, fn: (...a: any[]) => any) => handlers.set(c, fn),
      removeHandler: () => {}
    },
    BrowserWindow: {
      getAllWindows: () => [{ webContents: uiWebContents }],
      fromWebContents: () => null,
      getFocusedWindow: () => null
    }
  });
  actions = stub.load<Actions>('sites/actions.cjs');
  actions.registerSiteIpc();
});

/** Pretends to be SitePage.vue registering a domain for a webview. */
function registerDomain(webContentsId: number, host: string) {
  handlers.get('site:registerDomainTarget')!({ sender: uiWebContents }, webContentsId, host);
}

describe('deriving a site key from a URL', () => {
  it('reads a path-style gateway URL', () => {
    expect(actions.deriveSiteKeyFromHref('http://127.0.0.1:8080/ipfs/bafyabc/index.html')).toBe(
      'ipfs:bafyabc'
    );
    expect(actions.deriveSiteKeyFromHref('http://127.0.0.1:8080/ipns/k51xyz/')).toBe('ipns:k51xyz');
  });

  it('reads a subdomain gateway URL', () => {
    expect(actions.deriveSiteKeyFromHref('http://bafyabc.ipfs.localhost:8080/')).toBe('ipfs:bafyabc');
    expect(actions.deriveSiteKeyFromHref('http://k51xyz.ipns.localhost:8080/x')).toBe('ipns:k51xyz');
  });

  it('refuses a URL with no ipfs/ipns path or subdomain', () => {
    for (const href of ['lumen://newtab', 'about:blank', 'https://example.com/', '', null]) {
      expect(actions.deriveSiteKeyFromHref(href), String(href)).toBeNull();
    }
  });

  it('refuses a foreign origin, whatever its path says', () => {
    // The impersonation this closes: an ordinary website whose path is
    // /ipfs/<cid> used to be handed that cid's identity - its stored "always
    // allow", its site data - and webview-preload's gate tested the same path,
    // so the page also got window.lumen. The attacker chose which site to
    // impersonate by choosing a path on their own domain.
    expect(actions.deriveSiteKeyFromHref('https://evil.example/ipfs/bafyabc/')).toBeNull();
    expect(actions.deriveSiteKeyFromHref('https://ipfs.io/ipfs/bafyabc/')).toBeNull();
    expect(actions.deriveSiteKeyFromHref('chrome-extension://abc/ipfs/bafy')).toBeNull();
    // Subdomain form on someone else's host, which reads convincingly.
    expect(actions.deriveSiteKeyFromHref('https://bafyabc.ipfs.evil.example/')).toBeNull();
  });

  it('accepts the addresses this app serves from', () => {
    for (const href of [
      'http://127.0.0.1:8080/ipfs/bafyabc/',
      'http://localhost:5001/ipfs/bafyabc/',
      'http://bafyabc.ipfs.localhost:8080/',
      'http://social.lumen.lmn.localhost:8080/ipfs/bafyabc/'
    ]) {
      expect(actions.deriveSiteKeyFromHref(href), href).toBe('ipfs:bafyabc');
    }
  });

  it('does not key a windows file path that merely contains ipfs', () => {
    expect(actions.deriveSiteKeyFromHref('file:///c:/tmp/ipfs/bafyabc')).toBeNull();
  });
});

describe('the origin rule, which exists twice', () => {
  // webview-preload decides whether to expose window.lumen; sites/actions
  // decides which site is calling. Both have to agree, and the preload cannot
  // require the shared copy - a sandboxed preload that requires a local file
  // stops loading, silently. So the rule is duplicated on purpose, and this is
  // what stops the two from drifting.
  const predicate =
    /host === '127\.0\.0\.1' \|\|\s*host === '::1' \|\|\s*host === 'localhost' \|\|\s*host\.endsWith\('\.localhost'\)/;

  it('is the same expression in the main process and in the preload', () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    expect(read('electron/sites/actions.cjs')).toMatch(predicate);
    expect(read('electron/preloads/webview-preload.cjs')).toMatch(predicate);
  });
});

describe('deciding which site a call came from', () => {
  it('answers for a webview on a gateway URL', () => {
    const ctx = actions.senderSiteContext({ sender: guest('http://127.0.0.1:8080/ipfs/bafyabc/') });
    expect(ctx).toMatchObject({ ok: true, siteKey: 'ipfs:bafyabc' });
  });

  it('refuses a sender that is not a webview', () => {
    // The app's own window reaching a site channel would otherwise be granted
    // whatever site key its URL happened to derive to.
    const notGuest = { ...guest('http://127.0.0.1:8080/ipfs/bafyabc/'), getType: () => 'window' };
    expect(actions.senderSiteContext({ sender: notGuest })).toMatchObject({
      ok: false,
      error: 'not_webview'
    });
  });

  it('refuses a destroyed sender', () => {
    const dead = { ...guest('http://127.0.0.1:8080/ipfs/bafyabc/'), isDestroyed: () => true };
    expect(actions.senderSiteContext({ sender: dead })).toMatchObject({ ok: false });
  });

  it('prefers the registered Lumen domain over the resolved address', () => {
    registerDomain(42, 'social.lumen.lmn');
    const ctx = actions.senderSiteContext({ sender: guest('http://127.0.0.1:8080/ipfs/bafyabc/') });
    expect(ctx.siteKey).toBe('domain:social.lumen.lmn');
  });

  it('only lets the trusted window register a domain', () => {
    // A page reaching this channel could otherwise claim any webContents
    // belongs to a domain of its choosing - which is the whole attack.
    handlers.get('site:registerDomainTarget')!(
      { sender: guest('http://127.0.0.1:8080/ipfs/attacker/') },
      42,
      'victim.lmn'
    );
    const ctx = actions.senderSiteContext({ sender: guest('http://127.0.0.1:8080/ipfs/bafyabc/') });
    expect(ctx.siteKey).toBe('ipfs:bafyabc');
  });

  it('forgets a domain when its webContents is gone', () => {
    // Ids are recycled: a stale entry would hand the next page this identity.
    registerDomain(42, 'social.lumen.lmn');
    actions.forgetSiteWebContents(42);
    const ctx = actions.senderSiteContext({ sender: guest('http://127.0.0.1:8080/ipfs/bafyabc/') });
    expect(ctx.siteKey).toBe('ipfs:bafyabc');
  });
});

describe('re-checking the site after an await', () => {
  it('holds while the page stays where it was', () => {
    const sender = guest('http://127.0.0.1:8080/ipfs/bafyabc/');
    const ctx = actions.senderSiteContext({ sender });
    expect(actions.isSenderSiteContextStillValid(ctx)).toBe(true);
  });

  it('fails once the page has navigated to another site', () => {
    // The reason every handler re-checks between awaits: a page can navigate
    // while its permission modal is open, and the user's "allow" must not be
    // applied to whoever moved in.
    let url = 'http://127.0.0.1:8080/ipfs/bafyabc/';
    const sender = { ...guest(url), getURL: () => url };
    const ctx = actions.senderSiteContext({ sender });
    url = 'http://127.0.0.1:8080/ipfs/somewhere-else/';
    expect(actions.isSenderSiteContextStillValid(ctx)).toBe(false);
  });

  it('fails once a domain is claimed mid-flight', () => {
    const sender = guest('http://127.0.0.1:8080/ipfs/bafyabc/');
    const ctx = actions.senderSiteContext({ sender });
    registerDomain(42, 'social.lumen.lmn');
    expect(actions.isSenderSiteContextStillValid(ctx)).toBe(false);
  });

  it('fails once the tab is closed', () => {
    let destroyed = false;
    const sender = { ...guest('http://127.0.0.1:8080/ipfs/bafyabc/'), isDestroyed: () => destroyed };
    const ctx = actions.senderSiteContext({ sender });
    destroyed = true;
    expect(actions.isSenderSiteContextStillValid(ctx)).toBe(false);
  });
});
