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

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  userDataPath,
  ensureDir,
  readJson,
  writeJson
};

