import { Bip39, Random } from '@cosmjs/crypto';
import { type ElectronApplication, expect, test } from '@playwright/test';
import { assertWithinCap, chainWallet } from '../electron/support/env';
import { LAUNCH_TIMEOUT, NO_DISPLAY, NO_DISPLAY_REASON } from '../electron/support/launch';
import {
  balanceUlmn,
  importWallet,
  launchChainApp,
  pqcAccount,
  sendAndSettle,
  toLmn,
  waitForBalance
} from './support/wallet';

/**
 * A real transfer, on the real chain, from a wallet holding real LMN.
 *
 * The shape is a round trip: the funded wallet sends dust to an address created
 * for this run only, that address links its own Dilithium key by the act of
 * sending, and sweeps what is left back. Nothing is meant to survive the run
 * except the funded wallet, and the leftover dust on the throwaway address is
 * written off on purpose - nobody keeps its mnemonic, not even the test.
 *
 * What it proves that a mocked test cannot: `signAndBroadcastWithPqcAutoLink`
 * really does link an unlinked account before its first message, and the chain
 * really does accept what the app signs.
 */

const wallet = chainWallet();

/** Ten times the chain's min_balance_for_link, and a fifth of the cap. */
const TRANSFER_LMN = 0.01;

/**
 * Swept back at 98%, not 100%.
 *
 * A transfer costs 1% of its amount, and whether the chain takes it out of the
 * amount or on top of it is not something the client can tell you. Sending less
 * than everything works under either answer; the remainder is dust on an
 * address nobody will use again.
 */
const SWEEP_RATIO = 0.98;

test.describe('a first transaction links PQC and the money comes back', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(NO_DISPLAY, NO_DISPLAY_REASON);
  test.skip(!wallet, 'no wallet configured: run `npm run e2e:wallet`, see tests/e2e/.env.example');
  test.setTimeout(LAUNCH_TIMEOUT + 300_000);

  let app: ElectronApplication;
  let appOutput: () => string = () => '';
  let mainId = '';
  let tempId = '';
  let tempAddress = '';
  let mainBefore = 0;

  test.beforeAll(async () => {
    if (NO_DISPLAY || !wallet) return;
    const launched = await launchChainApp('chain');
    app = launched.app;
    appOutput = launched.output;

    const main = await importWallet(app, wallet.mnemonic, 'e2e-main');
    expect(main.ok, `importing the funded wallet failed: ${main.error}`).toBe(true);
    expect(main.walletAddress).toBe(wallet.address);
    mainId = String(main.id);

    // Generated here and never written down. It exists for the length of this
    // file's run, which is the point: an address with no history is the only
    // way to watch a *first* transaction.
    const throwaway = Bip39.encode(Random.getBytes(16)).toString();
    const temp = await importWallet(app, throwaway, `e2e-temp-${Date.now()}`);
    expect(temp.ok, `importing the throwaway wallet failed: ${temp.error}`).toBe(true);
    tempId = String(temp.id);
    tempAddress = String(temp.walletAddress);
  });

  // What the main process logged, on failure only. A broadcast that fails does
  // so several layers down - signer, peer pool, chain client - and the string
  // that reaches the test is the last one of the four.
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const lines = appOutput()
        .split('\n')
        .filter((l) => !l.includes('[renderer-console]') && !l.includes('[vite]'));
      console.log(`--- app output (throwaway ${tempAddress}) ---\n` + lines.slice(-120).join('\n'));
    }
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('the throwaway address starts empty and unknown to the PQC module', async () => {
    expect(tempAddress).toMatch(/^lmn1/);
    expect(await balanceUlmn(app, tempAddress)).toBe(0);

    const before = await pqcAccount(app, tempAddress);
    expect(before.ok, `pqc query failed: ${before.error}`).toBe(true);
    expect(before.linked).toBe(false);
  });

  test('the funded wallet sends it dust', async () => {
    assertWithinCap(TRANSFER_LMN, wallet!);
    mainBefore = await balanceUlmn(app, wallet!.address);
    expect(
      mainBefore,
      `${wallet!.address} holds ${toLmn(mainBefore)} LMN, not enough to run this`
    ).toBeGreaterThan(TRANSFER_LMN * 1_000_000);

    const received = await sendAndSettle(app, {
      profileId: mainId,
      from: wallet!.address,
      to: tempAddress,
      amount: TRANSFER_LMN,
      memo: 'lumen e2e'
    });
    console.log(`sent ${TRANSFER_LMN} LMN, ${toLmn(received)} LMN arrived`);
    // Above the chain's min_balance_for_link, or the link below cannot happen.
    expect(received).toBeGreaterThan(1_000);
  });

  test('the funded wallet is PQC-linked once it has signed', async () => {
    // True whether this run did the linking or an earlier one did: the chain's
    // policy is REQUIRED, so a transaction that went through is itself the
    // proof that a key was linked first.
    const after = await pqcAccount(app, wallet!.address);
    expect(after.ok, `pqc query failed: ${after.error}`).toBe(true);
    expect(after.linked).toBe(true);
  });

  test('the throwaway address links itself by making its first transaction', async () => {
    const held = await balanceUlmn(app, tempAddress);
    const sweepLmn = Math.floor(held * SWEEP_RATIO) / 1_000_000;
    assertWithinCap(sweepLmn, wallet!);

    await sendAndSettle(
      app,
      { profileId: tempId, from: tempAddress, to: wallet!.address, amount: sweepLmn },
      mainBefore - TRANSFER_LMN * 1_000_000 + 1
    );

    // Nothing asked for a key, generated one, or linked it - the send did all
    // of it on the way. That is the whole of items 8 and 9.
    const linked = await pqcAccount(app, tempAddress);
    expect(linked.ok, `pqc query failed: ${linked.error}`).toBe(true);
    expect(linked.linked).toBe(true);
  });

  test('the money comes back, minus a fee each way and the dust left behind', async () => {
    const sent = TRANSFER_LMN * 1_000_000;
    const back = await waitForBalance(app, wallet!.address, mainBefore - sent + 1);
    const cost = mainBefore - back;
    console.log(
      `round trip: ${toLmn(mainBefore)} -> ${toLmn(back)} LMN, cost ${toLmn(cost)} LMN` +
        ` (${((cost / sent) * 100).toFixed(1)}% of the amount moved)`
    );

    // Measured at ~4% of the amount moved: 1% taken from each of the two
    // transfers, and the 2% this test declines to sweep. Not pinned to a
    // number - the fee is the chain's to change - only to the two things that
    // would mean something is wrong: money that never came back, and money
    // that came back multiplied.
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(sent);
  });
});
