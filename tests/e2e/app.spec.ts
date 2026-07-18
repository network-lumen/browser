import { test, expect } from '@playwright/test';

test.describe('Lumen Browser UI', () => {
  test('should load the main app and display the app root', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await expect(page).toHaveTitle(/Lumen Browser/i);
    await expect(page.locator('#app')).toBeVisible();
  });
});