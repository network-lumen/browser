const { ipcMain, dialog } = require('electron');
const path = require('path');

const {
  checkIpfsStatus,
  ipfsCidToBase32,
  ipfsAdd,
  ipfsAddPath,
  ipfsAddPathWithProgress,
  ipfsAddDirectory,
  ipfsAddDirectoryFromPath,
  ipfsAddDirectoryFromPathWithProgress,
  ipfsGet,
  ipfsLs,
  ipfsPinList,
  startManagedPinJob,
  pauseManagedPinJob,
  resumeManagedPinJob,
  cancelManagedPinJob,
  waitForManagedPinJob,
  getPinJob,
  listPinJobs,
  ipfsUnpin,
  ipfsStats,
  ipfsPublishToIPNS,
  ipfsResolveIPNS,
  ipfsKeyList,
  ipfsKeyGen,
  ipfsKeyRename,
  ipfsKeyImportFromPath,
  ipfsKeyExportToPath,
  ipfsKeyRm,
  ipfsPropagateCidToPublicGateways
} = require('../ipfs.cjs');
const { invalidateIpnsCache } = require('../daemons/ipfs_cache.cjs');
const { getMainWindow } = require('../windows.cjs');

/**
 * Every `ipfs:*` channel.
 *
 * The 32 of them were interleaved with unrelated handlers in main.cjs rather
 * than grouped, while an ipc/ folder sat beside it doing exactly this job for
 * every other prefix.
 *
 * The two maps below moved with them because nothing else touched them: they
 * track work that can be cancelled from the renderer, keyed by the webContents
 * that started it, so a second upload from the same tab is refused rather than
 * racing the first.
 */
const ACTIVE_IPFS_ADDS = new Map(); // wcId -> { abort: () => void }
const ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS = new Map(); // wcId -> { abort: () => void }

