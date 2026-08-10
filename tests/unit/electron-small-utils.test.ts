import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * The small main-process helpers, each of which decides one thing everything
 * else depends on being right.
 *
 * They are short enough to look correct at a glance, which is exactly why they
 * were never tested. Three of them guard a real hazard: `httpModuleForUrl`
 * refuses a protocol nobody vetted rather than guessing a transport for a URL
 * that came off the chain; `leadingZeroBits` is the proof-of-work measure, so a
 * wrong answer either rejects valid work or accepts none; and `currentAppVersion`
 * is what an update check compares against.
 */

const require_ = (await import('node:module')).createRequire(import.meta.url);

describe('httpModuleForUrl', () => {
  const { httpModuleForUrl } = require_('../../electron/utils/http.cjs');

  it('picks the transport that matches the scheme', () => {
    expect(httpModuleForUrl(new URL('https://example.test/'))).toBe(require_('https'));
    expect(httpModuleForUrl(new URL('http://example.test/'))).toBe(require_('http'));
  });

  it('refuses anything else instead of guessing', () => {
    // A release URL arrives from the chain. Falling back to http for a file:
    // or a made-up scheme is how the wrong one gets used.
    for (const url of ['file:///tmp/x', 'ftp://example.test/', 'lumen://home']) {
      expect(() => httpModuleForUrl(new URL(url)), url).toThrow(/unsupported_protocol/);
    }
    expect(() => httpModuleForUrl(null)).toThrow('unsupported_protocol:none');
    expect(() => httpModuleForUrl({})).toThrow('unsupported_protocol:none');
  });
});

describe('leadingZeroBits', () => {
  const { leadingZeroBits } = require_('../../electron/utils/pow.cjs');

  it('counts a whole zero byte as eight', () => {
    expect(leadingZeroBits(Uint8Array.from([0x00, 0xff]))).toBe(8);
    expect(leadingZeroBits(Uint8Array.from([0x00, 0x00, 0xff]))).toBe(16);
  });

  it('counts the zeros inside the first non-zero byte', () => {
    expect(leadingZeroBits(Uint8Array.from([0xff]))).toBe(0);
    expect(leadingZeroBits(Uint8Array.from([0x80]))).toBe(0);
    expect(leadingZeroBits(Uint8Array.from([0x40]))).toBe(1);
    expect(leadingZeroBits(Uint8Array.from([0x01]))).toBe(7);
    expect(leadingZeroBits(Uint8Array.from([0x00, 0x40]))).toBe(9);
  });

  it('counts an all-zero digest as every bit', () => {
    expect(leadingZeroBits(Uint8Array.from([0, 0, 0, 0]))).toBe(32);
    expect(leadingZeroBits(Uint8Array.from([]))).toBe(0);
  });
});

describe('currentAppVersion', () => {
  it('takes the version the app reports when it is the app own', () => {
    // Under vitest there is no Electron, so `process.versions.electron` is
    // undefined and the helper can only ever reach its package.json fallback.
    // Pretending otherwise is the only way to exercise the branch that matters.
    const original = process.versions.electron;
    Object.defineProperty(process.versions, 'electron', {
      value: '41.0.3',
      configurable: true
    });
    try {
      const stub = stubElectron({
        app: {
          getVersion: () => '9.9.9',
          getPath: () => stubUserData(),
          getAppPath: () => process.cwd()
        }
      });
      const { currentAppVersion } = stub.load<{ currentAppVersion: () => string }>(
        'utils/app_version.cjs'
      );
      expect(currentAppVersion()).toBe('9.9.9');
    } finally {
      if (original === undefined) delete (process.versions as any).electron;
      else Object.defineProperty(process.versions, 'electron', { value: original, configurable: true });
    }
  });

  it('falls back to package.json when the app answers with Electron own version', () => {
    // The dev case the helper exists for: launched with a script path rather
    // than an app directory, `app.getVersion()` returns Electron's version, and
    // anything keyed on it - an update check - compares the wrong number.
    const original = process.versions.electron;
    Object.defineProperty(process.versions, 'electron', {
      value: '41.0.3',
      configurable: true
    });
    try {
      const stub = stubElectron({
        app: {
          getVersion: () => '41.0.3',
          getPath: () => stubUserData(),
          getAppPath: () => process.cwd()
        }
      });
      const { currentAppVersion } = stub.load<{ currentAppVersion: () => string }>(
        'utils/app_version.cjs'
      );
      const expected = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version;
      expect(currentAppVersion()).toBe(expected);
    } finally {
      if (original === undefined) delete (process.versions as any).electron;
      else Object.defineProperty(process.versions, 'electron', { value: original, configurable: true });
    }
  });
});

