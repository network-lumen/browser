import { test, expect } from './support/app';

/**
 * The shell itself: that the app boots against a bridge, and that the pieces
 * every other flow starts from are actually there.
 *
 * If these fail, nothing below them means anything.
 */
test.describe('app shell', () => {
  test('boots without the fatal error screen when the bridge is present', async ({
    openApp,
    page,
  }) => {
    await openApp();
    await expect(page.locator('#app')).toBeVisible();
    // The startup check writes this screen when a bridge member is missing.
    await expect(page.getByText('Fatal error:')).toHaveCount(0);
  });

  test('shows the fatal error screen when the bridge is missing', async ({ page }) => {
    // No mock injected on purpose: this is the guard that catches a renamed or
    // dropped bridge method in production, so it has to actually fire.
    await page.goto('/');
    await expect(page.getByText('Fatal error:')).toBeVisible();
  });

  test('opens with one tab and can add another', async ({ openApp, page }) => {
    await openApp();
    const tabs = page.locator('.mainscreen-tab');
    await expect(tabs).toHaveCount(1);

    await page.getByRole('button', { name: 'New tab' }).click();
    await expect(tabs).toHaveCount(2);
  });

  test('closes a tab', async ({ openApp, page }) => {
    await openApp();
    await page.getByRole('button', { name: 'New tab' }).click();
    await expect(page.locator('.mainscreen-tab')).toHaveCount(2);

    await page.locator('.mainscreen-tab').first().getByTitle('Close').click();
    await expect(page.locator('.mainscreen-tab')).toHaveCount(1);
  });
});
