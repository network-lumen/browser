import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The wallet identity the whole renderer reads from.
 *
 * Every page asks this store who is active, so what matters is not the happy
 * path but what it holds when the bridge answers badly: the app has to keep
 * running with no profile rather than throw somewhere in a page, and it must
 * never invent an active id that is not in the list.
 *
 * `activeProfileId` being empty is a state the app genuinely reaches -
 * onboarding is skippable - so it is asserted, not treated as impossible.
 */

const PROFILES = [
  { id: 'p1', name: 'Alice', role: 'user', walletAddress: 'lmn1alice' },
  { id: 'p2', name: 'Bob', role: 'user', walletAddress: 'lmn1bob' }
];

function stubBridge(profiles: Partial<Record<string, any>> = {}) {
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.lumen = { profiles };
  return profiles;
}

async function loadStore() {
  vi.resetModules();
  return import('../../src/stores/profilesStore');
}

beforeEach(() => {
  delete (globalThis as any).window?.lumen;
});

describe('loading the profiles', () => {
  it('takes the list and the active id the main process reports', async () => {
    stubBridge({ list: async () => ({ profiles: PROFILES, activeId: 'p2' }) });
    const store = await loadStore();
    await store.initProfiles();
    expect(store.profilesState.value).toHaveLength(2);
    expect(store.activeProfileId.value).toBe('p2');
    expect(store.getActiveProfile()?.name).toBe('Bob');
  });

  it('falls back to the first profile when no active id comes back', async () => {
    stubBridge({ list: async () => ({ profiles: PROFILES, activeId: '' }) });
    const store = await loadStore();
    await store.initProfiles();
    expect(store.activeProfileId.value).toBe('p1');
  });

  it('holds no profile at all when the list is empty', async () => {
    // Reachable in the real app: onboarding can be skipped until restart.
    stubBridge({ list: async () => ({ profiles: [], activeId: '' }) });
    const store = await loadStore();
    await store.initProfiles();
    expect(store.profilesState.value).toEqual([]);
    expect(store.activeProfileId.value).toBe('');
    expect(store.getActiveProfile()).toBeNull();
  });

  it('survives a list that is not a list', async () => {
    stubBridge({ list: async () => ({ profiles: 'nope', activeId: 'p1' }) });
    const store = await loadStore();
    await store.initProfiles();
    expect(store.profilesState.value).toEqual([]);
  });

  it('survives the bridge throwing', async () => {
    stubBridge({
      list: async () => {
        throw new Error('main process is gone');
      }
    });
    const store = await loadStore();
    await expect(store.initProfiles()).resolves.toBeUndefined();
    expect(store.profilesState.value).toEqual([]);
  });

  it('survives no bridge at all', async () => {
    const store = await loadStore();
    await expect(store.initProfiles()).resolves.toBeUndefined();
    expect(store.activeProfileId.value).toBe('');
  });
});

describe('getActiveProfile', () => {
  it('returns null for an active id that is not in the list', async () => {
    // Rather than the first profile: answering with the wrong identity is how a
    // page ends up showing one wallet and signing with another.
    stubBridge({ list: async () => ({ profiles: PROFILES, activeId: 'p1' }) });
    const store = await loadStore();
    await store.initProfiles();
    store.activeProfileId.value = 'ghost';
    expect(store.getActiveProfile()).toBeNull();
  });
});

describe('switching profile', () => {
  it('moves to what the main process confirms, not to what was asked', async () => {
    stubBridge({
      list: async () => ({ profiles: PROFILES, activeId: 'p1' }),
      select: async () => 'p2'
    });
    const store = await loadStore();
    await store.initProfiles();
    await store.setActiveProfile('p2');
    expect(store.activeProfileId.value).toBe('p2');
  });

  it('stays where it was when the switch is refused', async () => {
    stubBridge({
      list: async () => ({ profiles: PROFILES, activeId: 'p1' }),
      select: async () => ''
    });
    const store = await loadStore();
    await store.initProfiles();
    await store.setActiveProfile('p2');
    expect(store.activeProfileId.value).toBe('p1');
  });
});

describe('creating a profile', () => {
  it('reloads the list so the new profile is visible', async () => {
    const list = vi.fn(async () => ({ profiles: PROFILES, activeId: 'p1' }));
    stubBridge({ list, create: async (name: string) => ({ id: 'p3', name, role: 'user' }) });
    const store = await loadStore();
    const created = await store.createProfile('Carol');
    expect(created?.id).toBe('p3');
    expect(list).toHaveBeenCalled();
  });

  it('reports null when the main process refuses', async () => {
    stubBridge({ list: async () => ({ profiles: [], activeId: '' }), create: async () => null });
    const store = await loadStore();
    expect(await store.createProfile('')).toBeNull();
  });
});

describe('renaming a profile', () => {
  it('says which error came back rather than a generic failure', async () => {
    stubBridge({
      list: async () => ({ profiles: PROFILES, activeId: 'p1' }),
      updateName: async () => ({ ok: false, error: 'name_taken' })
    });
    const store = await loadStore();
    expect(await store.updateProfileName('p1', 'Bob')).toMatchObject({
      ok: false,
      error: 'name_taken'
    });
  });

  it('reports the API being absent as its own error', async () => {
    stubBridge({ list: async () => ({ profiles: PROFILES, activeId: 'p1' }) });
    const store = await loadStore();
    expect(await store.updateProfileName('p1', 'X')).toMatchObject({
      ok: false,
      error: 'profiles_api_unavailable'
    });
  });
});
