const { ipcMain, app, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Readable, Transform } = require('node:stream');
const crypto = require('node:crypto');
const { getSetting } = require('../settings.cjs');

const ACTIVE_HLS_CONVERSIONS = new Map(); // wcId -> { abort: () => void }
const ACTIVE_HLS_ARCHIVE_EXPORTS = new Map(); // wcId -> { abort: () => void }
const DOWNLOAD_PROGRESS_MIN_INTERVAL_MS = 500;
const DOWNLOAD_PROGRESS_MIN_STEP_BYTES = 8 * 1024 * 1024;

function logHls(...args) {
  console.log('[electron][hls]', ...args);
}

function ipfsApiBase() {
  return String(getSetting('ipfsApiBase') || 'http://127.0.0.1:5001').replace(/\/+$/, '');
}

function unwrapAsarPath(p) {
  const s = String(p || '');
  if (!s) return s;
  return s.replace(/app\.asar([\\/])/g, 'app.asar.unpacked$1');
}

function resolveFfmpegBin() {
  try {
    const mod = require('@ffmpeg-installer/ffmpeg');
    const p = mod && (mod.path || mod.ffmpegPath) ? (mod.path || mod.ffmpegPath) : null;
    if (typeof p === 'string' && p) return unwrapAsarPath(p);
  } catch {}
  return null;
}

function resolveFfprobeBin() {
  try {
    const mod = require('@ffprobe-installer/ffprobe');
    const p = mod && (mod.path || mod.ffprobePath) ? (mod.path || mod.ffprobePath) : null;
    if (typeof p === 'string' && p) return unwrapAsarPath(p);
  } catch {}
  return null;
}

function resolveKuboBin() {
  try {
    const mod = require('kubo');
    const p = typeof mod?.path === 'function' ? mod.path() : mod?.path;
    if (typeof p === 'string' && p) return unwrapAsarPath(p);
  } catch {}
  return null;
}

function userIpfsRepoPath() {
  return path.join(app.getPath('userData'), 'ipfs');
}

function safeBaseName(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'video';
  const stripped = raw.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, ' ').trim();
  const base = stripped.length > 120 ? stripped.slice(0, 120).trim() : stripped;
  return base || 'video';
}

function extLower(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : '';
}

function spawnCapture(bin, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (d) => { out += String(d || ''); });
    child.stderr?.on('data', (d) => { err += String(d || ''); });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: Number(code ?? -1), stdout: out, stderr: err });
    });
  });
}

async function kuboCatToFile(arg, outPath, opts = {}) {
  const signal = opts && opts.signal ? opts.signal : undefined;
  const onProgress = typeof opts?.onProgress === 'function' ? opts.onProgress : null;
  const u = new URL(`${ipfsApiBase()}/api/v0/cat`);
  u.searchParams.set('arg', String(arg || '').trim());
  const res = await fetch(u.toString(), { method: 'POST', signal });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`kubo_cat_http_${res.status}${txt ? ':' + txt.slice(0, 180) : ''}`);
  }
  if (!res.body) throw new Error('kubo_cat_no_body');
  const totalBytesRaw = Number(res.headers.get('content-length'));
  const totalBytes = Number.isFinite(totalBytesRaw) && totalBytesRaw > 0 ? totalBytesRaw : null;
  const nodeStream = Readable.fromWeb(res.body);
  let bytesDownloaded = 0;
  let lastEmitAt = 0;
  let lastEmitBytes = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      const size = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      bytesDownloaded += size;
      const now = Date.now();
      const shouldEmit =
        !!onProgress &&
        (now - lastEmitAt >= DOWNLOAD_PROGRESS_MIN_INTERVAL_MS ||
          bytesDownloaded - lastEmitBytes >= DOWNLOAD_PROGRESS_MIN_STEP_BYTES);
      if (shouldEmit) {
        lastEmitAt = now;
        lastEmitBytes = bytesDownloaded;
        try {
          onProgress({ bytesDownloaded, totalBytes });
        } catch {}
      }
      cb(null, chunk);
    },
  });
  await pipeline(nodeStream, counter, fs.createWriteStream(outPath));
  if (onProgress) {
    try {
      onProgress({ bytesDownloaded, totalBytes });
    } catch {}
  }
  const st = fs.statSync(outPath);
  if (!st.size) throw new Error('kubo_cat_empty');
  return st.size;
}

