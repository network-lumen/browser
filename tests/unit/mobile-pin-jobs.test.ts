import { beforeEach, describe, expect, it } from 'vitest';
import { createPinJobMembers, resetPinJobs } from '../../platform/mobile/impl/pin-jobs';

/**
 * "Save to Drive" on Android.
 *
 * The button was there and did nothing: every member it needs answered
 * `unsupported_on_mobile`. The pages do not pin directly - they start a
 * managed job and then follow it - so the whole of that contract has to exist
 * for the modal to get past its first call.
 *
 * What is worth pinning is the awkward half. A request through the native
 * bridge cannot be aborted, so a pause or a cancel arrives while the pin is
 * still in flight, and what comes back afterwards must not resurrect a job the
 * user stopped.
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** A node whose pin finishes only when the test says so. */
function controllable() {
  const calls: string[] = [];
  const unpinned: string[] = [];
  let pending = deferred<{ ok: boolean; error?: string }>();

  return {
    calls,
    unpinned,
    finish: (result: { ok: boolean; error?: string }) => {
      const current = pending;
      pending = deferred<{ ok: boolean; error?: string }>();
      current.resolve(result);
      // Two ticks: the job awaits the pin, then settles its own state.
      return new Promise((r) => setTimeout(r, 0));
    },
    deps: {
      pin: async (cid: string) => {
        calls.push(cid);
        return pending.promise;
      },
      unpin: async (cid: string) => {
        unpinned.push(cid);
        return { ok: true };
      }
    }
  };
}

const CID = 'bafybeicyr7m4bjhlvqes5rqdya6o2j3mf3nbhmrmyzqimxbuelqgfb3tji';

describe('saving to Drive as a managed job', () => {
  beforeEach(() => resetPinJobs());

  it('hands back a job the modal can follow', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);

    const started: any = await api.ipfsPinStart({ cidOrPath: CID, name: 'Season 1' });
    expect(started.ok).toBe(true);
    expect(started.job.id).toBeTruthy();
    expect(node.calls).toEqual([CID]);

    // The modal reads this to decide whether to show a spinner.
    const running: any = await api.ipfsPinGet(started.job.id);
    expect(running.job.status).toBe('running');
  });

  it('resolves the wait once the pin lands, and only then', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);
    const started: any = await api.ipfsPinStart({ cidOrPath: CID, name: 'x' });

    let settled = false;
    const wait = api.ipfsPinWait(started.job.id, { timeoutMs: 0 }).then((r: any) => {
      settled = true;
      return r;
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(settled, 'still pinning').toBe(false);

    await node.finish({ ok: true });
    const result: any = await wait;
    expect(result.ok).toBe(true);
    expect(result.job.status).toBe('completed');
  });

  it('reports the node\'s reason when the pin fails', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);
    const started: any = await api.ipfsPinStart(CID);

    const wait = api.ipfsPinWait(started.job.id, { timeoutMs: 0 });
    await node.finish({ ok: false, error: 'no_node_answered_on_device' });

    const result: any = await wait;
    expect(result.ok).toBe(false);
    expect(result.error).toBe('no_node_answered_on_device');
    expect(result.job.status).toBe('failed');
  });

  /**
   * The case the missing abort makes real: the user cancels, and the pin the
   * node was already doing succeeds a moment later. The content must not stay
   * pinned - they said no.
   */
  it('takes the pin back out when it lands after a cancel', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);
    const started: any = await api.ipfsPinStart(CID);

    const wait = api.ipfsPinWait(started.job.id, { timeoutMs: 0 });
    await api.ipfsPinCancel(started.job.id);

    const result: any = await wait;
    expect(result.cancelled).toBe(true);
    expect(result.error).toBe('user_cancelled');

    await node.finish({ ok: true });
    expect(node.unpinned).toEqual([CID]);
  });

  it('does not complete a job that was paused while its request was in flight', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);
    const started: any = await api.ipfsPinStart(CID);

    await api.ipfsPinPause(started.job.id);
    await node.finish({ ok: true });

    const after: any = await api.ipfsPinGet(started.job.id);
    expect(after.job.status).toBe('paused');
    expect(node.unpinned).toEqual([]);
  });

  it('asks the node again on resume, and completes from there', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);
    const started: any = await api.ipfsPinStart(CID);

    await api.ipfsPinPause(started.job.id);
    await api.ipfsPinResume(started.job.id);
    expect(node.calls).toEqual([CID, CID]);

    const wait = api.ipfsPinWait(started.job.id, { timeoutMs: 0 });
    await node.finish({ ok: true });
    expect(((await wait) as any).ok).toBe(true);
  });

  it('refuses to steer a job that is already over', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);
    const started: any = await api.ipfsPinStart(CID);
    await node.finish({ ok: true });

    for (const call of [api.ipfsPinPause, api.ipfsPinCancel, api.ipfsPinResume]) {
      const res: any = await call(started.job.id);
      expect(res.ok).toBe(false);
      expect(res.error).toBe('pin_job_finished');
    }
  });

  it('tells every change to whoever subscribed', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);

    const seen: string[] = [];
    const stop = api.ipfsOnPinProgress((payload: any) => seen.push(payload.job.status));

    const started: any = await api.ipfsPinStart(CID);
    await node.finish({ ok: true });
    expect(seen).toEqual(['running', 'completed']);

    stop();
    await api.ipfsPinStart(started.job.cid);
    expect(seen).toEqual(['running', 'completed']);
  });

  it('names an unknown job rather than inventing one', async () => {
    const api = createPinJobMembers(controllable().deps);
    expect(await api.ipfsPinGet('nope')).toEqual({ ok: false, error: 'pin_job_not_found' });
    expect(await api.ipfsPinWait('nope', { timeoutMs: 0 })).toEqual({
      ok: false,
      error: 'pin_job_not_found'
    });
  });

  it('refuses a start with no CID', async () => {
    const api = createPinJobMembers(controllable().deps);
    expect(await api.ipfsPinStart({ name: 'x' })).toEqual({ ok: false, error: 'missing_cid' });
  });

  it('lists what it has been asked to do', async () => {
    const node = controllable();
    const api = createPinJobMembers(node.deps);
    await api.ipfsPinStart({ cidOrPath: CID, name: 'one' });

    const listed: any = await api.ipfsPinJobs();
    expect(listed.ok).toBe(true);
    expect(listed.jobs).toHaveLength(1);
    expect(listed.jobs[0]).toMatchObject({ cid: CID, name: 'one' });
  });
});
