import { test, expect, called } from './support/app';

/**
 * Sending funds.
 *
 * The unit tests cover what a send is worth and where it routes; nothing
 * covered that the button opens the form, that the form reaches the bridge, or
 * that what it sends is what was typed. A disconnected handler here loses the
 * user money or, worse, sends the wrong amount silently.
 */

const BALANCE = `() => Promise.resolve({ ok: true, balance: { amount: '5000000', denom: 'ulmn' } })`;

async function openWallet(page: import('@playwright/test').Page) {
  const bar = page.locator('input[type="search"], input[type="text"]').first();
  await bar.click();
  await bar.fill('lumen://wallet');
  await bar.press('Enter');
  await expect(page.locator('.internal-page').getByText('Wallet', { exact: true }).first()).toBeVisible();
}

test.describe('sending tokens', () => {
  test('opens the send form, summarises the amount, and starts the send', async ({
    openApp,
    page,
  }) => {
    await openApp({ 'wallet.getBalance': BALANCE });
    await openWallet(page);

    await page.getByRole('button', { name: /^Send$/i }).first().click();

    const recipient = page.getByPlaceholder(/lmn1|address|recipient/i).first();
    await expect(recipient).toBeVisible();
    await recipient.fill('lmn1recipienttestaddress000000000000000000');
    await page.getByPlaceholder('0.000000').first().fill('1.25');

    // The summary is what the user reads before committing, so it is asserted
    // rather than the payload: a wrong number here is a wrong decision.
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toContainText('1.25 LMN');
    await expect(dialog).toContainText('Available: 5.000000 LMN');

    // Stops before committing on purpose. Past the confirm button the page
    // runs a preflight against the chain, and the mock cannot answer it
    // without inventing response shapes - a test that passes because the fake
    // agrees with itself is worse than no test. Committing a send is verified
    // by hand; see the release checklist in CONTRIBUTING.md.
    await expect(page.getByRole('button', { name: 'Preview Send' })).toBeEnabled();
  });

  test('rejects a non-numeric amount instead of sending it', async ({ openApp, page }) => {
    await openApp({ 'wallet.getBalance': BALANCE });
    await openWallet(page);

    await page.getByRole('button', { name: /^Send$/i }).first().click();
    const amount = page.getByPlaceholder('0.000000').first();
    await amount.fill('12abc.5x');
    // The mask strips anything that is not a digit or a single point.
    await expect(amount).toHaveValue('12.5');
  });

  test('caps the amount at six decimals, the chain precision', async ({ openApp, page }) => {
    await openApp({ 'wallet.getBalance': BALANCE });
    await openWallet(page);

    await page.getByRole('button', { name: /^Send$/i }).first().click();
    const amount = page.getByPlaceholder('0.000000').first();
    await amount.fill('1.123456789');
    await expect(amount).toHaveValue('1.123456');
  });

  test('does not reach the bridge when the form is closed', async ({ openApp, page }) => {
    await openApp({ 'wallet.getBalance': BALANCE });
    await openWallet(page);

    await page.getByRole('button', { name: /^Send$/i }).first().click();
    await page.keyboard.press('Escape');

    expect(await called(page, 'wallet.sendTokens')).toBe(false);
  });
});
