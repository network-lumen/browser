import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Pin jobs surviving a restart.
 *
 * A managed pin is the promise that content the user chose to keep stays
 * served. The job outlives the app: it is written to ipfs_pin_jobs.json and
 * picked up on the next launch, retry counter and all. If reading that file
 * ever stops working, nothing errors - the jobs are simply gone, and the
 * content quietly stops being served. That is the failure this covers.
 *
 * Only the reading half is exercised here. Resuming spawns the kubo binary,
 * which is the e2e suite's job.
 */

type Ipfs = {
  listPinJobs: () => any[];
  getPinJob: (id: string) => any | null;
};

const JOBS_FILE = 'ipfs_pin_jobs.json';

function withJobsFile(contents: string) {
  const stub = stubElectron();
  writeFileSync(join(stub.userData, JOBS_FILE), contents, 'utf8');
  return stub.load<Ipfs>('ipfs.cjs');
}

function job(over: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    target: 'bafyabc',
    name: 'Holiday photos',
    status: 'running',
    progressCurrent: 12,
    progressTotal: 40,
    progressUnit: 'files',
    retryCount: 2,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_001_000,
    ...over
  };
}

describe('reading pin jobs back after a restart', () => {
  it('restores a job with the progress and retry count it had', () => {
    const ipfs = withJobsFile(JSON.stringify({ version: 1, jobs: [job()] }));
    const restored = ipfs.getPinJob('job-1');
    expect(restored).toMatchObject({
      id: 'job-1',
      target: 'bafyabc',
      name: 'Holiday photos',
      status: 'running',
      progressCurrent: 12,
      progressTotal: 40,
      retryCount: 2
    });
  });

  it('keeps them newest first', () => {
    const ipfs = withJobsFile(
      JSON.stringify({
        version: 1,
        jobs: [
          job({ id: 'old', updatedAt: 1 }),
          job({ id: 'new', target: 'bafyxyz', updatedAt: 9_999 })
        ]
      })
    );
    expect(ipfs.listPinJobs().map((j) => j.id)).toEqual(['new', 'old']);
  });

  it('drops an entry with no id or no target, rather than restoring a job that cannot run', () => {
    const ipfs = withJobsFile(
      JSON.stringify({
        version: 1,
        jobs: [job({ id: '' }), job({ id: 'no-target', target: '' }), job({ id: 'good' })]
      })
    );
    expect(ipfs.listPinJobs().map((j) => j.id)).toEqual(['good']);
  });

  it('survives a truncated file instead of taking the module down with it', () => {
    // A crash mid-write leaves exactly this. Losing the queue is bad; failing
    // to load ipfs.cjs at all would take the whole app with it.
    const ipfs = withJobsFile('{"version":1,"jobs":[{"id":"job-1",');
    expect(ipfs.listPinJobs()).toEqual([]);
  });

  it('survives a file that is valid JSON but the wrong shape', () => {
    const ipfs = withJobsFile('{"version":1,"jobs":"not an array"}');
    expect(ipfs.listPinJobs()).toEqual([]);
  });

  it('starts empty when there is no file at all', () => {
    const ipfs = stubElectron().load<Ipfs>('ipfs.cjs');
    expect(ipfs.listPinJobs()).toEqual([]);
    expect(ipfs.getPinJob('anything')).toBeNull();
  });

  it('refuses a nonsense progress total instead of passing it to a progress bar', () => {
    const ipfs = withJobsFile(
      JSON.stringify({ version: 1, jobs: [job({ progressCurrent: -1, progressTotal: 0 })] })
    );
    const restored = ipfs.getPinJob('job-1');
    expect(restored.progressTotal).toBeNull();
    // The current value comes back 0 rather than null, because the snapshot
    // runs twice - once when the file is read, once when the job is handed
    // out - and the second pass reads the first pass's null as 0. Harmless
    // with no total to divide by, and recorded so the next reader of this
    // field knows it is not a measurement.
    expect(restored.progressCurrent).toBe(0);
  });
});
