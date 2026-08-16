import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The guards around the tests that spend real money.
 *
 * Two things must stay true: an ordinary `playwright test` cannot reach the
 * chain project, and nothing gets signed above the configured ceiling. Both are
 * one line away from silently stopping being true.
 */

const VARS = [
  'LUMEN_E2E_CHAIN',
  'LUMEN_E2E_MNEMONIC',
  'LUMEN_E2E_ADDRESS',
  'LUMEN_E2E_MAX_LMN',
  'LUMEN_E2E_CHAIN_ID'
];

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const v of VARS) saved[v] = process.env[v];
  // Set rather than deleted: the loader reads tests/e2e/.env for anything
  // missing, and a developer's real file must not decide what this asserts.
  for (const v of VARS) process.env[v] = '';
  vi.resetModules();
});

afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v] as string;
  }
});

const WORDS = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const ADDRESS = 'lmn1ndq47dk3yha8255s48ukxwa8ythfphqp4j4mxp';

async function loadEnv() {
  return import('../e2e/electron/support/env');
}

async function loadConfig() {
  return (await import('../../playwright.config')).default;
}

describe('the chain project is opt-in', () => {
  it('does not exist without the flag', async () => {
    const config = await loadConfig();
    expect(config.projects?.map((p) => p.name)).toEqual(['renderer', 'electron']);
  });

  it('exists with the flag', async () => {
    process.env.LUMEN_E2E_CHAIN = '1';
    const config = await loadConfig();
    expect(config.projects?.map((p) => p.name)).toContain('chain');
  });

  it('is not picked up by the other projects', async () => {
    process.env.LUMEN_E2E_CHAIN = '1';
    const config = await loadConfig();
    const renderer = config.projects?.find((p) => p.name === 'renderer');
    // The renderer project's testDir is the whole of tests/e2e, so the chain
    // specs are only out of it because they are ignored by name.
    expect(renderer?.testIgnore).toContain('**/chain/**');
  });
});

describe('reading the wallet', () => {
  it('is null when nothing is configured', async () => {
    const { chainWallet } = await loadEnv();
    expect(chainWallet()).toBeNull();
  });

  it('is null on a truncated mnemonic, rather than a wallet that cannot sign', async () => {
    process.env.LUMEN_E2E_MNEMONIC = 'abandon abandon about';
    process.env.LUMEN_E2E_ADDRESS = ADDRESS;
    const { chainWallet } = await loadEnv();
    expect(chainWallet()).toBeNull();
  });

  it('is null on an address that is not a lumen address', async () => {
    process.env.LUMEN_E2E_MNEMONIC = WORDS;
    process.env.LUMEN_E2E_ADDRESS = 'cosmos1abcdefghijklmnopqrstuvwxyz0123456789abc';
    const { chainWallet } = await loadEnv();
    expect(chainWallet()).toBeNull();
  });

  it('reads a configured wallet, with a default ceiling', async () => {
    process.env.LUMEN_E2E_MNEMONIC = WORDS;
    process.env.LUMEN_E2E_ADDRESS = ADDRESS;
    const { chainWallet } = await loadEnv();
    expect(chainWallet()).toMatchObject({ address: ADDRESS, maxLmn: 0.05 });
  });

  it('falls back to the default ceiling when the configured one is nonsense', async () => {
    process.env.LUMEN_E2E_MNEMONIC = WORDS;
    process.env.LUMEN_E2E_ADDRESS = ADDRESS;
    process.env.LUMEN_E2E_MAX_LMN = 'plenty';
    const { chainWallet } = await loadEnv();
    expect(chainWallet()?.maxLmn).toBe(0.05);
  });
});

describe('the amount ceiling', () => {
  const wallet = { mnemonic: WORDS, address: ADDRESS, maxLmn: 0.05 };

  it('allows an amount under it', async () => {
    const { assertWithinCap } = await loadEnv();
    expect(() => assertWithinCap(0.01, wallet)).not.toThrow();
  });

  it('refuses an amount over it', async () => {
    const { assertWithinCap } = await loadEnv();
    expect(() => assertWithinCap(1, wallet)).toThrow(/above the 0.05 cap/);
  });

  it('refuses zero, a negative, and a NaN', async () => {
    const { assertWithinCap } = await loadEnv();
    for (const bad of [0, -1, NaN]) {
      expect(() => assertWithinCap(bad, wallet)).toThrow(/nonsense amount/);
    }
  });
});
