const { Worker, isMainThread, parentPort } = require('worker_threads');

if (!isMainThread) {
  const initPromise = (async () => {
    const mod = await import('@lumen-chain/sdk');
    const sdk = (mod && (mod.default || mod)) || mod;
    const pqc = sdk && sdk.pqc;
    if (!pqc) {
      throw new Error('PQC helpers unavailable in worker');
    }
    return pqc;
  })();

  parentPort.on('message', async (msg) => {
    const { id, type } = msg || {};
    if (!id) return;
    try {
      const pqc = await initPromise;
      if (type === 'createKeyPair') {
        const pair = await pqc.createKeyPair();
        parentPort.postMessage({ id, ok: true, pair });
      } else if (type === 'computePowNonce') {
        const { publicKey, powBits } = msg;
        const powNonce = pqc.computePowNonce(publicKey, Number(powBits) || 0);
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

