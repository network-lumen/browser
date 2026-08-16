import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
  appSettingsState,
  getLocalGatewayBase,
  initAppSettings,
  setAppSettings,
} from '../../src/internal/services/appSettings';
import { DEFAULT_SECURITY_SESSION_TIMEOUT_MS } from '../../src/internal/services/securitySessionTimeout';

/**
 * The app-wide settings, and the normalisation between the stored value and
 * the one the app runs on.
 *
 * These come off disk, so every field has to survive being wrong: a gateway
 * base saved as `file://` or as free text must not become the URL the browser
 * fetches every page from, and an upload cap of `0` or `-1` must not make
 * every upload fail with nothing to explain it. The defaults are asserted
 * literally because they are the values a fresh install runs on.
 */

const DEFAULTS = {
  localGatewayBase: 'http://127.0.0.1:8080',
  ipfsApiBase: 'http://127.0.0.1:5001',
};

function bridge(api: Record<string, unknown>) {
  (window as any).lumen = api;
}

beforeEach(() => {
  appSettingsState.value = {
    localGatewayBase: DEFAULTS.localGatewayBase,
    ipfsApiBase: DEFAULTS.ipfsApiBase,
    ipfsConnectivityMode: 'normal',
    localDriveMaxUploadSizeGb: DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
    showSexualContent: false,
    showViolentContent: false,
    showDisturbingImagery: false,
    securitySessionTimeoutMs: DEFAULT_SECURITY_SESSION_TIMEOUT_MS,
  };
});

afterEach(() => {
  delete (window as any).lumen;
  vi.restoreAllMocks();
});

/** Runs a partial through the merge by way of the no-bridge path. */
async function normalized(partial: Record<string, unknown>) {
  delete (window as any).lumen;
  await setAppSettings(partial as never);
  return appSettingsState.value;
}

describe('the defaults a fresh install runs on', () => {
  it('point at the local node', () => {
    expect(appSettingsState.value.localGatewayBase).toBe(DEFAULTS.localGatewayBase);
    expect(appSettingsState.value.ipfsApiBase).toBe(DEFAULTS.ipfsApiBase);
    expect(appSettingsState.value.ipfsConnectivityMode).toBe('normal');
  });

  it('hide sensitive content until asked otherwise', () => {
    expect(appSettingsState.value.showSexualContent).toBe(false);
    expect(appSettingsState.value.showViolentContent).toBe(false);
    expect(appSettingsState.value.showDisturbingImagery).toBe(false);
  });
});

describe('normalising a base URL', () => {
  it('keeps a valid http or https base and drops its trailing slash', async () => {
    expect((await normalized({ localGatewayBase: 'http://10.0.0.2:8080/' })).localGatewayBase)
      .toBe('http://10.0.0.2:8080');
    expect((await normalized({ ipfsApiBase: 'https://api.test' })).ipfsApiBase)
      .toBe('https://api.test');
  });

  it('strips a query and a fragment, which a base has no use for', async () => {
    expect((await normalized({ localGatewayBase: 'http://x.test:8080/?a=1#b' })).localGatewayBase)
      .toBe('http://x.test:8080');
  });

  it('refuses a scheme the browser cannot fetch from', async () => {
    // Every page load goes through this value.
    for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'ftp://x.test']) {
      expect((await normalized({ localGatewayBase: bad })).localGatewayBase)
        .toBe(DEFAULTS.localGatewayBase);
    }
  });

  it('refuses free text and empties', async () => {
    for (const bad of ['not a url', '', '   ', null, undefined]) {
      expect((await normalized({ localGatewayBase: bad })).localGatewayBase)
        .toBe(DEFAULTS.localGatewayBase);
    }
  });
});

describe('normalising the connectivity mode', () => {
  it('accepts the three modes, in any case', async () => {
    expect((await normalized({ ipfsConnectivityMode: 'light' })).ipfsConnectivityMode).toBe('light');
    expect((await normalized({ ipfsConnectivityMode: 'HIGH' })).ipfsConnectivityMode).toBe('high');
  });

  it('falls back for anything else', async () => {
    for (const bad of ['turbo', '', null, 42]) {
      expect((await normalized({ ipfsConnectivityMode: bad })).ipfsConnectivityMode).toBe('normal');
    }
  });
});

