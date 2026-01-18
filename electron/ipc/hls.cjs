const { ipcMain, app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const crypto = require('node:crypto');
const { getSetting } = require('../settings.cjs');

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

async function kuboCatToFile(arg, outPath) {
  const u = new URL(`${ipfsApiBase()}/api/v0/cat`);
  u.searchParams.set('arg', String(arg || '').trim());
  const res = await fetch(u.toString(), { method: 'POST' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`kubo_cat_http_${res.status}${txt ? ':' + txt.slice(0, 180) : ''}`);
  }
  if (!res.body) throw new Error('kubo_cat_no_body');
  const nodeStream = Readable.fromWeb(res.body);
  await pipeline(nodeStream, fs.createWriteStream(outPath));
  const st = fs.statSync(outPath);
  if (!st.size) throw new Error('kubo_cat_empty');
  return st.size;
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

async function ipfsAddDirFromDisk(dirPath) {
  const kubo = require('kubo');
  const ipfsBinRaw = typeof kubo?.path === 'function' ? kubo.path() : kubo?.path;
  const ipfsBin = unwrapAsarPath(String(ipfsBinRaw || 'ipfs'));
  const repoPath = userIpfsRepoPath();
  const env = { ...process.env, IPFS_PATH: repoPath };

  const r = await spawnCapture(ipfsBin, [
    'add',
    '-r',
    '-Q',
    '--pin=true',
    '--cid-version=1',
    '--raw-leaves=true',
    dirPath,
  ], { env });

  if (r.code !== 0) {
    const msg = (r.stderr || r.stdout || '').trim();
    throw new Error(msg || `ipfs_add_failed_${r.code}`);
  }
  const cid = String(r.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '';
  if (!cid) throw new Error('ipfs_add_no_cid');
  return cid;
}

async function convertToHlsLadder({ cidOrPath, name, audioBitrate }) {
  const ffmpegBin = resolveFfmpegBin();
  const ffprobeBin = resolveFfprobeBin();
  if (!ffmpegBin) throw new Error('ffmpeg_unavailable');
  if (!ffprobeBin) throw new Error('ffprobe_unavailable');

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
    const base = safeBaseName(name);
    const ext = extLower(base);
    const srcExt = ext ? `.${ext}` : '.mp4';
    const srcPath = path.join(tmpRoot, `source${srcExt}`);
    const outDir = path.join(tmpRoot, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    ensureDirs(outDir, ladder.length);

    await kuboCatToFile(String(cidOrPath || '').trim(), srcPath);

    const fps = await getFps(ffprobeBin, srcPath);
    const gop = Math.max(1, Math.round(gopSec * fps));

    let audioPresent = await hasAudio(ffprobeBin, srcPath);
    let cleanAudioPath = null;
    if (audioPresent) {
      const tmpAudio = path.join(tmpRoot, 'audio_clean.m4a');
      const ok = await extractCleanAudio(ffmpegBin, srcPath, tmpAudio, audioBitrate || '128k');
      if (ok) cleanAudioPath = tmpAudio;
      else audioPresent = false;
    }

    const cmd = [
      '-y',
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

    const r = await spawnCapture(ffmpegBin, cmd, { cwd: outDir });
    if (r.code !== 0) {
      const tail = String(r.stderr || r.stdout || '').trim().slice(-1400);
      throw new Error(tail || 'ffmpeg_failed');
    }

    const sizeBytes = walkSizeBytes(outDir);
    const cid = await ipfsAddDirFromDisk(outDir);

    return { cid, sizeBytes, hasAudio: !!cleanAudioPath };
  } finally {
    cleanup();
  }
}

function registerHlsIpc() {
  ipcMain.handle('drive:convertToHls', async (_evt, args) => {
    try {
      const cidOrPath = String(args?.cidOrPath || '').trim();
      const name = String(args?.name || '').trim();
      if (!cidOrPath) return { ok: false, error: 'missing_cid' };
      if (!name) return { ok: false, error: 'missing_name' };
      const ext = extLower(name);
      if (!['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
        return { ok: false, error: 'not_a_video' };
      }

      const res = await convertToHlsLadder({
        cidOrPath,
        name,
        audioBitrate: String(args?.audioBitrate || '128k'),
      });
      return { ok: true, ...res };
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'convert_failed') };
    }
  });
}

module.exports = { registerHlsIpc };
