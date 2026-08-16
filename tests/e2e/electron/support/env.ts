import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The chain tests' wallet, read from tests/e2e/.env.
 *
 * Parsed here rather than with dotenv: it is fifteen lines, and a dependency
 * added for fifteen lines is a dependency to update forever. Anything already
 * in the environment wins, so CI can inject without a file.
 */

const here = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(here, '..', '..', '.env');

let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  if (!existsSync(ENV_FILE)) return;

  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export type ChainWallet = {
  mnemonic: string;
  address: string;
  /** Hard ceiling per transaction, in LMN. */
  maxLmn: number;
  chainId?: string;
};

/**
 * The funded wallet, or null when there is none.
 *
 * Null is the normal state for anyone who has not set this up, and the chain
 * specs skip on it rather than failing: a contributor without a funded wallet
 * should still be able to run the suite.
 */
export function chainWallet(): ChainWallet | null {
  load();
  const mnemonic = String(process.env.LUMEN_E2E_MNEMONIC || '').trim();
  const address = String(process.env.LUMEN_E2E_ADDRESS || '').trim();
  if (!mnemonic || !address) return null;
  if (mnemonic.split(/\s+/).length < 12) return null;
  if (!/^lmn1[0-9a-z]{38,}$/.test(address)) return null;

  const maxLmn = Number(process.env.LUMEN_E2E_MAX_LMN || '0.05');
  return {
    mnemonic,
    address,
    maxLmn: Number.isFinite(maxLmn) && maxLmn > 0 ? maxLmn : 0.05,
    chainId: String(process.env.LUMEN_E2E_CHAIN_ID || '').trim() || undefined
  };
}

/**
 * Refuse an amount above the configured ceiling.
 *
 * The tests compute amounts, and a computation that goes wrong should stop
 * here rather than at the chain. Called before anything is signed.
 */
export function assertWithinCap(amountLmn: number, wallet: ChainWallet) {
  if (!Number.isFinite(amountLmn) || amountLmn <= 0) {
    throw new Error(`refusing to send a nonsense amount: ${amountLmn}`);
  }
  if (amountLmn > wallet.maxLmn) {
    throw new Error(`refusing to send ${amountLmn} LMN, above the ${wallet.maxLmn} cap in tests/e2e/.env`);
  }
}