describe('normalising the upload cap', () => {
  it('keeps a whole number of gigabytes', async () => {
    expect((await normalized({ localDriveMaxUploadSizeGb: 25 })).localDriveMaxUploadSizeGb).toBe(25);
    expect((await normalized({ localDriveMaxUploadSizeGb: '25' })).localDriveMaxUploadSizeGb).toBe(25);
    expect((await normalized({ localDriveMaxUploadSizeGb: 25.9 })).localDriveMaxUploadSizeGb).toBe(25);
  });

  it('refuses a cap that would reject every upload', async () => {
    // 0 or a negative here fails uploads with nothing to explain it.
    for (const bad of [0, -1, 0.4, NaN, 'lots', null]) {
      expect((await normalized({ localDriveMaxUploadSizeGb: bad })).localDriveMaxUploadSizeGb)
        .toBe(DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB);
    }
  });

  it('caps at what can still be counted in bytes', async () => {
    const value = (await normalized({ localDriveMaxUploadSizeGb: Number.MAX_SAFE_INTEGER }))
      .localDriveMaxUploadSizeGb;
    expect(value * 1024 ** 3).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});

describe('normalising the session timeout', () => {
  it('falls back for the retired five-minute value', async () => {
    expect((await normalized({ securitySessionTimeoutMs: 300_000 })).securitySessionTimeoutMs)
      .toBe(DEFAULT_SECURITY_SESSION_TIMEOUT_MS);
  });

  it('keeps null, which means until restart', async () => {
    expect((await normalized({ securitySessionTimeoutMs: null })).securitySessionTimeoutMs).toBeNull();
  });
});

describe('merging', () => {
  it('leaves the fields it was not given alone', async () => {
    await normalized({ ipfsConnectivityMode: 'high' });
    await normalized({ showSexualContent: true });
    expect(appSettingsState.value.ipfsConnectivityMode).toBe('high');
    expect(appSettingsState.value.showSexualContent).toBe(true);
  });

  it('coerces the toggles to real booleans', async () => {
    const next = await normalized({ showViolentContent: 1 as never });
    expect(next.showViolentContent).toBe(true);
  });
});

describe('setAppSettings', () => {
  it('sends the normalized settings and takes back what was stored', async () => {
    const settingsSet = vi.fn(async (payload: any) => ({ ok: true, settings: payload }));
    bridge({ settingsSet });
    const res = await setAppSettings({ ipfsConnectivityMode: 'light' } as never);
    expect(res.ok).toBe(true);
    expect(settingsSet.mock.calls[0][0]).toMatchObject({ ipfsConnectivityMode: 'light' });
    expect(appSettingsState.value.ipfsConnectivityMode).toBe('light');
  });

  it('still applies the change locally when there is no bridge', async () => {
    // Otherwise the toggle the user just moved springs back with no reason.
    delete (window as any).lumen;
    const res = await setAppSettings({ ipfsConnectivityMode: 'light' } as never);
    expect(res).toMatchObject({ ok: false, error: 'settings_unavailable' });
    expect(appSettingsState.value.ipfsConnectivityMode).toBe('light');
  });

  it('reports a failure from the main process rather than throwing', async () => {
    bridge({ settingsSet: async () => ({ ok: false, error: 'disk_full' }) });
    await expect(setAppSettings({} as never)).resolves.toMatchObject({ ok: false, error: 'disk_full' });
  });

  it('reports a rejected call rather than throwing', async () => {
    bridge({ settingsSet: async () => { throw new Error('ipc gone'); } });
    await expect(setAppSettings({} as never)).resolves.toMatchObject({ ok: false, error: 'ipc gone' });
  });
});

describe('initAppSettings', () => {
  it('loads what was stored and subscribes to later changes', async () => {
    const listeners: ((next: unknown) => void)[] = [];
    bridge({
      settingsGetAll: async () => ({ ok: true, settings: { ipfsConnectivityMode: 'high' } }),
      settingsOnChanged: (fn: (next: unknown) => void) => listeners.push(fn),
    });

    await initAppSettings();
    expect(appSettingsState.value.ipfsConnectivityMode).toBe('high');

    listeners[0]({ ipfsConnectivityMode: 'light' });
    expect(appSettingsState.value.ipfsConnectivityMode).toBe('light');
  });

  it('leaves the defaults in place when there is nothing to load', async () => {
    delete (window as any).lumen;
    await expect(initAppSettings()).resolves.toBeUndefined();
    expect(appSettingsState.value.localGatewayBase).toBe(DEFAULTS.localGatewayBase);
  });

  it('does not throw when the load fails', async () => {
    bridge({ settingsGetAll: async () => { throw new Error('nope'); } });
    await expect(initAppSettings()).resolves.toBeUndefined();
  });
});

describe('getLocalGatewayBase', () => {
  it('returns the base without a trailing slash', () => {
    appSettingsState.value.localGatewayBase = 'http://127.0.0.1:9090/';
    expect(getLocalGatewayBase()).toBe('http://127.0.0.1:9090');
  });

  it('falls back rather than returning an empty base', () => {
    appSettingsState.value.localGatewayBase = '' as never;
    expect(getLocalGatewayBase()).toBe(DEFAULTS.localGatewayBase);
  });
});