function registerIpfsIpc() {
  ipcMain.handle('ipfs:status', async () => {
    console.log('[electron][ipc] ipfs:status requested');
    return checkIpfsStatus();
  });

  ipcMain.handle('ipfs:cancelAdd', async (evt, payload) => {
    console.log('[electron][ipc] ipfs:cancelAdd');
    const wcId = String(payload?.uploadId || '');
    console.log('Cancel request for wcId:', wcId);
    const job = ACTIVE_IPFS_ADDS.get(wcId);
    if (!job) return { ok: false, error: 'no_active_job' };
    try {
      job.abort?.();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'cancel_failed') };
    }
  });

  ipcMain.handle('ipfs:cancelPublicGatewayPropagation', async (evt) => {
    const wcId = String(evt?.sender?.id || evt.uploadId || '');
    const job = wcId ? ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS.get(wcId) : null;
    if (!job) return { ok: false, error: 'no_active_job' };
    try {
      job.abort?.();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'cancel_failed') };
    }
  });

  ipcMain.handle('ipfs:add', async (_evt, data, filename) => {
    console.log('[electron][ipc] ipfs:add requested:', filename);
    return ipfsAdd(data, filename);
  });

  ipcMain.handle('ipfs:propagateCidToPublicGateways', async (evt, input) => {
    const wcId = String(evt?.sender?.id || '');
    if (wcId && ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS.has(wcId)) {
      return { ok: false, error: 'propagation_in_progress' };
    }

    const controller = new AbortController();
    const abort = () => {
      try {
        controller.abort();
      } catch {}
    };
    if (wcId) ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS.set(wcId, { abort });

    const sendProgress = (payload) => {
      try {
        evt?.sender?.send?.('ipfs:publicGatewayPropagationProgress', payload || {});
      } catch {}
    };

    try {
      return await ipfsPropagateCidToPublicGateways(input || {}, {
        signal: controller.signal,
        onProgress: sendProgress,
      });
    } finally {
      if (wcId) ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS.delete(wcId);
    }
  });

  ipcMain.handle('ipfs:addPath', async (_evt, filePath, filename) => {
    console.log('[electron][ipc] ipfs:addPath requested:', filename);
    return ipfsAddPath(filePath, filename);
  });

  ipcMain.handle('ipfs:addPathWithProgress', async (evt, payload, filename) => {
    const uploadId = String(payload?.uploadId || '');
    if (uploadId && ACTIVE_IPFS_ADDS.has(uploadId)) return { ok: false, error: 'add_in_progress' };

    const controller = new AbortController();
    const abort = () => {
      try { controller.abort(); } catch {}
    };
    if (uploadId) ACTIVE_IPFS_ADDS.set(uploadId, { abort });

    const sendProgress = (payload2) => {
      try {
        evt?.sender?.send?.('ipfs:addProgress', {
          ...payload2,
          rootPath: payload2?.path || '',
          rootName: payload2?.filename || '',
          key: payload?.filePath || '',
        });
      } catch (e) {
        console.error('SEND PROGRESS ERROR', e);
      }
    };
    try {
      return await ipfsAddPathWithProgress(payload.filePath, payload.filename, { signal: controller.signal, onProgress: sendProgress });
    } finally {
      if (uploadId) ACTIVE_IPFS_ADDS.delete(uploadId);
    }
  });

  ipcMain.handle('ipfs:addDirectory', async (_evt, payload) => {
    console.log('[electron][ipc] ipfs:addDirectory requested');
    return ipfsAddDirectory(payload);
  });

  ipcMain.handle('ipfs:addDirectoryFromPath', async (_evt, payload) => {
    console.log('[electron][ipc] ipfs:addDirectoryFromPath requested');
    return ipfsAddDirectoryFromPath(payload);
  });

  ipcMain.handle('ipfs:addDirectoryFromPathWithProgress', async (evt, payload) => {
      const uploadId = payload.uploadId;
    if (uploadId && ACTIVE_IPFS_ADDS.has(uploadId)) return { ok: false, error: 'add_in_progress' };

    const controller = new AbortController();
    const abort = () => {
      try { controller.abort(); } catch {}
    };
    if (uploadId) ACTIVE_IPFS_ADDS.set(uploadId, { abort });
    const key = path.resolve(payload?.rootPath || '');
    const sendProgress = (payload2) => {
      try {
        evt?.sender?.send?.('ipfs:addProgress', {
          ...payload2,
          key
        });
      } catch {}
    };

    try {
      return await ipfsAddDirectoryFromPathWithProgress(payload, { signal: controller.signal, onProgress: sendProgress });
    } finally {
      if (uploadId) ACTIVE_IPFS_ADDS.delete(uploadId);
    }
  });

  ipcMain.handle('ipfs:cidToBase32', async (_evt, cid) => {
    try {
      const out = ipfsCidToBase32(cid);
      return { ok: true, cid: out || '' };
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'cid_format_failed') };
    }
  });

  ipcMain.handle('ipfs:get', async (_evt, cid, options) => {
    console.log('[electron][ipc] ipfs:get requested:', cid);
    return ipfsGet(cid, options || {});
  });

  ipcMain.handle('ipfs:ls', async (_evt, cidOrPath) => {
    console.log('[electron][ipc] ipfs:ls requested:', cidOrPath);
    return ipfsLs(cidOrPath);
  });

  ipcMain.handle('ipfs:pinList', async () => {
    return ipfsPinList();
  });

  ipcMain.handle('ipfs:pinStart', async (_evt, input) => {
    console.log('[electron][ipc] ipfs:pinStart requested:', input);
    return startManagedPinJob(input || {});
  });

  ipcMain.handle('ipfs:pinPause', async (_evt, jobId) => {
    return pauseManagedPinJob(jobId);
  });

  ipcMain.handle('ipfs:pinResume', async (_evt, jobId) => {
    return resumeManagedPinJob(jobId);
  });

  ipcMain.handle('ipfs:pinCancel', async (_evt, jobId) => {
    return cancelManagedPinJob(jobId);
  });

  ipcMain.handle('ipfs:pinWait', async (_evt, jobId, options) => {
    const timeoutMs = Number(options?.timeoutMs || 0) || 0;
    return waitForManagedPinJob(jobId, timeoutMs);
  });

  ipcMain.handle('ipfs:pinGet', async (_evt, jobId) => {
    const job = getPinJob(jobId);
    return job ? { ok: true, job } : { ok: false, error: 'pin_job_not_found' };
  });

  ipcMain.handle('ipfs:pinJobs', async () => {
    return { ok: true, jobs: listPinJobs() };
  });

  ipcMain.handle('ipfs:pinAdd', async (_evt, cidOrPath) => {
    console.log('[electron][ipc] ipfs:pinAdd requested:', cidOrPath);
    const started = await startManagedPinJob({ cidOrPath });
    if (!started?.ok || !started?.job?.id) return started || { ok: false, error: 'pin_start_failed' };
    const waited = await waitForManagedPinJob(started.job.id);
    if (!waited?.ok) {
      return {
        ok: false,
        cancelled: !!waited?.cancelled,
        error: String(waited?.error || 'pin_failed'),
        job: waited?.job || started.job
      };
    }
    const job = waited.job || started.job;
    const pins = job?.pinnedCid ? [String(job.pinnedCid)] : [];
    return {
      ok: true,
      pins,
      pinnedCid: String(job?.pinnedCid || pins[0] || '').trim(),
      job
    };
  });

  ipcMain.handle('ipfs:unpin', async (_evt, cid) => {
    console.log('[electron][ipc] ipfs:unpin requested:', cid);
    return ipfsUnpin(cid);
  });

  ipcMain.handle('ipfs:stats', async () => {
    return ipfsStats();
  });

  ipcMain.handle('ipfs:publishToIPNS', async (_evt, cid, key, options) => {
    console.log('[electron][ipc] ipfs:publishToIPNS requested:', cid, 'key:', key);
    const timeoutMs = Number(options && options.timeoutMs);
    const res = await ipfsPublishToIPNS(cid, key, {
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : 60000,
    });
    if (res?.ok) {
      try {
        invalidateIpnsCache(res.name);
        invalidateIpnsCache(key);
      } catch {}
    }
    return res;
  });

  ipcMain.handle('ipfs:resolveIPNS', async (_evt, name) => {
    console.log('[electron][ipc] ipfs:resolveIPNS requested:', name);
    return ipfsResolveIPNS(name);
  });

  ipcMain.handle('ipfs:keyList', async () => {
    console.log('[electron][ipc] ipfs:keyList requested');
    return ipfsKeyList();
  });

  ipcMain.handle('ipfs:keyGen', async (_evt, name) => {
    console.log('[electron][ipc] ipfs:keyGen requested:', name);
    return ipfsKeyGen(name);
  });

  ipcMain.handle('ipfs:keyRename', async (_evt, oldName, newName) => {
    console.log('[electron][ipc] ipfs:keyRename requested:', oldName, '->', newName);
    return ipfsKeyRename(oldName, newName);
  });

  ipcMain.handle('ipfs:keyImport', async (_evt, name) => {
    const keyName = String(name || '').trim();
    if (!keyName) return { ok: false, error: 'missing_key_name' };
    const win = getMainWindow();
    const selected = win
      ? await dialog.showOpenDialog(win, {
          title: 'Import stable link key',
          properties: ['openFile'],
          filters: [
            { name: 'Private key files', extensions: ['key', 'pem', 'txt'] },
            { name: 'All files', extensions: ['*'] },
          ],
        })
      : await dialog.showOpenDialog({
          title: 'Import stable link key',
          properties: ['openFile'],
          filters: [
            { name: 'Private key files', extensions: ['key', 'pem', 'txt'] },
            { name: 'All files', extensions: ['*'] },
          ],
        });
    if (selected.canceled || !selected.filePaths?.length) return { ok: false, canceled: true };
    return ipfsKeyImportFromPath(keyName, selected.filePaths[0]);
  });

  ipcMain.handle('ipfs:keyExport', async (_evt, name) => {
    const keyName = String(name || '').trim();
    if (!keyName) return { ok: false, error: 'missing_key_name' };
    const safeName = keyName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'stable-link';
    const win = getMainWindow();
    const selected = win
      ? await dialog.showSaveDialog(win, {
          title: 'Export stable link key',
          defaultPath: `${safeName}.pem`,
          filters: [
            { name: 'PEM private key', extensions: ['pem'] },
            { name: 'All files', extensions: ['*'] },
          ],
        })
      : await dialog.showSaveDialog({
          title: 'Export stable link key',
          defaultPath: `${safeName}.pem`,
          filters: [
            { name: 'PEM private key', extensions: ['pem'] },
            { name: 'All files', extensions: ['*'] },
          ],
        });
    if (selected.canceled || !selected.filePath) return { ok: false, canceled: true };
    return ipfsKeyExportToPath(keyName, selected.filePath);
  });

  ipcMain.handle('ipfs:keyRm', async (_evt, name) => {
    return ipfsKeyRm(name);
  });

}

module.exports = { registerIpfsIpc };