import { Module } from 'module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMock = {
  contextBridge: {
    exposeInMainWorld: vi.fn((name, value) => {
      globalThis.window = globalThis.window || {};
      Object.defineProperty(globalThis.window, name, {
        value,
        configurable: true,
        enumerable: true,
        writable: true
      });
    })
  },
  ipcRenderer: {
    invoke: vi.fn().mockResolvedValue({ ok: true }),
    sendSync: vi.fn().mockReturnValue({ ok: true }),
    on: vi.fn(),
    removeListener: vi.fn(),
    sendToHost: vi.fn()
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

describe('window.lumen preload API', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.window = globalThis.window || ({} as any);
    globalThis.window.location = { href: 'https://example.com/ipfs/QmTest' } as any;
    globalThis.window.document = { title: 'Lumen Test' } as any;
    globalThis.location = globalThis.window.location as any;
  });

  it('should expose window.lumen with expected function names', async () => {
    const restore = mockElectronRequire();
    try {
      await import('../../electron/webview-preload.cjs');
    } finally {
      restore();
    }

    expect(globalThis.window).toBeDefined();
    expect(globalThis.window.lumen).toBeDefined();

    const expectedEntries = [
      'SendToken',
      'Pin',
      'resolveUrl',
      'chooseStableLinkForLive',
      'setWindowFullscreen',
      'window.setFullscreen',
      'stableLinks.chooseForLive',
      'stableLinks.selectForLiveSetup',
      'stableLinks.publishForLive',
      'profiles.getActive',
      'ipfsAdd',
      'ipfsGet',
      'ipfsResolveIPNS',
      'ipfsPublishToIPNS',
      'pubsub.publish',
      'pubsub.subscribe',
      'wallet.requestSend',
      'wallet.signArbitrary',
      'wallet.verifyArbitrary'
    ];

    const getNestedValue = (root: any, path: string) => {
      return path.split('.').reduce((current, segment) => {
        return current && typeof current === 'object' ? current[segment] : undefined;
      }, root);
    };

    for (const path of expectedEntries) {
      const value = getNestedValue(globalThis.window.lumen, path);
      expect(value).toBeDefined();
      expect(typeof value).toBe('function');
    }
  });
});