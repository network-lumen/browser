const { Worker, isMainThread, parentPort } = require('worker_threads');
const { createHash } = require('crypto');

function leadingZeroBits(digest) {
  let total = 0;
  for (let i = 0; i < digest.length; i++) {
    const byte = digest[i];
    if (byte === 0) {
      total += 8;
      continue;
    }
    total += Math.clz32(byte) - 24;
    return total;
  }
  return total;
}

function computePowNonceFast(publicKey, powBits) {
  const bits = Number(powBits) || 0;
  if (bits <= 0) return Buffer.from([0]);
  if (bits > 256) {
    throw new Error(`pow difficulty too high: ${bits} > 256`);
  }

  const pubKeyBuf = Buffer.isBuffer(publicKey)
    ? publicKey
    : Buffer.from(publicKey.buffer, publicKey.byteOffset, publicKey.byteLength);

  const base = createHash('sha256');
  base.update(pubKeyBuf);

  const nonce = Buffer.allocUnsafe(8);
  let hi = 0;
  let lo = 0;

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

if (!isMainThread) {
  let pqcPromise = null;
  async function loadPqc() {
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

  parentPort.on('message', async (msg) => {
    const { id, type } = msg || {};
    if (!id) return;
    try {
      if (type === 'createKeyPair') {
        const pqc = await loadPqc();
        const pair = await pqc.createKeyPair();
        parentPort.postMessage({ id, ok: true, pair });
      } else if (type === 'computePowNonce') {
        const { publicKey, powBits } = msg;
        let powNonce;
        try {
          powNonce = computePowNonceFast(publicKey, powBits);
        } catch (e) {
          const pqc = await loadPqc();
          powNonce = pqc.computePowNonce(publicKey, Number(powBits) || 0);
        }
        parentPort.postMessage({ id, ok: true, powNonce });
      } else {
        parentPort.postMessage({ id, ok: false, error: 'unknown_job_type' });
      }
    } catch (e) {
      parentPort.postMessage({
        id,
        ok: false,
        error: String(e && e.message ? e.message : e)
      });
    }
  });
} else {
  let worker = null;
  const pending = new Map();

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(__filename);
    worker.on('message', (msg) => {
      const { id } = msg || {};
      if (!id) return;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (msg.ok) {
        entry.resolve(msg);
      } else {
        entry.reject(new Error(msg.error || 'pqc_worker_error'));
      }
    });
    worker.on('error', (err) => {
      for (const entry of pending.values()) {
        entry.reject(err);
      }
      pending.clear();
      worker = null;
    });
    worker.on('exit', (code) => {
      if (code !== 0) {
        const err = new Error(`pqc worker exited with code ${code}`);
        for (const entry of pending.values()) {
          entry.reject(err);
        }
        pending.clear();
      }
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

  async function createPqcKeyPairInWorker() {
    const res = await runJob('createKeyPair', {});
    return res.pair;
  }

  async function computePowNonceInWorker(publicKey, powBits) {
    const res = await runJob('computePowNonce', { publicKey, powBits });
    return res.powNonce;
  }

  module.exports = {
    createPqcKeyPairInWorker,
    computePowNonceInWorker
  };
}

