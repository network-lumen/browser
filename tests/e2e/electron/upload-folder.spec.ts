import { test, expect, type ElectronApplication } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NO_DISPLAY, NO_DISPLAY_REASON, closeApp, evalInApp, launchApp } from './support/launch';

test.skip(NO_DISPLAY, NO_DISPLAY_REASON);
test.describe.configure({ mode: 'serial' });

/**
 * Putting a folder into IPFS, watching it happen, and stopping it.
 *
 * A directory upload is the one operation in the app that is long enough for a
 * user to change their mind about, so it reports progress and can be cancelled.
 * Both were only ever exercised by hand: the renderer suite mocks the bridge, so
 * it has never seen a progress event that came from an actual file being read.
 */

let app: ElectronApplication;
let folder: string;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  ({ app } = await launchApp('upload'));

  await expect
    .poll(
      async () => {
        try {
          return ((await evalInApp(app, () => (window as any).lumen.ipfsStatus())) as any)?.ok === true;
        } catch {
          return false;
        }
      },
      { timeout: 120_000, intervals: [1_000] }
    )
    .toBe(true);
});

test.afterAll(async () => {
  await closeApp(app);
  rmSync(folder, { recursive: true, force: true });
});

/** Enough files that a cancel has something to interrupt. */
function makeFolder(name: string, fileCount: number, bytesEach: number) {
  const dir = join(tmpdir(), `lumen-e2e-upload-${name}-${Date.now()}`);
  mkdirSync(join(dir, 'nested'), { recursive: true });
  for (let i = 0; i < fileCount; i++) {
    const target = i % 3 === 0 ? join(dir, 'nested', `f${i}.bin`) : join(dir, `f${i}.bin`);
    writeFileSync(target, Buffer.alloc(bytesEach, i % 251));
  }
  return dir;
}

test('adds a directory and gives back one address for the whole tree', async () => {
  folder = makeFolder('small', 6, 4_096);

  const res = (await evalInApp(
    app,
    (payload) => (window as any).lumen.ipfsAddDirectoryFromPath(payload),
    { rootPath: folder, rootName: 'e2e-folder' },
    120_000
  )) as any;

  expect(res.ok).toBe(true);
  expect(String(res.cid ?? res.rootCid ?? '')).toMatch(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/);
});

test('refuses a path that is not a directory', async () => {
  const file = join(folder, 'f1.bin');
  const res = (await evalInApp(
    app,
    (p) => (window as any).lumen.ipfsAddDirectoryFromPath({ rootPath: p }),
    file
  )) as any;

  expect(res).toMatchObject({ ok: false, error: 'not_directory' });
});

test('reports progress while it works', async () => {
  const dir = makeFolder('progress', 40, 64_000);
  try {
    const result = (await evalInApp(
      app,
      async (payload) => {
        const l = (window as any).lumen;
        const seen: unknown[] = [];
        const off = l.ipfsOnAddProgress((p: unknown) => seen.push(p));
        const res = await l.ipfsAddDirectoryFromPathWithProgress({
          ...(payload as object),
          uploadId: 'e2e-progress'
        });
        if (typeof off === 'function') off();
        return { res, events: seen.length, sample: seen[0] ?? null };
      },
      { rootPath: dir, rootName: 'progress-folder' },
      180_000
    )) as any;

    expect(result.res.ok).toBe(true);
    // The event is what the Drive page draws its bar from; an upload that
    // finishes without ever reporting looks frozen to the user.
    expect(result.events).toBeGreaterThan(0);
    expect(result.sample).toBeTruthy();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a second upload with the same id is refused rather than racing the first', async () => {
  const dir = makeFolder('race', 60, 128_000);
  try {
    const outcome = (await evalInApp(
      app,
      async (payload) => {
        const l = (window as any).lumen;
        const first = l.ipfsAddDirectoryFromPathWithProgress({
          ...(payload as object),
          uploadId: 'e2e-same-id'
        });
        // Same id while the first is still in flight.
        const second = await l.ipfsAddDirectoryFromPathWithProgress({
          ...(payload as object),
          uploadId: 'e2e-same-id'
        });
        await first.catch(() => null);
        return second;
      },
      { rootPath: dir, rootName: 'race-folder' },
      180_000
    )) as any;

    expect(outcome).toMatchObject({ ok: false, error: 'add_in_progress' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cancelling stops the upload instead of letting it finish', async () => {
  // Big enough that the cancel lands mid-flight rather than after the fact.
  const dir = makeFolder('cancel', 120, 256_000);
  try {
    const outcome = (await evalInApp(
      app,
      async (payload) => {
        const l = (window as any).lumen;
        const uploadId = 'e2e-cancel';
        const running = l.ipfsAddDirectoryFromPathWithProgress({ ...(payload as object), uploadId });

        // Let it start reading before pulling the rug.
        await new Promise((r) => setTimeout(r, 400));
        const cancelled = await l.ipfsCancelAdd({ uploadId });
        const res = await running.catch((e: unknown) => ({ ok: false, error: String(e) }));
        return { cancelled, res };
      },
      { rootPath: dir, rootName: 'cancel-folder' },
      180_000
    )) as any;

    expect(outcome.cancelled.ok).toBe(true);
    // Whatever shape the abort takes, it must not report a completed upload.
    expect(outcome.res?.ok).not.toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