/** The stub makes its own temp userData; this only needs to be a real path. */
function stubUserData() {
  return process.cwd();
}

describe('userDataPath and the JSON helpers', () => {
  it('builds a path under userData and creates the directory', () => {
    const stub = stubElectron();
    const fs_ = stub.load<{
      userDataPath: (...s: string[]) => string;
      readJson: (f: string, fallback: unknown) => unknown;
      writeJson: (f: string, data: unknown) => void;
    }>('utils/fs.cjs');

    const file = fs_.userDataPath('nested', 'thing.json');
    expect(file.startsWith(stub.userData)).toBe(true);
    expect(existsSync(stub.userData)).toBe(true);
  });

  it('round-trips JSON and creates the parent directory on the way', () => {
    const stub = stubElectron();
    const fs_ = stub.load<any>('utils/fs.cjs');
    const file = join(stub.userData, 'deep', 'nested', 'state.json');

    fs_.writeJson(file, { hello: 'world' });
    expect(fs_.readJson(file, null)).toEqual({ hello: 'world' });
  });

  it('answers with the fallback for a missing or broken file', () => {
    // Every state file in the app reads through this. A corrupt one has to
    // come back as the fallback, not as an exception during startup.
    const stub = stubElectron();
    const fs_ = stub.load<any>('utils/fs.cjs');
    expect(fs_.readJson(join(stub.userData, 'nope.json'), { d: 1 })).toEqual({ d: 1 });

    const broken = join(stub.userData, 'broken.json');
    writeFileSync(broken, '{not json', 'utf8');
    expect(fs_.readJson(broken, { d: 2 })).toEqual({ d: 2 });
  });
});

describe('clampInt, sleep and pickRandom', () => {
  const { clampInt, sleep, pickRandom } = require_('../../electron/utils/values.cjs');

  it('clamps to the bounds and falls back to the minimum for nonsense', () => {
    expect(clampInt(5, 1, 10)).toBe(5);
    expect(clampInt(0, 1, 10)).toBe(1);
    expect(clampInt(99, 1, 10)).toBe(10);
    expect(clampInt(3.9, 1, 10)).toBe(3);
    for (const bad of ['x', null, undefined, NaN, Infinity]) {
      expect(clampInt(bad, 4, 10), String(bad)).toBe(4);
    }
  });

  it('waits for a timer rather than resolving straight away', async () => {
    // Fake timers, not a wall-clock comparison: a 20ms sleep measured against a
    // 15ms floor is a coin toss on a loaded machine, and the property worth
    // asserting is that it waits at all, not how accurately.
    vi.useFakeTimers();
    try {
      let done = false;
      const pending = sleep(1000).then(() => {
        done = true;
      });

      await vi.advanceTimersByTimeAsync(999);
      expect(done).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('samples without repeating, and never more than it was given', () => {
    const items = [1, 2, 3, 4, 5];
    const picked = pickRandom(items, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect(pickRandom(items, 99)).toHaveLength(5);
    expect(pickRandom(items, 0)).toEqual([]);
    expect(pickRandom(null, 2)).toEqual([]);
  });

  it('does not disturb the array it was handed', () => {
    const items = [1, 2, 3, 4, 5];
    pickRandom(items, 3);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it('samples the whole list, not a prefix', () => {
    // A partial shuffle that only ever returned the first n peers would make
    // the pool always talk to the same node.
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) for (const v of pickRandom([1, 2, 3, 4, 5], 2)) seen.add(v);
    expect(seen.size).toBe(5);
  });
});

describe('the peer pool singleton', () => {
  it('hands the same pool to every caller', () => {
    // Two pools would mean two views of which peers are healthy, and the
    // suspect marks made by one would be invisible to the other.
    const stub = stubElectron();
    const { getNetworkPool } = stub.load<{ getNetworkPool: () => unknown }>(
      'daemons/peers/pool_singleton.cjs'
    );
    expect(getNetworkPool()).toBe(getNetworkPool());
  });
});
