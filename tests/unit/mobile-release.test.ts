import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Updating the app from the release list on chain, on Android.
 *
 * The rules for choosing a release are tested in release-selection.test.ts.
 * What is worth pinning here is the part that talks to the device: that the
 * artifact chosen is the one for its architecture, that an update is announced
 * once rather than on every poll, and that the sha256 the chain published is
 * handed to the installer rather than dropped - it is the only check standing
 * between a truncated download and the system installer.
 */
const chain = { releases: [] as unknown[], ok: true, asked: [] as string[] };

vi.mock('../../platform/mobile/impl/network', () => ({
  readState: async (path: string) => {
    chain.asked.push(path);
    return chain.ok
      ? { ok: true, status: 200, json: { releases: chain.releases } }
      : { ok: false, status: 503 };
  }
}));

const plugin = {
  installs: [] as { url: string; sha256Hex: string }[],
  progressHandlers: [] as ((p: unknown) => void)[],
  abiCalls: 0,
  fail: ''
};

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    abi: async () => {
      plugin.abiCalls += 1;
      return { abi: 'x86_64', arch: 'amd64', platform: 'android-amd64' };
    },
    downloadAndInstall: async (options: { url: string; sha256Hex: string }) => {
      plugin.installs.push(options);
      if (plugin.fail) throw new Error(plugin.fail);
      return { ok: true, bytes: 58_100_366 };
    },
    addListener: async (_event: string, handler: (p: unknown) => void) => {
      plugin.progressHandlers.push(handler);
      return { remove: async () => {} };
    }
  })
}));

const { RELEASE_MEMBERS, resetReleaseState } = await import('../../platform/mobile/impl/release');

/** A release as the chain lists one, with an artifact per architecture. */
const release = (over: Record<string, unknown> = {}) => ({
  id: 12,
  version: '9.9.9',
  channel: 'beta',
  status: 'VALIDATED',
  yanked: false,
  artifacts: [
    { platform: 'android-arm64', kind: 'browser', urls: ['https://cdn/arm64.apk'], sha256_hex: 'a'.repeat(64) },
    { platform: 'android-amd64', kind: 'browser', urls: ['https://cdn/amd64.apk'], sha256_hex: 'b'.repeat(64) },
    { platform: 'windows-amd64', kind: 'browser', urls: ['https://cdn/win.exe'], sha256_hex: 'c'.repeat(64) }
  ],
  ...over
});

describe('finding an update on chain', () => {
  beforeEach(() => {
    resetReleaseState();
    chain.releases = [];
    chain.ok = true;
    chain.asked = [];
    plugin.installs = [];
    plugin.progressHandlers = [];
    plugin.abiCalls = 0;
    plugin.fail = '';
  });

  it('asks for the beta channel and a bounded list', async () => {
    await RELEASE_MEMBERS['release.pollNow']();
    expect(chain.asked[0]).toBe('/lumen/release/releases?limit=50&channel=beta');
  });

  it('takes the artifact for the architecture the device reports', async () => {
    chain.releases = [release()];
    const info: any = await RELEASE_MEMBERS['release.pollNow']();

    // The emulator here is x86_64; handing it the arm64 APK would fail at
    // install with nothing useful to say.
    expect(info.platform).toBe('android-amd64');
    expect(info.downloadUrl).toBe('https://cdn/amd64.apk');
    expect(info.artifact.sha256Hex).toBe('b'.repeat(64));
  });

  it('asks the device once and remembers', async () => {
    chain.releases = [release()];
    await RELEASE_MEMBERS['release.pollNow']();
    await RELEASE_MEMBERS['release.pollNow']();
    expect(plugin.abiCalls).toBe(1);
  });

  it('announces a newer version once, not on every poll', async () => {
    chain.releases = [release()];
    const seen: string[] = [];
    RELEASE_MEMBERS['release.onUpdateAvailable']((p: any) => seen.push(p.version));

    await RELEASE_MEMBERS['release.pollNow']();
    await RELEASE_MEMBERS['release.pollNow']();
    await RELEASE_MEMBERS['release.pollNow']();

    expect(seen).toEqual(['9.9.9']);
  });

  it('says nothing about a version that is not newer than the one running', async () => {
    // 0.0.1 is older than whatever package.json says, and an app that offers
    // itself a downgrade loops forever.
    chain.releases = [release({ version: '0.0.1' })];
    const seen: string[] = [];
    RELEASE_MEMBERS['release.onUpdateAvailable']((p: any) => seen.push(p.version));

    await RELEASE_MEMBERS['release.pollNow']();
    expect(seen).toEqual([]);
  });

  it('tells a late subscriber what the last poll found', async () => {
    chain.releases = [release()];
    await RELEASE_MEMBERS['release.pollNow']();

    const seen: string[] = [];
    RELEASE_MEMBERS['release.onUpdateAvailable']((p: any) => seen.push(p.version));
    expect(seen).toEqual(['9.9.9']);
  });

  it('keeps what it knew when the chain cannot be read', async () => {
    chain.releases = [release()];
    await RELEASE_MEMBERS['release.pollNow']();

    chain.ok = false;
    const info: any = await RELEASE_MEMBERS['release.pollNow']();
    expect(info.version).toBe('9.9.9');
  });

  it('reports nothing rather than an empty offer when no release fits', async () => {
    chain.releases = [release({ artifacts: [{ platform: 'windows-amd64', urls: ['https://cdn/win.exe'] }] })];
    expect(await RELEASE_MEMBERS['release.pollNow']()).toBeNull();
  });
});

describe('installing it', () => {
  beforeEach(() => {
    resetReleaseState();
    chain.releases = [release()];
    chain.ok = true;
    plugin.installs = [];
    plugin.fail = '';
  });

  it('hands the installer the URL and the published sha256', async () => {
    const res: any = await RELEASE_MEMBERS['release.downloadAndInstall']();
    expect(res.ok).toBe(true);
    expect(plugin.installs).toEqual([
      { url: 'https://cdn/amd64.apk', sha256Hex: 'b'.repeat(64) }
    ]);
  });

  it('polls first when nothing has been looked up yet', async () => {
    await RELEASE_MEMBERS['release.downloadAndInstall']();
    expect(plugin.installs).toHaveLength(1);
  });

  it('refuses when there is nothing published for this device', async () => {
    chain.releases = [];
    expect(await RELEASE_MEMBERS['release.downloadAndInstall']()).toEqual({
      ok: false,
      error: 'no_release_available'
    });
    expect(plugin.installs).toEqual([]);
  });

  it('passes a failure back instead of claiming success', async () => {
    plugin.fail = 'sha256_mismatch';
    const res: any = await RELEASE_MEMBERS['release.downloadAndInstall']();
    expect(res).toEqual({ ok: false, error: 'sha256_mismatch' });
  });

  it('forwards the installer\'s progress to whoever subscribed', async () => {
    const seen: string[] = [];
    RELEASE_MEMBERS['release.onUpdateProgress']((p: any) => seen.push(p.phase));
    // The native subscription is made off the call, so let it land.
    await new Promise((r) => setTimeout(r, 0));
    await RELEASE_MEMBERS['release.downloadAndInstall']();

    for (const handler of plugin.progressHandlers) handler({ phase: 'downloading' });
    expect(seen).toContain('downloading');
  });
});
