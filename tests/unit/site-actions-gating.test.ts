import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * What stops a site from asking too much, too fast, or twice at once.
 *
 * Three separate guards, each with its own failure mode: the per-site lock
 * keeps one action in flight so a page cannot stack modals, the cooldown puts
 * three seconds between them so it cannot spam the user into clicking, and the
 * stored decision means the second ask is silent only for the site that was
 * granted it.
 */

type Actions = {
  tryBeginSiteAction: (siteKey: unknown) => { ok: boolean; key?: string; error?: string };
  endSiteAction: (siteKey: unknown) => void;
  enforceSiteModalDelay: (siteKey: unknown) => Promise<void>;
  markSiteModalCooldown: (siteKey: unknown, ms?: number) => void;
  ensureLumenSitePermission: (
    siteKey: string,
    meta: unknown,
    kind: string,
    details?: unknown
  ) => Promise<{ ok: boolean; decision?: string; error?: string }>;
  isUiTabOpen: (tabId: unknown) => boolean;
  registerSiteIpc: () => void;
};

const handlers = new Map<string, (...args: any[]) => any>();
let actions: Actions;
let ui: { id: number; isDestroyed: () => boolean; send: (channel: string, payload: any) => void };
/** What the UI answers the next prompt, and what it was asked. */
let uiAnswer: unknown = null;
let uiAsked: any[] = [];