async function getDurationSec(ffprobeBin, inPath) {
  try {
    const r = await spawnCapture(ffprobeBin, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1',
      inPath,
    ]);
    const s = String(r.stdout || '').trim();
    const v = Number(s);
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    // ignore
  }

  try {
    const r = await spawnCapture(ffprobeBin, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=duration',
      '-of', 'default=nw=1:nk=1',
      inPath,
    ]);
    const s = String(r.stdout || '').trim();
    const v = Number(s);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

async function hasAudio(ffprobeBin, inPath) {
  try {
    const r = await spawnCapture(ffprobeBin, [
      '-hide_banner', '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=index',
      '-of', 'json',
      inPath,
    ]);
    if (r.code !== 0) return true;
    const j = JSON.parse(String(r.stdout || '{}'));
    return Array.isArray(j?.streams) && j.streams.length > 0;
  } catch {
    return true;
  }
}

async function getFps(ffprobeBin, inPath) {
  try {
    const r = await spawnCapture(ffprobeBin, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=r_frame_rate',
      '-of', 'default=nw=1:nk=1',
      inPath,
    ]);
    const frac = String(r.stdout || '25/1').trim() || '25/1';
    if (frac.includes('/')) {
      const [numS, denS] = frac.split('/');
      const num = Number(numS);
      const den = Number(denS);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) return num / den;
      return 25;
    }
    const v = Number(frac);
    return Number.isFinite(v) && v > 0 ? v : 25;
  } catch {
    return 25;
  }
}

async function extractCleanAudio(ffmpegBin, inPath, outM4a, audioBitrate = '128k') {
  const afChain =
    'aresample=async=1000:min_hard_comp=0.100:first_pts=0:osf=s16,' +
    'aformat=sample_rates=48000:channel_layouts=stereo';
  const r = await spawnCapture(ffmpegBin, [
    '-y',
    '-hide_banner',
    '-err_detect', 'ignore_err',
    '-fflags', '+discardcorrupt',
    '-analyzeduration', '200M',
    '-probesize', '200M',
    '-i', inPath,
    '-vn', '-sn', '-dn',
    '-map', '0:a:0?',
    '-af', afChain,
    '-ar', '48000',
    '-ac', '2',
    '-c:a', 'aac',
    '-b:a', String(audioBitrate || '128k'),
    '-movflags', '+faststart',
    outM4a,
  ]);
  if (r.code !== 0) return false;
  try {
    const st = fs.statSync(outM4a);
    return st.size > 0;
  } catch {
    return false;
  }
}

function parseFfmpegOutTimeMs(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d+):(\d+):(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const hh = Number(m[1] || 0);
  const mm = Number(m[2] || 0);
  const ss = Number(m[3] || 0);
  const frac = String(m[4] || '');
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  const msPart = frac ? Number(frac.padEnd(3, '0').slice(0, 3)) : 0;
  if (!Number.isFinite(msPart)) return null;
  return (hh * 3600 + mm * 60 + ss) * 1000 + msPart;
}

function killProcessTree(child) {
  if (!child || typeof child.kill !== 'function') return;
  try {
    if (child.killed) return;
    child.kill('SIGTERM');
  } catch {}
  setTimeout(() => {
    try {
      if (!child.killed) child.kill('SIGKILL');
    } catch {}
  }, 1500);
}

function ensureDirs(dir, n) {
  for (let i = 0; i < n; i++) {
    fs.mkdirSync(path.join(dir, `v${i}`), { recursive: true });
  }
}

function walkSizeBytes(rootDir) {
  let total = 0;
  const stack = [rootDir];
  while (stack.length) {
    const cur = stack.pop();
    const ents = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        try { total += fs.statSync(p).size; } catch {}
      }
    }
  }
  return total;
}

