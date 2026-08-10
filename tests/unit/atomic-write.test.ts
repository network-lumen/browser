import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Writing state so an interrupted run cannot destroy it.
 *
 * Every state file in the app goes through here: profiles.json, settings.json,
 * the keystores, the PQC keys, secret.bin. A plain writeFileSync truncates the
 * target and fills it afterwards, so a crash in between leaves a valid file
 * name holding invalid content - and every reader in this codebase treats
 * unparseable as empty. On profiles.json that is the profile list gone.
 *
 * What is asserted below is the observable half: the content arrives whole,
 * the temporary file never survives, and a write that cannot complete leaves
 * the previous content alone rather than a stump.
 */

type FsUtil = {
  writeFileAtomic: (file: string, contents: string | Buffer) => void;
  writeJson: (file: string, data: unknown) => void;
  readJson: (file: string, fallback: unknown) => unknown;
};

function load() {
  const stub = stubElectron();
  return { fs: stub.load<FsUtil>('utils/fs.cjs'), dir: stub.userData };
}

describe('writeFileAtomic', () => {
  it('writes the content and leaves no temporary file behind', () => {
    const { fs, dir } = load();
    const file = join(dir, 'state.json');

    fs.writeFileAtomic(file, '{"a":1}');

    expect(readFileSync(file, 'utf8')).toBe('{"a":1}');
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('creates the parent directory on the way', () => {
    const { fs, dir } = load();
    const file = join(dir, 'deep', 'nested', 'state.json');
    fs.writeFileAtomic(file, 'hello');
    expect(readFileSync(file, 'utf8')).toBe('hello');
  });

  it('replaces an existing file whole', () => {
    const { fs, dir } = load();
    const file = join(dir, 'state.json');
    writeFileSync(file, 'a'.repeat(5000), 'utf8');

    fs.writeFileAtomic(file, 'short');
    expect(readFileSync(file, 'utf8')).toBe('short');
  });

  it('writes a Buffer byte for byte', () => {
    // secret.bin is 32 random bytes. Encoding those as utf8 would replace
    // every byte outside ASCII and quietly destroy the key that every keystore
    // is derived from - the app would still start, and no wallet would open.
    const { fs, dir } = load();
    const file = join(dir, 'secret.bin');
    const secret = Buffer.from([0x00, 0xff, 0x80, 0xc3, 0x28, 0xfe, 0x01]);

    fs.writeFileAtomic(file, secret);

    const back = readFileSync(file);
    expect(Buffer.compare(back, secret)).toBe(0);
    expect(back.length).toBe(secret.length);
  });

  it('leaves the old content alone when the write cannot complete', () => {
    const { fs, dir } = load();
    const file = join(dir, 'state.json');
    writeFileSync(file, '{"kept":true}', 'utf8');

    // A directory where the temporary file needs to go: the write fails before
    // the rename, so the target is never touched.
    mkdirSync(`${file}.tmp`, { recursive: true });

    expect(() => fs.writeFileAtomic(file, '{"new":true}')).toThrow();
    expect(readFileSync(file, 'utf8')).toBe('{"kept":true}');
  });
});

describe('writeJson', () => {
  it('round-trips through the atomic path', () => {
    const { fs, dir } = load();
    const file = join(dir, 'profiles.json');
    fs.writeJson(file, { profiles: [{ id: 'p1' }], activeId: 'p1' });
    expect(fs.readJson(file, null)).toEqual({ profiles: [{ id: 'p1' }], activeId: 'p1' });
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });
});
