import { expect, test } from '@playwright/test';
import { chainWallet } from '../electron/support/env';
import { LAUNCH_TIMEOUT, NO_DISPLAY, NO_DISPLAY_REASON, launchApp } from '../electron/support/launch';
import { balanceUlmn, importWallet, toLmn } from './support/wallet';

/**
 * Everything the spending tests assume, checked before any of them spends.
 *
 * Run it after `npm run e2e:wallet` and after funding, to see where you are:
 * it says whether the wallet is wired and whether the money arrived. Nothing
 * here broadcasts.
 */

const wallet = chainWallet();

test.describe('chain preflight', () => {
  test.skip(NO_DISPLAY, NO_DISPLAY_REASON);
  test.skip(!wallet, 'no wallet configured: run `npm run e2e:wallet`, see tests/e2e/.env.example');
  test.setTimeout(LAUNCH_TIMEOUT + 120_000);

  test('the app derives the same address as the wallet generator', async () => {
    const w = wallet!;
    const { app } = await launchApp('chain', { fresh: true });
    try {
      const res = await importWallet(app, w.mnemonic, 'e2e-chain');
      expect(res.ok, `import failed: ${res.error}`).toBe(true);
      // A mismatch means the two derive differently, and every later test would
      // then fund one address and spend from another.
      expect(res.walletAddress).toBe(w.address);
    } finally {
      await app.close();
    }
  });

  test('the balance is readable, and says whether the wallet is funded', async () => {
    const w = wallet!;
    const { app } = await launchApp('chain');
    try {
      const ulmn = await balanceUlmn(app, w.address);
      console.log(`${w.address} holds ${toLmn(ulmn)} LMN (${ulmn} ulmn)`);
      test.skip(ulmn === 0, `not funded yet: send LMN to ${w.address}`);
      expect(ulmn).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