async function ipfsAddDirFromDisk(dirPath, opts = {}) {
  const signal = opts && opts.signal ? opts.signal : undefined;
  const onSpawn = typeof opts.onSpawn === 'function' ? opts.onSpawn : null;
  const kubo = require('kubo');
  const ipfsBinRaw = typeof kubo?.path === 'function' ? kubo.path() : kubo?.path;
  const ipfsBin = unwrapAsarPath(String(ipfsBinRaw || 'ipfs'));
  const repoPath = userIpfsRepoPath();
  const env = { ...process.env, IPFS_PATH: repoPath };

  const r = await new Promise((resolve, reject) => {
    const child = spawn(ipfsBin, [
      'add',
      '-r',
      '-Q',
      '--pin=true',
      '--cid-version=1',
      '--raw-leaves=true',
      dirPath,
    ], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    onSpawn?.(child);

    let out = '';
    let err = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (d) => { out += String(d || ''); });
    child.stderr?.on('data', (d) => { err += String(d || ''); });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: Number(code ?? -1), stdout: out, stderr: err });
    });

    if (signal) {
      if (signal.aborted) killProcessTree(child);
      signal.addEventListener('abort', () => killProcessTree(child), { once: true });
    }
  });

  if (signal?.aborted) throw new Error('cancelled');

  if (r.code !== 0) {
    const msg = (r.stderr || r.stdout || '').trim();
    throw new Error(msg || `ipfs_add_failed_${r.code}`);
  }
  const cid = String(r.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '';
  if (!cid) throw new Error('ipfs_add_no_cid');
  return cid;
}

function psQuote(v) {
  return `'${String(v || '').replace(/'/g, "''")}'`;
}

function pathSizeBytes(targetPath) {
  try {
    const st = fs.statSync(targetPath);
    if (st.isFile()) return st.size;
    if (st.isDirectory()) return walkSizeBytes(targetPath);
  } catch {}
  return 0;
}

async function spawnTrackedProcess({
  bin,
  args,
  opts = {},
  signal,
  onSpawn,
  onProgress,
  stage,
  watchPath,
  totalBytes,
  percentStart,
  percentEnd,
}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(bin, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    onSpawn?.(child);

    let out = '';
    let err = '';
    const MAX_ERR = 2000;
    child.stderr?.setEncoding('utf8');
    child.stdout?.setEncoding('utf8');
    child.stderr?.on('data', (d) => {
      err = (err + String(d || '')).slice(-MAX_ERR);
    });
    child.stdout?.on('data', (d) => {
      out = (out + String(d || '')).slice(-MAX_ERR);
    });

    let lastBytes = -1;
    let lastPct = -1;
    const timer = setInterval(() => {
      if (!watchPath || typeof onProgress !== 'function') return;
      const bytes = pathSizeBytes(watchPath);
      if (bytes === lastBytes && !totalBytes) return;
      lastBytes = bytes;

      let percent = null;
      if (Number.isFinite(totalBytes) && totalBytes > 0) {
        const ratio = Math.max(0, Math.min(1, bytes / totalBytes));
        percent = Math.max(
          percentStart,
          Math.min(percentEnd, Math.round(percentStart + ratio * (percentEnd - percentStart))),
        );
      }
      if (percent === lastPct && bytes > 0) return;
      lastPct = percent;
      try {
        onProgress({
          stage,
          percent,
          bytesProcessed: bytes,
          totalBytes: Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : undefined,
        });
      } catch {}
    }, 500);

    const cleanup = () => {
      try { clearInterval(timer); } catch {}
    };

    child.on('error', (e) => {
      cleanup();
      reject(e);
    });
    child.on('close', (code) => {
      cleanup();
      const finalBytes = watchPath ? pathSizeBytes(watchPath) : 0;
      if (typeof onProgress === 'function') {
        try {
          onProgress({
            stage,
            percent: Number.isFinite(totalBytes) && totalBytes > 0 ? percentEnd : undefined,
            bytesProcessed: finalBytes,
            totalBytes: Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : undefined,
          });
        } catch {}
      }
      resolve({ code: Number(code ?? -1), stdout: out, stderr: err, bytesProcessed: finalBytes });
    });

    if (signal) {
      if (signal.aborted) killProcessTree(child);
      signal.addEventListener('abort', () => killProcessTree(child), { once: true });
    }
  });
}

