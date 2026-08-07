import { test, expect } from './support/app';

/**
 * Reaching the internal pages at all.
 *
 * Every other flow starts by getting somewhere, and a route that resolves to
 * the wrong component - or to nothing - is invisible to unit tests: they check
 * the resolver's return value, not that the page then renders.
 */
type Page = import('@playwright/test').Page;

async function goTo(page: Page, url: string) {
  const bar = page.locator('input[type="search"], input[type="text"]').first();
  await bar.click();
  await bar.fill(url);
  await bar.press('Enter');
}

/**
 * Most internal pages announce themselves in their sidebar; the store-style
 * ones (Extensions) are full-width with an `<h1>` instead. Both are scoped
 * away from the tab bar, which also shows the route's title and would match
 * whether or not the page rendered.
 */
function pageTitle(page: Page, name: string) {
  return page
    .locator('.internal-page, h1')
    .getByText(name, { exact: true })
    .or(page.locator('h1', { hasText: new RegExp(`^${name}$`) }))
    .first();
}

test.describe('navigation', () => {
  const ROUTES = [
    ['lumen://wallet', 'Wallet'],
    ['lumen://drive', 'Drive'],
    ['lumen://domain', 'Domains'],
    ['lumen://settings', 'Settings'],
    ['lumen://network', 'Network'],
    ['lumen://history', 'History'],
    ['lumen://extensions', 'Extensions'],
    ['lumen://help', 'Help'],
  ] as const;

  for (const [url, title] of ROUTES) {
    test(`opens ${url}`, async ({ openApp, page }) => {
      await openApp();
      await goTo(page, url);
      await expect(pageTitle(page, title)).toBeVisible();
    });
  }

  test('an unknown host falls through to search rather than a blank page', async ({
    openApp,
    page,
  }) => {
    await openApp();
    await goTo(page, 'lumen://something-that-is-not-a-route');
    // The resolver sends anything unrecognised without a dot to SearchPage.
    await expect(page.locator('#app')).not.toBeEmpty();
  });

  test('back and forward walk the tab history', async ({ openApp, page }) => {
    // The back/forward semantics were duplicated across three files before
    // being shared; this is the only thing that checks them end to end.
    await openApp();
    await goTo(page, 'lumen://wallet');
    await expect(pageTitle(page, 'Wallet')).toBeVisible();

    await goTo(page, 'lumen://settings');
    await expect(pageTitle(page, 'Settings')).toBeVisible();

    await page.getByTitle('Back', { exact: true }).click();
    await expect(pageTitle(page, 'Wallet')).toBeVisible();

    await page.getByTitle('Forward', { exact: true }).click();
    await expect(pageTitle(page, 'Settings')).toBeVisible();
  });
});
