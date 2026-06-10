import fs from 'fs';
import path from 'path';

// ton ipfs import ici
// import { ipfsAddDirectoryPathsWithProgress } from './ipfs';

process.on('message', async ({ payload, opts }) => {
  const signal = null; // pas nécessaire ici

  const TIMEOUT_MS = opts?.timeoutMs ?? 180000;
  const READ_DELAY_MS = opts?.readDelayMs ?? 0;

  const isAborted = () => false;

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), TIMEOUT_MS);

  try {
    const rootPath = String(payload?.rootPath ?? payload?.path ?? '').trim();
    if (!rootPath) throw new Error('missing_path');

    const st = await fs.promises.stat(rootPath).catch(() => null);
    if (!st || !st.isDirectory()) throw new Error('not_directory');

    const rootNameRaw = String(payload?.rootName ?? path.basename(rootPath) ?? '').trim();
    const rootName =
      rootNameRaw.replace(/\\/g, '/').split('/').filter(Boolean)[0] || 'folder';

    const files = [];
    const stack = [''];
    const maxFiles = 50_000;

    while (stack.length) {
      const relDir = stack.pop();
      const absDir = relDir ? path.join(rootPath, relDir) : rootPath;

      const ents = await fs.promises
        .readdir(absDir, { withFileTypes: true })
        .catch(() => []);

      for (const ent of ents) {
        const name = String(ent?.name || '').trim();
        if (!name) continue;

        const rel = relDir ? path.join(relDir, name) : name;
        const abs = path.join(rootPath, rel);

        if (ent.isDirectory()) {
          stack.push(rel);
          continue;
        }

        if (!ent.isFile()) continue;

        const relNorm = String(rel)
          .replace(/\\/g, '/')
          .replace(/^\/+/, '');

        files.push({
          path: `${rootName}/${relNorm}`,
          filePath: abs,
        });

        if (files.length % 500 === 0) {
          process.send?.({
            type: 'progress',
            data: { stage: 'scan', files: files.length },
          });
        }

        if (files.length > maxFiles) {
          throw new Error('too_many_files');
        }
      }

      if (READ_DELAY_MS) {
        await new Promise(r => setTimeout(r, READ_DELAY_MS));
      }
    }

    if (!files.length) throw new Error('no_files');

    const res = await ipfsAddDirectoryPathsWithProgress({
      rootName,
      files,
      onProgress: (p) => {
        process.send?.({ type: 'progress', data: p });
      },
    });

    clearTimeout(timeout);

    process.send?.({
      type: 'done',
      data: {
        ...res,
        rootPath,
        rootName,
        fileCount: files.length,
      },
    });

  } catch (e) {
    clearTimeout(timeout);

    process.send?.({
      type: 'error',
      error: String(e?.message || e),
    });
  }
});