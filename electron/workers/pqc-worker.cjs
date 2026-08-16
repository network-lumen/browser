// ============================================================================
// PQC jobs that must not run on the main thread: generating a Dilithium key
// pair, and mining the anti-spam proof of work the chain asks for before it
// accepts a PQC link. Both take long enough to freeze the window.
//
// This file is loaded twice, and that is the thing to know before reading it.
// `require()`d from the main process it takes the bottom branch and exports a
// client. That client starts a Worker on this same file (`new Worker(__filename)`),
// and the copy running inside the thread takes the other branch instead: no
// exports, just a message loop. So the two halves below never run together -
// only one of them exists per thread.
// ============================================================================

const { Worker, isMainThread, parentPort } = require('worker_threads');
const { createHash } = require('crypto');
const { leadingZeroBits } = require('../utils/pow.cjs');

// ---------------------------------------------------------------------------
// Section: the work itself (runs in the worker thread)
// ---------------------------------------------------------------------------

/**
 * Find a nonce whose sha256(publicKey || nonce) starts with `powBits` zero bits.
 *
 * Hand-rolled rather than taken from the SDK because it is the one hot loop
 * here: the sha256 of the public key is computed once and `copy()`d per
 * attempt, and the nonce is a reused 8-byte buffer. The caller falls back to
 * the SDK's version if this throws.
 */
function computePowNonceFast(publicKey, powBits) {
  const bits = Number(powBits) || 0;
  if (bits <= 0) return Buffer.from([0]);
  if (bits > 256) {
    throw new Error(`pow difficulty too high: ${bits} > 256`);
  }

  const pubKeyBuf = Buffer.isBuffer(publicKey) ? publicKey
    : Buffer.from(publicKey.buffer, publicKey.byteOffset, publicKey.byteLength);

  const base = createHash('sha256');
  base.update(pubKeyBuf);

  const nonce = Buffer.allocUnsafe(8);
  let hi = 0;
  let lo = 0;

  // Unbounded on purpose: the difficulty comes from chain params and the only
  // way out other than a hit is the 64-bit counter wrapping.
  for (;;) {
    nonce.writeUInt32BE(hi, 0);
    nonce.writeUInt32BE(lo, 4);

    const digest = base.copy().update(nonce).digest();
    if (leadingZeroBits(digest) >= bits) {
      return Buffer.from(nonce);
    }

    lo = (lo + 1) >>> 0;
    if (lo === 0) {
      hi = (hi + 1) >>> 0;
      if (hi === 0) {
        throw new Error('pow search exhausted');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Section: worker thread - answer one message per job, never throw at the top
// ---------------------------------------------------------------------------

function runWorkerThread() {
  // The SDK is ESM-only and slow to import, so it is loaded on first need and
  // then kept - a key-pair job pays for it, a PoW job usually never does.
  let pqcPromise = null;
  function loadPqc() {
    if (!pqcPromise) {
      pqcPromise = (async () => {
        const mod = await import('@lumen-chain/sdk');
        const sdk = (mod && (mod.default || mod)) || mod;
        const pqc = sdk && sdk.pqc;
        if (!pqc) {
          throw new Error('PQC helpers unavailable in worker');
        }
        return pqc;
      })();
    }
    return pqcPromise;
  }

  async function runJob(msg) {
    if (msg.type === 'createKeyPair') {
      const pqc = await loadPqc();
      return { pair: await pqc.createKeyPair() };
    }

    if (msg.type === 'computePowNonce') {
      const { publicKey, powBits } = msg;
      try {
        return { powNonce: computePowNonceFast(publicKey, powBits) };
      } catch {
        const pqc = await loadPqc();
        return { powNonce: pqc.computePowNonce(publicKey, Number(powBits) || 0) };
      }
    }

    throw new Error('unknown_job_type');
  }

  // Every reply carries the id it answers, because jobs can overlap. A throw
  // escaping here would take the whole thread down and reject every pending
  // job with it, so the reply is the only exit.
  parentPort.on('message', async (msg) => {
    const { id } = msg || {};
    if (!id) return;
    try {
      parentPort.postMessage({ id, ok: true, ...(await runJob(msg)) });
    } catch (e) {
      parentPort.postMessage({ id, ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
}

// ---------------------------------------------------------------------------
// Section: main process - one lazy worker, a promise per job
// ---------------------------------------------------------------------------

function createWorkerClient() {
  let worker = null;
  const pending = new Map();

  function rejectAllPending(err) {
    for (const entry of pending.values()) {
      entry.reject(err);
    }
    pending.clear();
  }

  // Started on the first job, not at import: most sessions never sign anything.
  // Dropped on error or exit so the next job gets a fresh one.
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(__filename);

    worker.on('message', (msg) => {
      const { id } = msg || {};
      if (!id) return;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (msg.ok) entry.resolve(msg);
      else entry.reject(new Error(msg.error || 'pqc_worker_error'));
    });

    worker.on('error', (err) => {
      rejectAllPending(err);
      worker = null;
    });

    worker.on('exit', (code) => {
      if (code !== 0) rejectAllPending(new Error(`pqc worker exited with code ${code}`));
      worker = null;
    });

    return worker;
  }

  function runJob(type, payload) {
    return new Promise((resolve, reject) => {
      const w = ensureWorker();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pending.set(id, { resolve, reject });
      w.postMessage({ id, type, ...(payload || {}) });
    });
  }

  return {
    createPqcKeyPairInWorker: async () => (await runJob('createKeyPair', {})).pair,
    computePowNonceInWorker: async (publicKey, powBits) =>
      (await runJob('computePowNonce', { publicKey, powBits })).powNonce
  };
}

// ---------------------------------------------------------------------------

if (isMainThread) {
  module.exports = createWorkerClient();
} else {
  runWorkerThread();
}