async function exportHlsArchiveWindows({ rootCid, name, expectedSizeBytes, signal, onProgress, onSpawn }) {
  if (process.platform !== 'win32') throw new Error('unsupported_platform');
  const cid = String(rootCid || '').trim();
  if (!cid) throw new Error('missing_root_cid');

  const ipfsBin = resolveKuboBin();
  if (!ipfsBin) throw new Error('ipfs_unavailable');
  const emit = (payload) => {
    if (typeof onProgress !== 'function') return;
    try { onProgress(payload); } catch {}
  };

  const baseNameRaw = safeBaseName(name).replace(/\s-\s*hls$/i, '').trim();
  const baseName = baseNameRaw || 'video';
  const defaultPath = path.join(app.getPath('downloads'), `${baseName}.zip`);
  emit({ stage: 'selecting-path' });
  const picked = await dialog.showSaveDialog({
    title: 'Save HLS archive',
    defaultPath,
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (picked.canceled || !picked.filePath) return { ok: false, error: 'cancelled' };
  if (signal?.aborted) throw new Error('cancelled');

  const tmpRoot = fs.mkdtempSync(path.join(app.getPath('temp'), 'lumen-hls-export-'));
  const sourcePath = path.join(tmpRoot, baseName);
  const targetPath = String(picked.filePath);

  try {
    logHls('archive export start', { rootCid: cid, name, sourcePath, targetPath });
    const env = { ...process.env, IPFS_PATH: userIpfsRepoPath() };
    emit({ stage: 'preparing', percent: 0 });

    const totalBytesHint =
      Number.isFinite(Number(expectedSizeBytes)) && Number(expectedSizeBytes) > 0
        ? Number(expectedSizeBytes)
        : null;

    const getRes = await spawnTrackedProcess({
      bin: ipfsBin,
      args: ['get', cid, '-o', sourcePath],
      opts: { env },
      signal,
      onSpawn,
      onProgress: emit,
      stage: 'fetching',
      watchPath: sourcePath,
      totalBytes: totalBytesHint,
      percentStart: 3,
      percentEnd: 82,
    });
    if (getRes.code !== 0) {
      if (signal?.aborted) throw new Error('cancelled');
      throw new Error(String(getRes.stderr || getRes.stdout || 'ipfs_get_failed').trim());
    }
    if (signal?.aborted) throw new Error('cancelled');

    const sourceBytes = pathSizeBytes(sourcePath) || totalBytesHint || null;
    emit({
      stage: 'zipping',
      percent: sourceBytes ? 82 : null,
      bytesProcessed: 0,
      totalBytes: sourceBytes || undefined,
    });

    const psScript = [
      "$ErrorActionPreference = 'Stop'",
      `$src = ${psQuote(sourcePath)}`,
      `$dst = ${psQuote(targetPath)}`,
      "if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue }",
      'try {',
      '  Compress-Archive -LiteralPath $src -DestinationPath $dst -CompressionLevel NoCompression -Force',
      '} catch {',
      '  if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue }',
      '  Compress-Archive -LiteralPath $src -DestinationPath $dst -Force',
      '}',
    ].join('; ');
    const zipRes = await spawnTrackedProcess({
      bin: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command', psScript],
      signal,
      onSpawn,
      onProgress: emit,
      stage: 'zipping',
      watchPath: targetPath,
      totalBytes: sourceBytes,
      percentStart: 82,
      percentEnd: 99,
    });
    if (zipRes.code !== 0) {
      if (signal?.aborted) throw new Error('cancelled');
      throw new Error(String(zipRes.stderr || zipRes.stdout || 'zip_failed').trim());
    }
    if (signal?.aborted) throw new Error('cancelled');

    let sizeBytes = 0;
    try {
      sizeBytes = fs.statSync(targetPath).size;
    } catch {}
    emit({ stage: 'done', percent: 100, bytesProcessed: sizeBytes, totalBytes: sizeBytes });
    logHls('archive export complete', { rootCid: cid, targetPath, sizeBytes });
    return { ok: true, filePath: targetPath, sizeBytes };
  } finally {
    try {
      if (signal?.aborted && targetPath && fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { force: true });
      }
    } catch {}
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  }
}

async function convertToHlsLadder({ cidOrPath, name, audioBitrate, signal, onProgress, onSpawn }) {
  const ffmpegBin = resolveFfmpegBin();
  const ffprobeBin = resolveFfprobeBin();
  if (!ffmpegBin) throw new Error('ffmpeg_unavailable');
  if (!ffprobeBin) throw new Error('ffprobe_unavailable');

  const emit = (payload) => {
    if (typeof onProgress !== 'function') return;
    try { onProgress(payload); } catch {}
  };

  const ladder = [
    { h: 720, vbit: 3000_000, maxrate: 3210_000, buf: 4_500_000 },
    { h: 480, vbit: 1500_000, maxrate: 1600_000, buf: 2_500_000 },
    { h: 360, vbit: 800_000, maxrate: 856_000, buf: 1_200_000 },
    { h: 240, vbit: 400_000, maxrate: 428_000, buf: 800_000 },
  ];

  const gopSec = 6;
  const segSec = 6;

  const tmpRoot = fs.mkdtempSync(path.join(app.getPath('temp'), 'lumen-hls-'));
  const cleanup = () => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  };

  try {
    logHls('convert start', { name, cidOrPath, tmpRoot });
    if (signal?.aborted) throw new Error('cancelled');
    const base = safeBaseName(name);
    const ext = extLower(base);
    const srcExt = ext ? `.${ext}` : '.mp4';
    const srcPath = path.join(tmpRoot, `source${srcExt}`);
    const outDir = path.join(tmpRoot, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    ensureDirs(outDir, ladder.length);

    emit({ stage: 'downloading', percent: 0 });
    const downloadStartedAt = Date.now();
    const downloadedBytes = await kuboCatToFile(String(cidOrPath || '').trim(), srcPath, {
      signal,
      onProgress: ({ bytesDownloaded, totalBytes }) => {
        const payload = { stage: 'downloading', bytesDownloaded, totalBytes };
        if (totalBytes && totalBytes > 0) {
          payload.percent = Math.max(0, Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)));
        }
        emit(payload);
      },
    });
    logHls('download complete', {
      name,
      bytes: downloadedBytes,
      elapsedMs: Date.now() - downloadStartedAt,
      srcPath,
    });
    if (signal?.aborted) throw new Error('cancelled');

    emit({ stage: 'probing' });
    const fps = await getFps(ffprobeBin, srcPath);
    const gop = Math.max(1, Math.round(gopSec * fps));
    const durationSec = await getDurationSec(ffprobeBin, srcPath);
    const durationMs = durationSec ? Math.round(durationSec * 1000) : null;
    logHls('probe complete', { name, fps, gop, durationSec });

    let audioPresent = await hasAudio(ffprobeBin, srcPath);
    let cleanAudioPath = null;
    if (audioPresent) {
      const tmpAudio = path.join(tmpRoot, 'audio_clean.m4a');
      emit({ stage: 'extracting-audio' });
      const audioStartedAt = Date.now();
      const ok = await extractCleanAudio(ffmpegBin, srcPath, tmpAudio, audioBitrate || '128k');
      logHls('audio extract complete', {
        name,
        ok,
        elapsedMs: Date.now() - audioStartedAt,
        audioBitrate: String(audioBitrate || '128k'),
      });
      if (ok) cleanAudioPath = tmpAudio;
      else audioPresent = false;
    }

    const cmd = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-progress', 'pipe:1',
      '-nostats',
      '-err_detect', 'ignore_err',
      '-fflags', '+discardcorrupt',
      '-analyzeduration', '200M',
      '-probesize', '200M',
      '-i', srcPath,
    ];
    if (cleanAudioPath) cmd.push('-i', cleanAudioPath);

    for (let i = 0; i < ladder.length; i++) {
      const rung = ladder[i];
      cmd.push('-map', '0:v:0');
      cmd.push(
        `-c:v:${i}`, 'libx264',
        `-preset:v:${i}`, 'veryfast',
        `-profile:v:${i}`, 'main',
        `-level:v:${i}`, '4.1',
        `-b:v:${i}`, String(rung.vbit),
        `-maxrate:v:${i}`, String(rung.maxrate),
        `-bufsize:v:${i}`, String(rung.buf),
        `-g:v:${i}`, String(gop),
        `-keyint_min:v:${i}`, String(gop),
        `-sc_threshold:v:${i}`, '0',
        `-filter:v:${i}`, `scale=-2:${rung.h}`,
      );
      if (cleanAudioPath) cmd.push('-map', '1:a:0');
    }
    if (cleanAudioPath) cmd.push('-c:a', 'copy');

    const pairs = [];
    for (let i = 0; i < ladder.length; i++) pairs.push(cleanAudioPath ? `v:${i},a:${i}` : `v:${i}`);
    const varmap = pairs.join(' ');

    cmd.push(
      '-f', 'hls',
      '-hls_time', String(segSec),
      '-hls_list_size', '0',
      '-hls_flags', 'independent_segments',
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', varmap,
      '-hls_segment_filename', 'v%v/seg_%05d.m4s',
      '-hls_segment_type', 'fmp4',
      // IMPORTANT: keep init segment filenames URL-safe for browser playback.
      // With `init_%v.mp4` ffmpeg can output files like `init_%v_0.mp4` (literal `%v`),
      // which is not a valid URI and breaks some HTTP clients / players.
      '-hls_fmp4_init_filename', 'init.mp4',
      'v%v/stream.m3u8',
    );

    logHls('transcode start', {
      name,
      ladderCount: ladder.length,
      hasCleanAudio: !!cleanAudioPath,
      ffmpegBin,
    });
    emit({ stage: 'transcoding', percent: 0 });
    const r = await new Promise((resolve, reject) => {
      const child = spawn(ffmpegBin, cmd, { cwd: outDir, stdio: ['ignore', 'pipe', 'pipe'] });
      onSpawn?.(child);

      let errTail = '';
      const MAX_ERR = 1400;
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (d) => {
        errTail = (errTail + String(d || '')).slice(-MAX_ERR);
      });

      const prog = { outTimeMs: 0, frame: 0, fps: 0, speed: '', lastEmitAt: 0, lastPct: -1, lastLoggedBucket: -1 };
      let buf = '';
      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (d) => {
        buf += String(d || '');
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || '';
        for (const line of lines) {
          const idx = line.indexOf('=');
          if (idx <= 0) continue;
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (k === 'out_time') {
            const ms = parseFfmpegOutTimeMs(v);
            if (ms != null) prog.outTimeMs = ms;
          } else if (k === 'out_time_ms') {
            const n = Number(v);
            if (Number.isFinite(n)) {
              // ffmpeg reports microseconds in some builds; guard with duration when available.
              const ms = durationMs && n > durationMs * 20 ? Math.round(n / 1000) : Math.round(n);
              if (Number.isFinite(ms)) prog.outTimeMs = ms;
            }
          } else if (k === 'frame') {
            const n = Number(v);
            if (Number.isFinite(n)) prog.frame = n;
          } else if (k === 'fps') {
            const n = Number(v);
            if (Number.isFinite(n)) prog.fps = n;
          } else if (k === 'speed') {
            prog.speed = v;
          } else if (k === 'progress') {
            const now = Date.now();
            if (durationMs && durationMs > 0) {
              const rawPct = Math.max(0, Math.min(100, Math.round((prog.outTimeMs / durationMs) * 100)));
              const shouldEmit = (now - prog.lastEmitAt > 250 && rawPct !== prog.lastPct) || v === 'end';
              if (shouldEmit) {
                prog.lastEmitAt = now;
                prog.lastPct = rawPct;
                const bucket = Math.floor(rawPct / 10);
                if (bucket !== prog.lastLoggedBucket || v === 'end') {
                  prog.lastLoggedBucket = bucket;
                  logHls('transcode progress', {
                    name,
                    percent: rawPct,
                    frame: prog.frame,
                    fps: prog.fps,
                    speed: prog.speed,
                  });
                }
                emit({
                  stage: 'transcoding',
                  percent: rawPct,
                  frame: prog.frame,
                  fps: prog.fps,
                  speed: prog.speed,
                });
              }
            }
          }
        }
      });

      child.on('error', reject);
      child.on('close', (code) => resolve({ code: Number(code ?? -1), stderr: errTail }));

      if (signal) {
        if (signal.aborted) killProcessTree(child);
        signal.addEventListener('abort', () => killProcessTree(child), { once: true });
      }
    });
    if (r.code !== 0) {
      if (signal?.aborted) throw new Error('cancelled');
      const tail = String(r.stderr || '').trim().slice(-1400);
      logHls('transcode failed', { name, error: tail || 'ffmpeg_failed' });
      throw new Error(tail || 'ffmpeg_failed');
    }
    logHls('transcode complete', { name });

    if (signal?.aborted) throw new Error('cancelled');
    const sizeBytes = walkSizeBytes(outDir);
    emit({ stage: 'adding', percent: 0 });
    logHls('ipfs add start', { name, outDir, sizeBytes });
    const cid = await ipfsAddDirFromDisk(outDir, { signal, onSpawn });
    if (signal?.aborted) throw new Error('cancelled');
    logHls('convert complete', { name, cid, sizeBytes, hasAudio: !!cleanAudioPath });

    return { cid, sizeBytes, hasAudio: !!cleanAudioPath };
  } finally {
    cleanup();
  }
}

