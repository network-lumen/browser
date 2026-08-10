const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function userDataPath(...segments) {
  const dir = app.getPath('userData');
  const full = path.join(dir, ...segments);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return full;
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
}

function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Writes a file so an interrupted run cannot leave half of it behind.
 *
 * Beside, flushed, then renamed over. A plain `writeFileSync` truncates the
 * target first and fills it after, so a crash or a power cut in between leaves
 * a valid file name holding invalid content - and every reader here treats
 * unparseable as empty. On `profiles.json` that means the profile list is gone.
 *
 * The fsync matters as much as the rename: without it the rename can reach the
 * disk before the bytes do, which is the same failure with extra steps. Rename
 * replaces an existing file atomically on POSIX and on Windows alike, so there
 * is never a moment with no file at all.
 */
function writeFileAtomic(file, contents) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  let fd;
  try {
    fd = fs.openSync(tmp, 'w');
    // A Buffer is written as-is: secret.bin is 32 random bytes, and encoding
    // those as utf8 would replace every byte outside ASCII and quietly destroy
    // the key every keystore is derived from.
    if (Buffer.isBuffer(contents)) fs.writeFileSync(fd, contents);
    else fs.writeFileSync(fd, contents, 'utf8');
    try {
      fs.fsyncSync(fd);
    } catch {
      // Not every filesystem supports it; the rename below is still ordered.
    }
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }

  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw e;
  }
}

/**
 * Writes several files as close to together as a filesystem allows.
 *
 * Every temporary file is written and flushed before any of them is renamed
 * into place, so a failure while producing the new content changes nothing at
 * all. What remains is the run of renames: a crash inside that window can still
 * leave some files new and some old, and no filesystem call removes it without
 * a journal.
 *
 * That window matters because of what uses this: re-encrypting every keystore
 * under a new password. Getting halfway used to mean one wallet kept the old
 * password while the app had moved to the new one, and that wallet could never
 * be opened again.
 *
 * @param entries {Array<{ file: string, contents: string | Buffer }>}
 */
function writeFilesAtomic(entries) {
  const staged = [];
  try {
    for (const { file, contents } of entries) {
      ensureDir(path.dirname(file));
      const tmp = `${file}.tmp`;
      let fd;
      try {
        fd = fs.openSync(tmp, 'w');
        if (Buffer.isBuffer(contents)) fs.writeFileSync(fd, contents);
        else fs.writeFileSync(fd, contents, 'utf8');
        try {
          fs.fsyncSync(fd);
        } catch {}
      } finally {
        if (fd !== undefined) {
          try {
            fs.closeSync(fd);
          } catch {}
        }
      }
      staged.push({ tmp, file });
    }
  } catch (e) {
    for (const { tmp } of staged) {
      try {
        fs.unlinkSync(tmp);
      } catch {}
    }
    throw e;
  }

  for (const { tmp, file } of staged) {
    fs.renameSync(tmp, file);
  }
}

function writeJson(file, data) {
  writeFileAtomic(file, JSON.stringify(data, null, 2));
}

module.exports = {
  userDataPath,
  ensureDir,
  readJson,
  writeJson,
  writeFileAtomic,
  writeFilesAtomic
};

