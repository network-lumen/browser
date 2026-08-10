import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Putting back PQC keys a crash left in the clear.
 *
 * Signing needs the Dilithium keys readable, so `tempDecryptPqcKeys` writes
 * them out decrypted and re-encrypts them in a cleanup callback. Nothing
 * survives a kill between those two steps: the private keys stay on disk in
 * plaintext, and every later launch simply used them as they were.
 *
 * The repair runs when the session unlocks, which is the first moment in a run
 * where the password is known.
 */

type PqcKeys = {
  repairPlaintextPqcKeys: (password: string) => boolean;
  arePqcKeysEncrypted: () => boolean;
};

const PASSWORD = 'correct horse battery';

const PLAINTEXT = {
  'profile:p1': {
    name: 'profile:p1',
    scheme: 'dilithium3',
    publicKey: 'cHVi',
    privateKey: 'cHJpdi1zZWNyZXQ=',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
};

function withKeysFile(contents: unknown) {
  const stub = stubElectron();
  const dir = join(stub.userData, 'pqc_keys');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'keys.json');
  if (contents !== undefined) writeFileSync(file, JSON.stringify(contents, null, 2), 'utf8');
  return { mod: stub.load<PqcKeys>('utils/pqc-keys.cjs'), file };
}

describe('repairing PQC keys left in the clear', () => {
  it('re-encrypts a plaintext keystore and stops the secret being readable', () => {
    const { mod, file } = withKeysFile(PLAINTEXT);

    expect(mod.arePqcKeysEncrypted()).toBe(false);
    expect(mod.repairPlaintextPqcKeys(PASSWORD)).toBe(true);

    const after = readFileSync(file, 'utf8');
    expect(after).not.toContain('cHJpdi1zZWNyZXQ=');
    expect(JSON.parse(after)._encrypted).toBe(true);
    expect(mod.arePqcKeysEncrypted()).toBe(true);
  });

  it('leaves an already-encrypted keystore alone', () => {
    const { mod, file } = withKeysFile(PLAINTEXT);
    mod.repairPlaintextPqcKeys(PASSWORD);
    const first = readFileSync(file, 'utf8');

    // Re-encrypting again would change the salt and the ciphertext for nothing,
    // and would run on every single unlock.
    expect(mod.repairPlaintextPqcKeys(PASSWORD)).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(first);
  });

  it('does nothing without a password, rather than writing something unreadable', () => {
    const { mod, file } = withKeysFile(PLAINTEXT);
    expect(mod.repairPlaintextPqcKeys('')).toBe(false);
    expect(readFileSync(file, 'utf8')).toContain('cHJpdi1zZWNyZXQ=');
  });

  it('does nothing when there is no keystore at all', () => {
    const stub = stubElectron();
    const mod = stub.load<PqcKeys>('utils/pqc-keys.cjs');
    expect(mod.repairPlaintextPqcKeys(PASSWORD)).toBe(false);
    expect(existsSync(join(stub.userData, 'pqc_keys', 'keys.json'))).toBe(false);
  });

  it('does nothing for an empty keystore', () => {
    // An empty object is a store with no keys, not a leak worth rewriting.
    const { mod } = withKeysFile({});
    expect(mod.repairPlaintextPqcKeys(PASSWORD)).toBe(false);
  });
});
