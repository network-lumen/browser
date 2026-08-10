import type { ElectronApplication } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalInApp, evalInAppOnce, launchApp } from '../../electron/support/launch';

/** 1 LMN. The chain counts in ulmn everywhere, including in what a test asserts. */
export const ULMN = 1_000_000;

/**
 * Where the Dilithium keys live, and why it is not the test profile.
 *
 * Linking is one-way: once an address has a PQC key hash on-chain, an app that
 * cannot produce that key refuses to sign for it - `ensureLocalPqcKey` throws
 * "no matching local PQC key" and the address is finished. The funded wallet
 * gets linked by its very first transfer, so its key cannot live in a profile
 * under %TEMP% that `{ fresh: true }` deletes and the OS cleans up on its own.
 *
 * `LUMEN_PQC_HOME` moves the keystore next to tests/e2e/.env, which is the
 * directory that already means "lose this and you lose the wallet". Gitignored.
 */
export function pqcHome() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.pqc');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A chain-suite app: same harness, keys kept outside the disposable profile. */
export function launchChainApp(name = 'chain', opts: { fresh?: boolean } = {}) {
  return launchApp(name, { ...opts, env: { LUMEN_PQC_HOME: pqcHome() } });
}

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
  return evalInAppOnce(
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

/** Whether the chain holds a Dilithium key for an address, and which. */
export async function pqcAccount(app: ElectronApplication, address: string) {
  return evalInApp(
    app,
    async (addr: string) =>
      (await (window as any).lumen.pqc.getAccount(addr)) as {
        ok: boolean;
        linked?: boolean;
        account?: unknown;
        error?: string;
      },
    address
  );
}

/**
 * The chain's own rules for linking: proof-of-work cost, minimum balance.
 *
 * Retried, like every read here: just after boot the peer pool is still
 * settling on an endpoint, and a single "fetch failed" against one node says
 * nothing about the chain.
 */
export async function pqcParams(app: ElectronApplication, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await evalInApp(
      app,
      async () =>
        (await (window as any).lumen.pqc.getParams()) as {
          ok: boolean;
          data?: { params?: Record<string, unknown> };
          error?: string;
        }
    );
    if (res?.ok || Date.now() > deadline) return res;
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

/**
 * Sends, through the same channel the Send dialog uses.
 *
 * `amount` is in LMN, whole units - `wallet:sendTokens` does the conversion to
 * ulmn itself. Passing ulmn here would send a million times too much, which is
 * exactly what the cap in env.ts is there to stop.
 *
 * Issued exactly once - see evalInAppOnce. This call moves money.
 */
export async function sendLmn(
  app: ElectronApplication,
  input: { profileId: string; from: string; to: string; amount: number; memo?: string }
) {
  return evalInAppOnce(
    app,
    async (arg: typeof input) =>
      (await (window as any).lumen.wallet.sendTokens(arg)) as {
        ok: boolean;
        txhash?: string;
        error?: string;
      },
    input
  );
}

/**
 * Sends, then settles the answer against the chain.
 *
 * `indexing_disabled` is not a failure: the node that accepts a broadcast is
 * not the one asked to confirm it, and a peer with transaction indexing off
 * cannot read any transaction back - the app says so itself and tells the user
 * to check their balance. Observed on this network with a transfer that had in
 * fact gone through, so a test that trusted the return value would fail on a
 * working send. The recipient's balance is the only answer that means anything.
 *
 * @returns what the recipient holds once the transfer has landed
 */
export async function sendAndSettle(
  app: ElectronApplication,
  input: { profileId: string; from: string; to: string; amount: number; memo?: string },
  atLeast = 1,
  timeoutMs = 180_000
) {
  const res = await sendLmn(app, input);
  console.log(`send ${input.amount} LMN ${input.from} -> ${input.to}: ${JSON.stringify(res)}`);
  if (!res.ok && res.error !== 'indexing_disabled') {
    throw new Error(`send of ${input.amount} LMN to ${input.to} refused: ${res.error}`);
  }
  return waitForBalance(app, input.to, atLeast, timeoutMs);
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