beforeEach(() => {
  handlers.clear();
  uiAsked = [];
  uiAnswer = { ok: true, decision: 'once' };
  ui = {
    id: 1,
    isDestroyed: () => false,
    send: (_channel: string, payload: any) => {
      uiAsked.push(payload);
      // The renderer answers on its own channel; replying synchronously is
      // close enough - the module only cares that the id comes back.
      queueMicrotask(() =>
        handlers.get('lumenSite:uiResponse')?.({ sender: ui }, { id: payload.id, response: uiAnswer })
      );
    }
  };
  const stub = stubElectron({
    ipcMain: {
      handle: (c: string, fn: (...a: any[]) => any) => handlers.set(c, fn),
      on: (c: string, fn: (...a: any[]) => any) => handlers.set(c, fn),
      removeHandler: () => {}
    },
    BrowserWindow: {
      getAllWindows: () => [{ webContents: ui }],
      fromWebContents: () => null,
      getFocusedWindow: () => null
    }
  });
  actions = stub.load<Actions>('sites/actions.cjs');
  actions.registerSiteIpc();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('one action at a time, per site', () => {
  it('refuses a second action while the first is in flight', () => {
    expect(actions.tryBeginSiteAction('ipfs:a').ok).toBe(true);
    expect(actions.tryBeginSiteAction('ipfs:a')).toMatchObject({ ok: false, error: 'busy' });
  });

  it('lets another site through - the lock is per site, not global', () => {
    actions.tryBeginSiteAction('ipfs:a');
    expect(actions.tryBeginSiteAction('ipfs:b').ok).toBe(true);
  });

  it('releases on end, including when the first action failed', () => {
    const lock = actions.tryBeginSiteAction('ipfs:a');
    actions.endSiteAction(lock.key);
    expect(actions.tryBeginSiteAction('ipfs:a').ok).toBe(true);
  });

  it('refuses an empty key rather than locking everything under one entry', () => {
    expect(actions.tryBeginSiteAction('')).toMatchObject({ ok: false, error: 'missing_siteKey' });
  });
});

describe('the cooldown between modals', () => {
  it('does not wait when the site has not just been prompted', async () => {
    const start = Date.now();
    await actions.enforceSiteModalDelay('ipfs:a');
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('waits out the remaining time after a prompt', async () => {
    actions.markSiteModalCooldown('ipfs:a', 120);
    const start = Date.now();
    await actions.enforceSiteModalDelay('ipfs:a');
    // Not the full 120: some of it has already elapsed. The point is that it
    // waited at all, and that it stopped waiting.
    expect(Date.now() - start).toBeGreaterThan(50);
  });

  it('holds one site back without holding another', async () => {
    actions.markSiteModalCooldown('ipfs:a', 5_000);
    const start = Date.now();
    await actions.enforceSiteModalDelay('ipfs:b');
    expect(Date.now() - start).toBeLessThan(50);
  });
});

describe('remembering a decision', () => {
  it('asks the user the first time', async () => {
    const res = await actions.ensureLumenSitePermission('ipfs:a', null, 'Save');
    expect(res).toMatchObject({ ok: true, decision: 'once' });
    expect(uiAsked).toHaveLength(1);
    expect(uiAsked[0]).toMatchObject({ type: 'permission' });
  });

  it('asks again after "once" - that is what once means', async () => {
    await actions.ensureLumenSitePermission('ipfs:a', null, 'Save');
    await actions.ensureLumenSitePermission('ipfs:a', null, 'Save');
    expect(uiAsked).toHaveLength(2);
  });

  it('stops asking after "always"', async () => {
    uiAnswer = { ok: true, decision: 'always' };
    await actions.ensureLumenSitePermission('ipfs:a', null, 'Save');
    const second = await actions.ensureLumenSitePermission('ipfs:a', null, 'Save');
    expect(uiAsked).toHaveLength(1);
    expect(second).toMatchObject({ ok: true, decision: 'always' });
  });

  it('remembers per site, so one grant does not cover another', async () => {
    uiAnswer = { ok: true, decision: 'always' };
    await actions.ensureLumenSitePermission('ipfs:a', null, 'Save');
    await actions.ensureLumenSitePermission('ipfs:b', null, 'Save');
    expect(uiAsked).toHaveLength(2);
  });

  it('covers every action kind once granted, which is worth knowing', async () => {
    // "Always allow" is stored per site, not per action: granted for Save, it
    // also skips the permission prompt for SendToken. What it does not skip is
    // the action's own modal - the send dialog still opens and still needs a
    // click, so this widens what a site may *ask*, not what it may do.
    // Pinned because it is the sharpest edge of the permission model.
    uiAnswer = { ok: true, decision: 'always' };
    await actions.ensureLumenSitePermission('ipfs:a', null, 'Save');
    await actions.ensureLumenSitePermission('ipfs:a', null, 'SendToken');
    expect(uiAsked).toHaveLength(1);
  });

  it('treats anything that is not once or always as a refusal', async () => {
    for (const answer of [{ ok: true, decision: 'deny' }, { ok: true }, { ok: true, decision: '' }]) {
      uiAnswer = answer;
      const res = await actions.ensureLumenSitePermission(`ipfs:${Math.random()}`, null, 'Save');
      expect(res).toMatchObject({ ok: false, error: 'user_denied' });
    }
  });

  it('refuses when there is no site key at all', async () => {
    expect(await actions.ensureLumenSitePermission('', null, 'Save')).toMatchObject({
      ok: false,
      error: 'missing_siteKey'
    });
    expect(uiAsked).toHaveLength(0);
  });
});

describe('knowing whether a tab is still open', () => {
  it('assumes open until the renderer has told us anything', () => {
    // Before the first tabs:state, saying "closed" would block every domain
    // site action during startup.
    expect(actions.isUiTabOpen('tab-1')).toBe(true);
  });

  it('follows the renderer once it has reported', () => {
    handlers.get('tabs:state')!({ sender: ui }, ['tab-1']);
    expect(actions.isUiTabOpen('tab-1')).toBe(true);
    expect(actions.isUiTabOpen('tab-2')).toBe(false);
  });

  it('ignores a report from anyone but the app window', () => {
    handlers.get('tabs:state')!({ sender: { id: 9 } }, ['tab-1']);
    // Still the startup default: the untrusted report changed nothing.
    expect(actions.isUiTabOpen('tab-2')).toBe(true);
  });
});
