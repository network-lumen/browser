import { test as base, expect, type Page } from '@playwright/test';
import { buildBridgeInitScript } from './mockBridge';

/**
 * Opening the app with a bridge in place, and asking it what it was told.
 *
 * `openApp` injects the mock before any app code runs - after navigation is
 * too late, because `checkLumenAPIReferences()` fires on mount and would have
 * already declared the bridge missing.
 */

export type AppFixtures = {
  openApp: (overrides?: Record<string, string>) => Promise<void>;
  bridgeCalls: () => Promise<{ path: string; args: unknown[] }[]>;
};

/**
 * Enough for the app to consider itself set up: one real profile and a
 * password already configured.
 *
 * Without these the onboarding modal opens over everything and refuses to be
 * dismissed - profile creation is mandatory by design - so every flow that is
 * not about onboarding has to start past it.
 */
const PROFILE = JSON.stringify({
  id: 'p1',
  name: 'Tester',
  // A real bech32 address, checksum included, over twenty zero bytes.
  //
  // The previous one was the right shape and would not decode. Anything that
  // re-encodes it for another chain - which is how the wallet derives your
  // address on Osmosis, and how the chain cards decide they have one - got
  // nothing back, and the card reported it as "This chain does not publish a
  // REST endpoint", because that guard covers both causes with one sentence.
  address: 'lmn1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqx4uxvd',
  role: 'user',
});

const SIGNED_IN: Record<string, string> = {
  'profiles.list': `() => Promise.resolve({ ok: true, profiles: [${PROFILE}], activeId: 'p1' })`,
  'profiles.getActive': `() => Promise.resolve({ ok: true, profile: ${PROFILE} })`,
  'profiles.isWalletFullyCreated': `() => Promise.resolve({ ok: true, created: true })`,
  'security.getStatus': `() => Promise.resolve({ ok: true, passwordEnabled: true, hasPassword: true, sessionActive: true })`,
  'security.checkSession': `() => Promise.resolve({ ok: true, active: true })`,
  // Which network the app is on, with endpoints on it.
  //
  // Un-stubbed, net.getNetwork answers the mock's blanket { ok: true }, which
  // carries no network at all - so the renderer falls back to its "bridge did
  // not answer" descriptor: mainnet's name with no rpc and no rest. Every
  // action that needs an endpoint is then drawn disabled, and a spec clicking
  // one waits for a button that never enables.
  'net.getNetwork': `() => Promise.resolve({ ok: true, network: {
    id: 'mainnet', label: 'Mainnet', chainId: 'lumen', prefix: 'lmn',
    denom: 'ulmn', symbol: 'LMN', decimals: 6, prettyName: 'Lumen',
    website: '', explorerAccountUrl: '',
    rest: ['https://rest.test'], rpc: ['https://rpc.test'],
    observedChainId: 'lumen'
  }, available: [] })`,
};

export const test = base.extend<AppFixtures>({
  openApp: async ({ page }, use) => {
    await use(async (overrides = {}) => {
      await page.addInitScript(buildBridgeInitScript({ ...SIGNED_IN, ...overrides }));
      // The modal is also suppressed per profile in storage; the bridge alone
      // is not enough because MainScreen reads this key directly.
      await page.addInitScript(() => {
        // Both first-run overlays: the wallet one blocks everything, the new
        // tab one covers the page a flow is trying to click through.
        localStorage.setItem('lumen_wallet_onboarding_completed_p1', 'true');
        localStorage.setItem('lumen:onboarding:discover:v1', '1');
      });
      await page.goto('/');
      // The shell is up once a tab exists; every flow below starts from there.
      await expect(page.locator('#app')).toBeVisible();
    });
  },

  bridgeCalls: async ({ page }, use) => {
    await use(async () => page.evaluate(() => (window as any).__bridgeCalls || []));
  },
});

export { expect };

/** Was this bridge method called at all? */
export async function called(page: Page, path: string): Promise<boolean> {
  return page.evaluate(
    (p) => ((window as any).__bridgeCalls || []).some((c: any) => c.path === p),
    path
  );
}

/** The arguments of the first call to a bridge method, or null. */
export async function firstCallArgs(page: Page, path: string): Promise<unknown[] | null> {
  return page.evaluate((p) => {
    const hit = ((window as any).__bridgeCalls || []).find((c: any) => c.path === p);
    return hit ? hit.args : null;
  }, path);
}

