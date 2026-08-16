const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// In dev, app.getVersion() can answer with Electron's own version - when the app
// is launched with a direct main script path instead of the app directory. Any
// caller that keys state or an update check on the version needs the real one.
function currentAppVersion() {
  const vElectron = String((process.versions && process.versions.electron) || '').trim();
  let v = '';
  try {
    v = app && typeof app.getVersion === 'function' ? String(app.getVersion() || '').trim() : '';
  } catch {
    v = '';
  }

  if (v && vElectron && v !== vElectron) return v;

  const candidates = [];
  try {
    const appPath = app && typeof app.getAppPath === 'function' ? String(app.getAppPath() || '') : '';
    if (appPath) candidates.push(path.join(appPath, 'package.json'));
  } catch {}
  candidates.push(path.join(__dirname, '..', '..', 'package.json'));
  candidates.push(path.join(process.cwd(), 'package.json'));

  for (const pkgPath of candidates) {
    try {
      if (!pkgPath || !fs.existsSync(pkgPath)) continue;
      const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const pv = String(json && json.version ? json.version : '').trim();
      if (pv) return pv;
    } catch {
      // ignore
    }
  }

  return v || '';
}

module.exports = { currentAppVersion };