function registerHlsIpc() {
  ipcMain.handle('drive:cancelHlsConvert', async (evt) => {
    const wcId = String(evt?.sender?.id || '');
    const job = wcId ? ACTIVE_HLS_CONVERSIONS.get(wcId) : null;
    if (!job) return { ok: false, error: 'no_active_job' };
    try {
      job.abort?.();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'cancel_failed') };
    }
  });

  ipcMain.handle('drive:convertToHls', async (_evt, args) => {
    try {
      const wcId = String(_evt?.sender?.id || '');
      if (wcId && ACTIVE_HLS_CONVERSIONS.has(wcId)) {
        return { ok: false, error: 'convert_in_progress' };
      }

      const cidOrPath = String(args?.cidOrPath || '').trim();
      const name = String(args?.name || '').trim();
      if (!cidOrPath) return { ok: false, error: 'missing_cid' };
      if (!name) return { ok: false, error: 'missing_name' };
      const ext = extLower(name);
      if (!['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
        return { ok: false, error: 'not_a_video' };
      }
      logHls('ipc request', { wcId, cidOrPath, name });

      const controller = new AbortController();
      let activeChild = null;
      const abort = () => {
        try { controller.abort(); } catch {}
        killProcessTree(activeChild);
      };

      if (wcId) ACTIVE_HLS_CONVERSIONS.set(wcId, { abort });

      const sendProgress = (payload) => {
        try {
          _evt.sender.send('drive:hlsProgress', {
            stage: String(payload?.stage || ''),
            percent:
              typeof payload?.percent === 'number' && Number.isFinite(payload.percent)
                ? Math.max(0, Math.min(100, Math.round(payload.percent)))
                : null,
            frame: typeof payload?.frame === 'number' ? payload.frame : undefined,
            fps: typeof payload?.fps === 'number' ? payload.fps : undefined,
            speed: typeof payload?.speed === 'string' ? payload.speed : undefined,
            bytesDownloaded:
              typeof payload?.bytesDownloaded === 'number' && Number.isFinite(payload.bytesDownloaded)
                ? payload.bytesDownloaded
                : undefined,
            totalBytes:
              typeof payload?.totalBytes === 'number' && Number.isFinite(payload.totalBytes)
                ? payload.totalBytes
                : undefined,
          });
        } catch {}
      };

      const res = await convertToHlsLadder({
        cidOrPath,
        name,
        audioBitrate: String(args?.audioBitrate || '128k'),
        signal: controller.signal,
        onProgress: sendProgress,
        onSpawn: (child) => {
          activeChild = child;
          if (controller.signal?.aborted) killProcessTree(child);
        },
      });
      sendProgress({ stage: 'done', percent: 100 });
      return { ok: true, ...res };
    } catch (e) {
      const msg = String(e?.message || e || 'convert_failed');
      logHls('ipc failure', { error: msg });
      const lower = msg.toLowerCase();
      if (lower.includes('abort') || lower.includes('cancel') || lower.includes('aborted')) {
        return { ok: false, error: 'cancelled' };
      }
      return { ok: false, error: msg };
    } finally {
      const wcId = String(_evt?.sender?.id || '');
      if (wcId) ACTIVE_HLS_CONVERSIONS.delete(wcId);
    }
  });

  ipcMain.handle('drive:cancelHlsArchiveDownload', async (evt) => {
    const wcId = String(evt?.sender?.id || '');
    const job = wcId ? ACTIVE_HLS_ARCHIVE_EXPORTS.get(wcId) : null;
    if (!job) return { ok: false, error: 'no_active_job' };
    try {
      job.abort?.();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'cancel_failed') };
    }
  });

  ipcMain.handle('drive:downloadHlsArchive', async (_evt, args) => {
    try {
      const wcId = String(_evt?.sender?.id || '');
      if (wcId && ACTIVE_HLS_ARCHIVE_EXPORTS.has(wcId)) {
        return { ok: false, error: 'download_in_progress' };
      }

      const controller = new AbortController();
      let activeChild = null;
      const abort = () => {
        try { controller.abort(); } catch {}
        killProcessTree(activeChild);
      };

      if (wcId) ACTIVE_HLS_ARCHIVE_EXPORTS.set(wcId, { abort });

      const sendProgress = (payload) => {
        try {
          _evt.sender.send('drive:hlsArchiveProgress', {
            stage: String(payload?.stage || ''),
            percent:
              typeof payload?.percent === 'number' && Number.isFinite(payload.percent)
                ? Math.max(0, Math.min(100, Math.round(payload.percent)))
                : null,
            bytesProcessed:
              typeof payload?.bytesProcessed === 'number' && Number.isFinite(payload.bytesProcessed)
                ? payload.bytesProcessed
                : undefined,
            totalBytes:
              typeof payload?.totalBytes === 'number' && Number.isFinite(payload.totalBytes)
                ? payload.totalBytes
                : undefined,
          });
        } catch {}
      };

      return await exportHlsArchiveWindows({
        rootCid: String(args?.rootCid || ''),
        name: String(args?.name || ''),
        expectedSizeBytes: Number(args?.expectedSizeBytes || 0) || 0,
        signal: controller.signal,
        onProgress: sendProgress,
        onSpawn: (child) => {
          activeChild = child;
          if (controller.signal?.aborted) killProcessTree(child);
        },
      });
    } catch (e) {
      const msg = String(e?.message || e || 'download_failed');
      logHls('archive export failure', { error: msg });
      const lower = msg.toLowerCase();
      if (lower.includes('cancel')) return { ok: false, error: 'cancelled' };
      return { ok: false, error: msg };
    } finally {
      const wcId = String(_evt?.sender?.id || '');
      if (wcId) ACTIVE_HLS_ARCHIVE_EXPORTS.delete(wcId);
    }
  });
}

module.exports = { registerHlsIpc };
