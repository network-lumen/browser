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
  address: 'lmn1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
  role: 'user',
});

const SIGNED_IN: Record<string, string> = {
  'profiles.list': `() => Promise.resolve({ ok: true, profiles: [${PROFILE}], activeId: 'p1' })`,
  'profiles.getActive': `() => Promise.resolve({ ok: true, profile: ${PROFILE} })`,
  'profiles.isWalletFullyCreated': `() => Promise.resolve({ ok: true, created: true })`,
  'security.getStatus': `() => Promise.resolve({ ok: true, passwordEnabled: true, hasPassword: true, sessionActive: true })`,
  'security.checkSession': `() => Promise.resolve({ ok: true, active: true })`,
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

