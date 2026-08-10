import type { ElectronApplication } from '@playwright/test';
import { evalInApp } from '../../electron/support/launch';

/** 1 LMN. The chain counts in ulmn everywhere, including in what a test asserts. */
export const ULMN = 1_000_000;

export function toUlmn(lmn: number) {
  return Math.round(lmn * ULMN);
}

export function toLmn(ulmn: number | string) {
  return Number(ulmn) / ULMN;
}

/**
 * Puts a mnemonic into the running app as a real profile.
 *
 * Through `profiles:importManual`, the same channel the "import a wallet"
 * screen uses, so what the tests sign with is what a user would have. It
 * returns the address the app derived, which is worth asserting against: a
 * mismatch means the app and the wallet generator disagree on the path.
 */
export async function importWallet(app: ElectronApplication, mnemonic: string, name: string) {
  return evalInApp(
    app,
    async (arg: { mnemonic: string; name: string }) =>
      (await (window as any).lumen.profiles.importManual(arg)) as {
        ok: boolean;
        id?: string;
        walletAddress?: string;
        error?: string;
      },
    { mnemonic, name }
  );
}

/** ulmn held by an address, straight from the chain's REST endpoint. */
export async function balanceUlmn(app: ElectronApplication, address: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  for (;;) {
    const res = await evalInApp(
      app,
      async (addr: string) =>
        (await (window as any).lumen.wallet.getBalance(addr)) as {
          ok: boolean;
          balance?: { denom: string; amount: string };
          error?: string;
        },
      address
    );
    if (res?.ok) return Number(res.balance?.amount || '0');
    // The peer pool is still picking an endpoint just after boot, so an early
    // query fails for a reason that resolves itself.
    last = String(res?.error || 'unknown');
    if (Date.now() > deadline) throw new Error(`balance never readable for ${address}: ${last}`);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

/**
 * Waits for an address to hold at least `atLeast` ulmn.
 *
 * Blocks are seconds apart, and a broadcast returns before the transaction is
 * in one, so every "did it arrive" check has to poll.
 */
export async function waitForBalance(
  app: ElectronApplication,
  address: string,
  atLeast: number,
  timeoutMs = 120_000
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const now = await balanceUlmn(app, address);
    if (now >= atLeast) return now;
    if (Date.now() > deadline) {
      throw new Error(`${address} held ${now} ulmn after ${timeoutMs}ms, expected ${atLeast}`);
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
}
