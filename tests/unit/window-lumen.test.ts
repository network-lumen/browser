import { Module } from 'module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-ignore - .mjs, resolveJsonModule doesn't apply here
import { buildDocModel } from '../../scripts/generate-window-lumen-doc.mjs';

// ============================================================================
// Behavioral test suite for every method exposed on window.lumen (the object
// literal `const lumen = {...}` in electron/webview-preload.cjs).
//
// Each method is exercised for real: we mock only `ipcRenderer.invoke` (by
// IPC channel) and assert the exact channel + payload the method sends, and
// that its return value is mapped through the {ok, data?, error?} contract
// correctly. This is what backs the docs/window-lumen.json claims — see
// tests/unit/window-lumen-docs.test.ts for the complementary check that the
// committed docs are actually regenerated from this same source.
// ============================================================================

type InvokeResponse = { value?: any; reject?: any };
const invokeQueues = new Map<string, InvokeResponse[]>();

/** Queue the next response `ipcRenderer.invoke(channel, ...)` will resolve/reject with (FIFO per channel). */
function queueInvoke(channel: string, response: InvokeResponse) {
  const list = invokeQueues.get(channel) ?? [];
  list.push(response);
  invokeQueues.set(channel, list);
}

const electronMock = {
  contextBridge: {
    exposeInMainWorld: vi.fn((name: string, value: any) => {
      globalThis.window = globalThis.window || ({} as any);
      Object.defineProperty(globalThis.window, name, {
        value,
        configurable: true,
        enumerable: true,
        writable: true
      });
    }),
    executeInMainWorld: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn((channel: string, ..._args: any[]) => {
      const list = invokeQueues.get(channel);
      const next = list && list.length ? list.shift() : undefined;
      if (next && Object.prototype.hasOwnProperty.call(next, 'reject')) {
        return Promise.reject(next.reject);
      }
      return Promise.resolve(next?.value ?? { ok: true });
    }),
    sendSync: vi.fn().mockReturnValue({ keplr: false, leap: false, ethereum: false }),
    on: vi.fn(),
    removeListener: vi.fn(),
    sendToHost: vi.fn(),
    send: vi.fn()
  }
};

function mockElectronRequire() {
  const originalLoad = (Module as any)._load;
  (Module as any)._load = function (request: string, parent: any, isMain: boolean) {
    if (request === 'electron') return electronMock;
    return originalLoad.apply(this, arguments as any);
  };
  return () => {
    (Module as any)._load = originalLoad;
  };
}

/** Fresh import of webview-preload.cjs (module state doesn't leak between tests), returns window.lumen. */
async function loadLumen(): Promise<any> {
  const restore = mockElectronRequire();
  try {
    await import('../../electron/preloads/webview-preload.cjs');
  } finally {
    restore();
  }
  return (globalThis.window as any).lumen;
}

/** The last `ipcRenderer.invoke(...)` call, as `[channel, ...args]`. */
function lastInvokeCall(): any[] {
  const calls = electronMock.ipcRenderer.invoke.mock.calls;
  expect(calls.length, 'expected ipcRenderer.invoke to have been called').toBeGreaterThan(0);
  return calls[calls.length - 1] as any[];
}

beforeEach(() => {
  vi.resetModules();
  invokeQueues.clear();
  electronMock.ipcRenderer.invoke.mockClear();
  electronMock.ipcRenderer.sendSync.mockClear();
  electronMock.ipcRenderer.sendSync.mockReturnValue({ keplr: false, leap: false, ethereum: false });
  electronMock.ipcRenderer.on.mockClear();
  electronMock.ipcRenderer.removeListener.mockClear();
  electronMock.ipcRenderer.sendToHost.mockClear();
  electronMock.contextBridge.exposeInMainWorld.mockClear();

  globalThis.window = globalThis.window || ({} as any);
  (globalThis.window as any).location = { href: 'https://example.com/ipfs/QmTest' };
  (globalThis.window as any).document = { title: 'Lumen Test' };
  globalThis.location = (globalThis.window as any).location;
});

