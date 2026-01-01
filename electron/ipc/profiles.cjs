const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function getProfilesPath() {
  const dir = app.getPath('userData');
  return path.join(dir, 'profiles.json');
}

function loadProfilesFile() {
  const file = getProfilesPath();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
    const activeId = typeof parsed.activeId === 'string' ? parsed.activeId : '';
    return { profiles, activeId };
  } catch {
    return { profiles: [], activeId: '' };
  }
}

function saveProfilesFile(data) {
  const file = getProfilesPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } catch {}
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[profiles] failed to save', e);
  }
}

function makeProfileId(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `acc_${base}_${suffix}` : `acc_${suffix}`;
}

function hashHue(input) {
  let h = 0;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function colorIndexForName(name) {
  return hashHue(name || '') % 12;
}

function registerProfilesIpc() {
  ipcMain.handle('profiles:list', async () => {
    const { profiles, activeId } = loadProfilesFile();

    // No profiles at all -> bootstrap a guest profile
    if (!profiles.length) {
      const name = 'Guest';
      const p = { id: 'guest', name, colorIndex: colorIndexForName(name), role: 'guest' };
      saveProfilesFile({ profiles: [p], activeId: p.id });
      return { profiles: [p], activeId: p.id };
    }

    // If at least one non-guest profile exists, drop the guest from the list
    const hasUser = profiles.some((p) => p.role !== 'guest');
    if (hasUser) {
      const filtered = profiles.filter((p) => p.role !== 'guest');
      let nextActive = activeId;
      if (!filtered.find((p) => p.id === activeId)) {
        nextActive = filtered[0] ? filtered[0].id : '';
      }
      saveProfilesFile({ profiles: filtered, activeId: nextActive });
      return { profiles: filtered, activeId: nextActive };
    }

    return { profiles, activeId };
  });

  ipcMain.handle('profiles:getActive', async () => {
    const { profiles, activeId } = loadProfilesFile();
    const active = profiles.find((p) => p.id === activeId) || profiles[0] || null;
    return active || null;
  });

  ipcMain.handle('profiles:setActive', async (_evt, id) => {
    const { profiles, activeId } = loadProfilesFile();
    const exists = profiles.some((p) => p.id === id);
    const nextId = exists ? String(id) : activeId;
    saveProfilesFile({ profiles, activeId: nextId });
    return nextId;
  });

  ipcMain.handle('profiles:create', async (_evt, name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const { profiles } = loadProfilesFile();
    const id = makeProfileId(trimmed);
    const profile = { id, name: trimmed, colorIndex: colorIndexForName(trimmed), role: 'user' };
    const next = [...profiles, profile];
    saveProfilesFile({ profiles: next, activeId: id });
    return profile;
  });

  ipcMain.handle('profiles:export', async (_evt, id) => {
    const { profiles } = loadProfilesFile();
    const p = profiles.find((x) => x.id === id);
    if (!p) return null;
    return JSON.stringify(p, null, 2);
  });

  ipcMain.handle('profiles:import', async (_evt, json) => {
    try {
      const parsed = JSON.parse(String(json || ''));
      const name = String(parsed.name || '').trim();
      if (!name) return null;
      const { profiles } = loadProfilesFile();
      const existing = profiles.find((p) => p.id === parsed.id || p.name === name);
      if (existing) {
        saveProfilesFile({ profiles, activeId: existing.id });
        return existing;
      }
      const id = parsed.id ? String(parsed.id) : makeProfileId(name);
      const colorIndex = Number.isFinite(parsed.colorIndex)
        ? Number(parsed.colorIndex)
        : colorIndexForName(name);
      const role = parsed.role === 'guest' ? 'guest' : 'user';
      const profile = { id, name, colorIndex, role };
      const next = [...profiles, profile];
      saveProfilesFile({ profiles: next, activeId: id });
      return profile;
    } catch {
      return null;
    }
  });

  ipcMain.handle('profiles:delete', async (_evt, id) => {
    const { profiles, activeId } = loadProfilesFile();
    const targetId = String(id || '');
    const nextProfiles = profiles.filter((p) => p.id !== targetId);
    let nextActive = activeId;
    if (activeId === targetId) {
      nextActive = nextProfiles[0] ? nextProfiles[0].id : '';
    }
    saveProfilesFile({ profiles: nextProfiles, activeId: nextActive });
    return { profiles: nextProfiles, activeId: nextActive };
  });
}

module.exports = {
  registerProfilesIpc
};

