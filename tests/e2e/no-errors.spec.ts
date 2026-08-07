import { test, expect } from './support/app';

/**
 * No page throws while it renders.
 *
 * The cheapest broad signal there is: an uncaught error means a component died
 * mid-render, and everything below it in the tree is simply absent. Nothing
 * else in this suite would notice - the assertions look at what *is* on
 * screen, not at what silently failed to arrive.
 */

const ROUTES = [
  'lumen://newtab',
  'lumen://home',
  'lumen://wallet',
  'lumen://drive',
  'lumen://domain',
  'lumen://settings',
  'lumen://network',
  'lumen://history',
  'lumen://extensions',
  'lumen://gateways',
  'lumen://my-gateways',
  'lumen://release',
  'lumen://help',
  'lumen://search',
];

for (const url of ROUTES) {
  test(`${url} renders without throwing`, async ({ openApp, page }) => {
    const failures: string[] = [];
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') failures.push(`console.error: ${m.text()}`);
    });

    await openApp();

    const bar = page.locator('input[type="search"], input[type="text"]').first();
    await bar.click();
    await bar.fill(url);
    await bar.press('Enter');
    await page.waitForTimeout(1200);

    expect(failures, `${url} logged:\n${failures.join('\n')}`).toEqual([]);
  });
}