describe('window.lumen preload API', () => {
  it('exposes window.lumen on an /ipfs/* page', async () => {
    const lumen = await loadLumen();
    expect(lumen).toBeDefined();
  });

  // -- General -----------------------------------------------------------

  describe('Pin', () => {
    it('pins a plain CID string', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:pin', { value: { ok: true, cid: 'bafyXYZ' } });
      const result = await lumen.Pin('bafyXYZ');
      expect(result).toEqual({ ok: true, cid: 'bafyXYZ' });
      expect(lastInvokeCall()).toEqual([
        'lumenSite:pin',
        { cidOrUrl: 'bafyXYZ', name: '', title: 'Lumen Test' }
      ]);
    });

    it('pins an object input with a name', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:pin', { value: { ok: true } });
      await lumen.Pin({ cidOrUrl: 'bafyXYZ', name: 'my_file' });
      expect(lastInvokeCall()).toEqual([
        'lumenSite:pin',
        { cidOrUrl: 'bafyXYZ', name: 'my_file', title: 'Lumen Test' }
      ]);
    });

    it('rejects with missing_cid without calling the host when nothing is given', async () => {
      const lumen = await loadLumen();
      const result = await lumen.Pin('');
      expect(result).toEqual({ ok: false, error: 'missing_cid' });
      expect(electronMock.ipcRenderer.invoke).not.toHaveBeenCalledWith('lumenSite:pin', expect.anything());
    });

    it('reports host failures as {ok:false}', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:pin', { reject: new Error('user_cancelled') });
      const result = await lumen.Pin('bafyXYZ');
      expect(result).toEqual({ ok: false, error: 'user_cancelled' });
    });
  });

  describe('resolveUrl', () => {
    it('resolves a lumen://ipfs/<cid> URL via the local gateway base', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:getLocalGatewayBase', { value: 'http://127.0.0.1:8080' });
      const result = await lumen.resolveUrl('lumen://ipfs/bafyCID/index.html');
      expect(result).toEqual({ ok: true, data: 'http://127.0.0.1:8080/ipfs/bafyCID/index.html' });
    });

    it('resolves a bare /ipfs/... path via the local gateway base', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:getLocalGatewayBase', { value: 'http://127.0.0.1:8080' });
      const result = await lumen.resolveUrl('/ipfs/bafyCID/foo.txt');
      expect(result).toEqual({ ok: true, data: 'http://127.0.0.1:8080/ipfs/bafyCID/foo.txt' });
    });

    it('passes already-absolute http(s) URLs through unchanged, without calling the host', async () => {
      const lumen = await loadLumen();
      const result = await lumen.resolveUrl('https://example.com/x');
      expect(result).toEqual({ ok: true, data: 'https://example.com/x' });
      expect(electronMock.ipcRenderer.invoke).not.toHaveBeenCalled();
    });

    it('returns an empty string for empty input', async () => {
      const lumen = await loadLumen();
      const result = await lumen.resolveUrl('');
      expect(result).toEqual({ ok: true, data: '' });
    });
  });

  describe('getSiteDomain', () => {
    it('invokes lumenSite:getSiteDomain with no payload and data-wraps the result', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:getSiteDomain', { value: 'social.lumen.lmn' });
      const result = await lumen.getSiteDomain();
      expect(result).toEqual({ ok: true, data: 'social.lumen.lmn' });
      expect(lastInvokeCall()).toEqual(['lumenSite:getSiteDomain']);
    });

    it('resolves to an empty string when not viewed through a registered domain', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:getSiteDomain', { value: '' });
      const result = await lumen.getSiteDomain();
      expect(result).toEqual({ ok: true, data: '' });
    });
  });

  describe('setWindowFullscreen', () => {
    it('requests fullscreen on', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:setFullscreen', { value: { ok: true } });
      await lumen.setWindowFullscreen(true);
      expect(lastInvokeCall()).toEqual(['lumenSite:setFullscreen', { active: true }]);
    });

    it('coerces the active flag to a boolean', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:setFullscreen', { value: { ok: true } });
      await lumen.setWindowFullscreen(0 as any);
      expect(lastInvokeCall()).toEqual(['lumenSite:setFullscreen', { active: false }]);
    });

    it('reports host failures as {ok:false}', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:setFullscreen', { reject: new Error('denied') });
      const result = await lumen.setWindowFullscreen(true);
      expect(result).toEqual({ ok: false, error: 'denied' });
    });
  });

  describe('ipfsAdd', () => {
    it('defaults the filename to site-data.json', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:add', { value: { ok: true, cid: 'bafyADD' } });
      const result = await lumen.ipfsAdd('hello world');
      expect(result).toEqual({ ok: true, cid: 'bafyADD' });
      expect(lastInvokeCall()).toEqual(['ipfs:add', 'hello world', 'site-data.json']);
    });

    it('accepts a custom filename', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:add', { value: { ok: true } });
      await lumen.ipfsAdd('hello', 'note.txt');
      expect(lastInvokeCall()).toEqual(['ipfs:add', 'hello', 'note.txt']);
    });
  });

  describe('ipfsGet', () => {
    it('gets content by cid with options', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:get', { value: { ok: true, data: 'abc' } });
      await lumen.ipfsGet('bafyGET', { encoding: 'utf8' });
      expect(lastInvokeCall()).toEqual(['ipfs:get', 'bafyGET', { encoding: 'utf8' }]);
    });

    it('defaults options to {}', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:get', { value: { ok: true } });
      await lumen.ipfsGet('bafyGET');
      expect(lastInvokeCall()).toEqual(['ipfs:get', 'bafyGET', {}]);
    });
  });

  describe('ipfsResolveIPNS', () => {
    it('resolves an ipns name', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:resolveIPNS', { value: { ok: true, path: '/ipfs/bafyXYZ' } });
      const result = await lumen.ipfsResolveIPNS('k51q...');
      expect(result).toEqual({ ok: true, path: '/ipfs/bafyXYZ' });
      expect(lastInvokeCall()).toEqual(['ipfs:resolveIPNS', 'k51q...']);
    });
  });

  describe('ipfsPublishToIPNS', () => {
    it('publishes a cid under an ipns key, forwarding extra options', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:publishToIPNS', { value: { ok: true } });
      await lumen.ipfsPublishToIPNS('bafyPUB', 'my-key', { lifetime: '24h' });
      expect(lastInvokeCall()).toEqual([
        'ipfs:publishToIPNS',
        'bafyPUB',
        'my-key',
        { lifetime: '24h', autoCreateKey: true }
      ]);
    });

    it('always forces autoCreateKey:true, even if the caller tries to disable it', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:publishToIPNS', { value: { ok: true } });
      await lumen.ipfsPublishToIPNS('bafyPUB', 'my-key', { autoCreateKey: false });
      expect(lastInvokeCall()[3]).toEqual({ autoCreateKey: true });
    });
  });

  // -- stableLinks ---------------------------------------------------------

  describe('stableLinks.chooseForLive', () => {
    it('sends title/suggestedName/records to the host', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:stableLinkForLive', { value: { ok: true, keyName: 'stable:my-show' } });
      const result = await lumen.stableLinks.chooseForLive({
        title: 'My Show',
        suggestedName: 'my-show',
        records: [{ key: 'cid', value: 'bafyXYZ' }]
      });
      expect(result).toEqual({ ok: true, keyName: 'stable:my-show' });
      expect(lastInvokeCall()).toEqual([
        'lumenSite:stableLinkForLive',
        { title: 'My Show', suggestedName: 'my-show', records: [{ key: 'cid', value: 'bafyXYZ' }] }
      ]);
    });

    it('falls back to document.title and empty records when nothing is given', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:stableLinkForLive', { value: { ok: true } });
      await lumen.stableLinks.chooseForLive({});
      expect(lastInvokeCall()).toEqual([
        'lumenSite:stableLinkForLive',
        { title: 'Lumen Test', suggestedName: '', records: [] }
      ]);
    });
  });

  describe('stableLinks.selectForLiveSetup', () => {
    it('sends title to the host', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:stableLinkSetup', { value: { ok: true } });
      await lumen.stableLinks.selectForLiveSetup({ title: 'Custom' });
      expect(lastInvokeCall()).toEqual(['lumenSite:stableLinkSetup', { title: 'Custom' }]);
    });
  });

  describe('stableLinks.publishForLive', () => {
    it('sends keyName/records to the host', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:publishStableLinkForLive', { value: { ok: true } });
      await lumen.stableLinks.publishForLive({
        keyName: 'stable:x',
        records: [{ key: 'cid', value: 'bafy1' }]
      });
      expect(lastInvokeCall()).toEqual([
        'lumenSite:publishStableLinkForLive',
        { title: 'Lumen Test', keyName: 'stable:x', records: [{ key: 'cid', value: 'bafy1' }] }
      ]);
    });
  });

  describe('siteData.get', () => {
    it('invokes lumenSite:siteDataGet with no payload', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:siteDataGet', { value: { ok: true, exists: true, datas: { name: 'Ben' } } });
      const result = await lumen.siteData.get();
      expect(result).toEqual({ ok: true, exists: true, datas: { name: 'Ben' } });
      expect(lastInvokeCall()).toEqual(['lumenSite:siteDataGet']);
    });

    it('reports exists:false when no record has been published yet', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:siteDataGet', { value: { ok: true, exists: false } });
      const result = await lumen.siteData.get();
      expect(result).toEqual({ ok: true, exists: false });
    });
  });

  describe('siteData.publish', () => {
    it('sends datas to the host', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:siteDataPublish', { value: { ok: true, keyName: 'sitedata:abc', ipnsName: 'k51...' } });
      const result = await lumen.siteData.publish({ name: 'Ben' });
      expect(result).toEqual({ ok: true, keyName: 'sitedata:abc', ipnsName: 'k51...' });
      expect(lastInvokeCall()).toEqual([
        'lumenSite:siteDataPublish',
        { datas: { name: 'Ben' } }
      ]);
    });

    it('falls back to an empty datas object when nothing is given', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:siteDataPublish', { value: { ok: true } });
      await lumen.siteData.publish();
      expect(lastInvokeCall()).toEqual([
        'lumenSite:siteDataPublish',
        { datas: {} }
      ]);
    });
  });

  // -- profiles --------------------------------------------------------------

  describe('profiles.getActive', () => {
    it('invokes profiles:getActive with no payload and trims the result to {id, name, walletAddress}', async () => {
      const lumen = await loadLumen();
      queueInvoke('profiles:getActive', {
        value: {
          id: 'p1',
          name: 'MyName',
          walletAddress: 'lmn1x',
          role: 'user',
          favourites: { 'example.com': 'bafy...' },
          avatarDataUrl: 'data:image/png;base64,xyz',
          colorIndex: 3,
        },
      });
      const result = await lumen.profiles.getActive();
      expect(result).toEqual({ ok: true, data: { id: 'p1', name: 'MyName', walletAddress: 'lmn1x' } });
      expect(lastInvokeCall()).toEqual(['profiles:getActive']);
    });

    it('never leaks role/favourites/avatarDataUrl/colorIndex to site content', async () => {
      const lumen = await loadLumen();
      queueInvoke('profiles:getActive', {
        value: {
          id: 'p1',
          name: 'MyName',
          walletAddress: 'lmn1x',
          role: 'admin',
          favourites: { 'other-site.example': 'bafyabc' },
          avatarDataUrl: 'data:image/png;base64,xyz',
          colorIndex: 2,
        },
      });
      const result = await lumen.profiles.getActive();
      expect(result.data).not.toHaveProperty('role');
      expect(result.data).not.toHaveProperty('favourites');
      expect(result.data).not.toHaveProperty('avatarDataUrl');
      expect(result.data).not.toHaveProperty('colorIndex');
    });
  });

  // -- pubsub ------------------------------------------------------------

  describe('pubsub.publish', () => {
    it('publishes text data (default encoding)', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:pubsub:publish', { value: { ok: true } });
      await lumen.pubsub.publish('news', 'hello');
      expect(lastInvokeCall()).toEqual([
        'ipfs:pubsub:publish',
        { topic: 'news', encoding: 'text', data: 'hello' }
      ]);
    });

    it('publishes object data as json, stringified', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:pubsub:publish', { value: { ok: true } });
      await lumen.pubsub.publish('news', { hello: 'world' });
      expect(lastInvokeCall()).toEqual([
        'ipfs:pubsub:publish',
        { topic: 'news', encoding: 'json', data: JSON.stringify({ hello: 'world' }) }
      ]);
    });

    it('publishes Uint8Array data as base64 when encoding is binary', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:pubsub:publish', { value: { ok: true } });
      const bytes = new Uint8Array([1, 2, 3]);
      await lumen.pubsub.publish('news', bytes, { encoding: 'binary' });
      expect(lastInvokeCall()).toEqual([
        'ipfs:pubsub:publish',
        { topic: 'news', encoding: 'binary', dataB64: Buffer.from(bytes).toString('base64') }
      ]);
    });
  });

  describe('pubsub.subscribe', () => {
    it('subscribes and returns a handle that delivers messages and unsubscribes cleanly', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:pubsub:subscribe', { value: { ok: true, subId: 'sub-1', topics: ['news'] } });
      queueInvoke('ipfs:pubsub:unsubscribe', { value: { ok: true } });

      const onMessage = vi.fn();
      const result = await lumen.pubsub.subscribe('news', { encoding: 'json' }, onMessage);

      expect(result.ok).toBe(true);
      const handle = result.data;
      expect(handle.getSubId()).toBe('sub-1');
      expect(handle.getTopics()).toEqual(['news']);
      expect(handle.getState()).toBe('connected');

      // Simulate an incoming pubsub message via the handler registered through ipcRenderer.on.
      const onCall = electronMock.ipcRenderer.on.mock.calls.find(
        ([channel]) => channel === 'ipfs:pubsub:message'
      );
      expect(onCall, 'expected a listener registered for ipfs:pubsub:message').toBeDefined();
      const messageHandler = onCall![1];
      messageHandler(null, { subId: 'sub-1', json: { hello: 'world' } });
      expect(onMessage).toHaveBeenCalledWith({ subId: 'sub-1', json: { hello: 'world' } });

      await handle.unsubscribe();
      const unsubCall = electronMock.ipcRenderer.invoke.mock.calls.find(
        ([channel]) => channel === 'ipfs:pubsub:unsubscribe'
      );
      expect(unsubCall).toEqual(['ipfs:pubsub:unsubscribe', 'sub-1']);
    });

    it('resolves {ok:false} when the initial subscribe call fails', async () => {
      const lumen = await loadLumen();
      queueInvoke('ipfs:pubsub:subscribe', { value: { ok: false, error: 'too_many_subscriptions' } });
      const result = await lumen.pubsub.subscribe('news', {});
      expect(result).toEqual({ ok: false, error: 'too_many_subscriptions' });
    });
  });

  // -- wallet --------------------------------------------------------------

  describe('wallet.requestSend', () => {
    it('sends the canonical {to, memo, amount_lmn} fields', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:sendToken', { value: { ok: true, transactionHash: 'ABC' } });
      const result = await lumen.wallet.requestSend({ to: 'lmn1abc', memo: 'hi', amount_lmn: 2.5 });
      expect(result).toEqual({ ok: true, transactionHash: 'ABC' });
      expect(lastInvokeCall()).toEqual([
        'lumenSite:sendToken',
        { to: 'lmn1abc', memo: 'hi', amountLmn: 2.5, title: 'Lumen Test' }
      ]);
    });

    it('does NOT accept legacy alias keys (recipient/note/amountLmn/amount) anymore', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:sendToken', { value: { ok: true } });
      await lumen.wallet.requestSend({
        recipient: 'lmn1shouldnotcount',
        note: 'ignored',
        amountLmn: 9,
        amount: 9
      });
      expect(lastInvokeCall()).toEqual([
        'lumenSite:sendToken',
        { to: '', memo: '', amountLmn: null, title: 'Lumen Test' }
      ]);
    });

    it('reports host failures as {ok:false}', async () => {
      const lumen = await loadLumen();
      queueInvoke('lumenSite:sendToken', { reject: new Error('user_denied') });
      const result = await lumen.wallet.requestSend({ to: 'lmn1abc' });
      expect(result).toEqual({ ok: false, error: 'user_denied' });
    });
  });

  describe('wallet.signArbitrary', () => {
    it('signs with the default ADR-036 algo', async () => {
      const lumen = await loadLumen();
      queueInvoke('wallet:signArbitrary', { value: { ok: true, signatureB64: 'sig' } });
      await lumen.wallet.signArbitrary({ address: 'lmn1x', payload: 'hello' });
      expect(lastInvokeCall()).toEqual([
        'wallet:signArbitrary',
        { profileId: '', address: 'lmn1x', algo: 'ADR-036', payload: 'hello' }
      ]);
    });

    it('accepts an explicit algo override', async () => {
      const lumen = await loadLumen();
      queueInvoke('wallet:signArbitrary', { value: { ok: true } });
      await lumen.wallet.signArbitrary({ address: 'lmn1x', payload: 'hello', algo: 'custom' });
      expect(lastInvokeCall()).toEqual([
        'wallet:signArbitrary',
        { profileId: '', address: 'lmn1x', algo: 'custom', payload: 'hello' }
      ]);
    });
  });

  describe('wallet.verifyArbitrary', () => {
    it('verifies a signature', async () => {
      const lumen = await loadLumen();
      queueInvoke('wallet:verifyArbitrary', { value: { ok: true, signatureValid: true } });
      const result = await lumen.wallet.verifyArbitrary({
        payload: 'hello',
        signatureB64: 'sig',
        pubkeyB64: 'pub',
        address: 'lmn1x'
      });
      expect(result).toEqual({ ok: true, signatureValid: true });
      expect(lastInvokeCall()).toEqual([
        'wallet:verifyArbitrary',
        { algo: 'ADR-036', payload: 'hello', signatureB64: 'sig', pubkeyB64: 'pub', address: 'lmn1x' }
      ]);
    });
  });

  // -- dns -------------------------------------------------------------------

  describe('dns.getDomainPrice', () => {
    it('estimates the registration price for a domain', async () => {
      const lumen = await loadLumen();
      queueInvoke('dns:estimateRegisterPrice', {
        value: { ok: true, denom: 'ulmn', amount: '5000000', amountNumber: 5_000_000, amountLMN: 5 }
      });
      const result = await lumen.dns.getDomainPrice('monsite.lmn');
      expect(result).toEqual({
        ok: true,
        denom: 'ulmn',
        amount: '5000000',
        amountNumber: 5_000_000,
        amountLMN: 5
      });
      expect(lastInvokeCall()).toEqual(['dns:estimateRegisterPrice', { name: 'monsite.lmn' }]);
    });

    it('rejects with missing_domain without calling the host when nothing is given', async () => {
      const lumen = await loadLumen();
      const result = await lumen.dns.getDomainPrice('');
      expect(result).toEqual({ ok: false, error: 'missing_domain' });
      expect(electronMock.ipcRenderer.invoke).not.toHaveBeenCalledWith(
        'dns:estimateRegisterPrice',
        expect.anything()
      );
    });

    it('surfaces chain-side pricing failures as {ok:false}', async () => {
      const lumen = await loadLumen();
      queueInvoke('dns:estimateRegisterPrice', {
        value: { ok: false, error: 'dns_params_unavailable' }
      });
      const result = await lumen.dns.getDomainPrice('monsite.lmn');
      expect(result).toEqual({ ok: false, error: 'dns_params_unavailable' });
    });
  });

  describe('dns.getDomainInfos', () => {
    it('fetches the raw on-chain record for a domain', async () => {
      const lumen = await loadLumen();
      const onchainRecord = { owner: 'lmn1abc', expiry: '2027-01-01T00:00:00Z', records: [] };
      queueInvoke('dns:getDomainInfo', { value: { ok: true, data: onchainRecord } });
      const result = await lumen.dns.getDomainInfos('monsite.lmn');
      expect(result).toEqual({ ok: true, data: onchainRecord });
      expect(lastInvokeCall()).toEqual(['dns:getDomainInfo', 'monsite.lmn']);
    });

    it('rejects with missing_domain without calling the host when nothing is given', async () => {
      const lumen = await loadLumen();
      const result = await lumen.dns.getDomainInfos('');
      expect(result).toEqual({ ok: false, error: 'missing_domain' });
      expect(electronMock.ipcRenderer.invoke).not.toHaveBeenCalledWith(
        'dns:getDomainInfo',
        expect.anything()
      );
    });

    it('surfaces host/REST failures as {ok:false}', async () => {
      const lumen = await loadLumen();
      queueInvoke('dns:getDomainInfo', { value: { ok: false, error: 'rest_base_missing' } });
      const result = await lumen.dns.getDomainInfos('monsite.lmn');
      expect(result).toEqual({ ok: false, error: 'rest_base_missing' });
    });
  });

  // -- security boundary ---------------------------------------------------

  describe('site gating (ensureLumenSite)', () => {
    const NOT_AVAILABLE =
      'window.lumen is only available on lumen:// sites and /ipfs/* or /ipns/* pages.';

    const cases: [string, (lumen: any) => Promise<any>][] = [
      ['Pin', (l) => l.Pin('bafy')],
      ['resolveUrl', (l) => l.resolveUrl('/ipfs/x')],
      ['getSiteDomain', (l) => l.getSiteDomain()],
      ['setWindowFullscreen', (l) => l.setWindowFullscreen(true)],
      ['ipfsAdd', (l) => l.ipfsAdd('x')],
      ['ipfsGet', (l) => l.ipfsGet('x')],
      ['ipfsResolveIPNS', (l) => l.ipfsResolveIPNS('x')],
      ['ipfsPublishToIPNS', (l) => l.ipfsPublishToIPNS('x', 'k')],
      ['stableLinks.chooseForLive', (l) => l.stableLinks.chooseForLive({})],
      ['stableLinks.selectForLiveSetup', (l) => l.stableLinks.selectForLiveSetup({})],
      ['stableLinks.publishForLive', (l) => l.stableLinks.publishForLive({})],
      ['siteData.get', (l) => l.siteData.get()],
      ['siteData.publish', (l) => l.siteData.publish({ name: 'x' })],
      ['profiles.getActive', (l) => l.profiles.getActive()],
      ['pubsub.publish', (l) => l.pubsub.publish('t', 'x')],
      ['pubsub.subscribe', (l) => l.pubsub.subscribe('t', {})],
      ['wallet.requestSend', (l) => l.wallet.requestSend({ to: 'x' })],
      ['wallet.signArbitrary', (l) => l.wallet.signArbitrary({ payload: 'x' })],
      ['wallet.verifyArbitrary', (l) => l.wallet.verifyArbitrary({ payload: 'x' })],
      ['dns.getDomainPrice', (l) => l.dns.getDomainPrice('monsite.lmn')],
      ['dns.getDomainInfos', (l) => l.dns.getDomainInfos('monsite.lmn')],
      ['siteData.exportKey', (l) => l.siteData.exportKey()],
      ['siteData.importKey', (l) => l.siteData.importKey()]
    ];

    // The list above is hand-written, so nothing stopped a newly added method
    // from silently skipping the gating check below - which is exactly what
    // happened when siteData.exportKey/importKey were added. Deriving the
    // expected set from the real API makes that omission a failure instead.
    it('covers every window.lumen method — the gating list cannot go stale', async () => {
      const lumen = await loadLumen();
      const actual = new Set<string>();
      const walk = (obj: any, prefix: string) => {
        for (const key of Object.keys(obj)) {
          const value = obj[key];
          const entryPath = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'function') actual.add(entryPath);
          else if (value && typeof value === 'object') walk(value, entryPath);
        }
      };
      walk(lumen, '');
      expect(cases.map(([name]) => name).sort()).toEqual([...actual].sort());
    });

    it('keeps the API available on a lumen:// domain site', async () => {
      const lumen = await loadLumen();
      // Domain sites are served by the app's own lumen:// handler, which only
      // answers for registered domains - so being here is the proof. This
      // regressed once already: the API was gated to gateway URLs only, and
      // every call on a domain site silently returned the gating error.
      (globalThis.window as any).location.href = 'lumen://monsite.lmn/';
      queueInvoke('lumenSite:getSiteDomain', { value: 'monsite.lmn' });
      const result = await lumen.getSiteDomain();
      expect(result).not.toEqual({ ok: false, error: NOT_AVAILABLE });
    });

    it('still refuses a lumen: url with no host', async () => {
      const lumen = await loadLumen();
      (globalThis.window as any).location.href = 'lumen://';
      const result = await lumen.getSiteDomain();
      expect(result).toEqual({ ok: false, error: NOT_AVAILABLE });
    });

    it.each(cases)('%s rejects with the site-gating error off /ipfs//ipns pages', async (_name, call) => {
      const lumen = await loadLumen();
      // Simulate the tab navigating away from the ipfs/ipns page after
      // window.lumen was captured — every method must re-check on each call.
      (globalThis.window as any).location.href = 'https://example.com/not-ipfs';
      const result = await call(lumen);
      expect(result).toEqual({ ok: false, error: NOT_AVAILABLE });
    });
  });

  // -- doc/implementation parity ------------------------------------------

  describe('parity with docs/window-lumen.json', () => {
    it('exposes exactly the methods the freshly-generated docs claim — no more, no less', async () => {
      const lumen = await loadLumen();
      const model = buildDocModel();

      const getAt = (obj: any, entryPath: string) =>
        entryPath
          .split('.')
          .reduce((cur: any, seg: string) => (cur && typeof cur === 'object' ? cur[seg] : undefined), obj);

      for (const entry of model.entries) {
        const value = getAt(lumen, entry.path);
        expect(value, `window.lumen.${entry.path} should exist and be a function`).toBeTypeOf('function');
      }

      const documented = new Set<string>(model.entries.map((e: { path: string }) => e.path));
      const actual = new Set<string>();
      const walk = (obj: any, prefix: string) => {
        for (const key of Object.keys(obj)) {
          const value = obj[key];
          const entryPath = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'function') actual.add(entryPath);
          else if (value && typeof value === 'object') walk(value, entryPath);
        }
      };
      walk(lumen, '');

      expect([...actual].sort()).toEqual([...documented].sort());
    });
  });
});
