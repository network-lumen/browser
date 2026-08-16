import { beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stubElectron, type ElectronStub } from './support/electronStub';

/**
 * Bringing an IPFS repo up to the layout the shipped Kubo expects.
 *
 * This decision runs before `ipfs config` sets the addresses and the gateway
 * headers, and `config` refuses to touch a repo that needs migrating: it fails
 * with "ipfs repo needs migration" and nothing applies. Upgrading Kubo
 * therefore left a user with a daemon on default endpoints for that run, and
 * one warning in a log nobody reads.
 *
 * The spawn itself is plumbing. What is worth holding still is which of the
 * three answers comes out, because one of them - migrating a repo that is
 * ahead of the binary - is a downgrade that would cost data.
 */

let env: ElectronStub;
let ipfs: any;
let repoPath: string;

beforeEach(() => {
  env = stubElectron();
  ipfs = env.load('ipfs.cjs');
  repoPath = join(env.userData, 'ipfs');
  mkdirSync(repoPath, { recursive: true });
});

describe('reading the version on disk', () => {
  it('reads the version the repo is at', () => {
    writeFileSync(join(repoPath, 'version'), '17\n', 'utf8');
    expect(ipfs.readRepoVersion(repoPath)).toBe(17);
  });

  it('says nothing about a repo that was never initialised', () => {
    expect(ipfs.readRepoVersion(repoPath)).toBeNull();
  });

  it('ignores a version file that is not a version', () => {
    for (const body of ['', '   ', 'not-a-number', '0', '-3', '1.5']) {
      writeFileSync(join(repoPath, 'version'), body, 'utf8');
      expect(ipfs.readRepoVersion(repoPath)).toBeNull();
    }
  });
});

describe('planning the migration', () => {
  it('migrates a repo that is behind the binary', () => {
    // The case that produced the bug: Kubo 0.39 wants 18, the user was on 17.
    expect(ipfs.planRepoMigration(17, 18)).toBe('migrate');
  });

  it('leaves a repo that is ahead alone rather than downgrading it', () => {
    expect(ipfs.planRepoMigration(19, 18)).toBe('newer');
  });

  it('does nothing when the repo already matches', () => {
    expect(ipfs.planRepoMigration(18, 18)).toBe('none');
  });

  it('does nothing when either version is unknown', () => {
    // A fresh repo has no version file, and a binary that would not answer
    // `version --repo` is no reason to start running migrations at it.
    expect(ipfs.planRepoMigration(null, 18)).toBe('none');
    expect(ipfs.planRepoMigration(17, null)).toBe('none');
    expect(ipfs.planRepoMigration(null, null)).toBe('none');
  });
});
