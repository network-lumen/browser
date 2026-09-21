/**
 * The mobile port of `electron/ipc/security.cjs`.
 *
 * The session password lives in a module-level variable, exactly as it does in
 * the main process - it is never written anywhere. The difference is what
 * "the app closed" means: on the desktop the main process dies and takes the
 * variable with it, while on Android the WebView can be torn down and rebuilt
 * under a task the user thinks never left. That is handled in `lifecycle.ts`,
 * not here.
 *
 * The ordering in `setPassword` and `removePassword` is copied from the
 * desktop deliberately and must stay: every keystore is re-sealed FIRST, and
 * the stored hash only moves if all of them made it. Storing the hash first
 * leaves a wallet encrypted with a password the app no longer knows, and there
 * is no way back from that.
 */

import type { PasswordHash, SecurityStatus } from '../../../src/types/platformBridge';
import { hashPassword, verifyPassword } from './crypto';
import { reEncryptAllKeystores, reEncryptToDeviceSecret, changeKeystorePassword } from './profiles';
import { getSessionTimeoutMs, getSettings, setSettings } from './settings';

let sessionPassword: string | null = null;
let sessionExpiry: number | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;

const sessionListeners = new Set<(payload: { active: boolean }) => void>();

function broadcast(active: boolean): void {
  for (const fn of sessionListeners) {
    try {
      fn({ active });
    } catch {
      // One bad subscriber must not silence the rest.
    }
  }
}

function cancelTimer(): void {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

function scheduleAutoLock(): void {
  cancelTimer();
  if (!sessionPassword || sessionExpiry === null) return;
  const delay = Math.max(0, sessionExpiry - Date.now()) + 50;
  sessionTimer = setTimeout(() => {
    if (!sessionPassword || sessionExpiry === null) return;
    // A touch may have pushed the expiry out while the timer was pending.
    if (Date.now() < sessionExpiry) {
      scheduleAutoLock();
      return;
    }
    clearSession();
  }, delay);
}

export function getSessionPassword(): string | null {
  if (sessionPassword && sessionExpiry !== null && Date.now() >= sessionExpiry) {
    // Timers do not fire while the app is backgrounded, so the expiry is
    // re-checked on read as well - otherwise a phone left overnight comes back
    // unlocked because no timer ever got to run.
    clearSession();
    return null;
  }
  return sessionPassword;
}

export function clearSession(): void {
  sessionPassword = null;
  sessionExpiry = null;
  cancelTimer();
  broadcast(false);
}

export async function startSession(password: string): Promise<void> {
  sessionPassword = password;
  const timeout = await getSessionTimeoutMs();
  // 0 means "until restart": no expiry, so nothing to schedule.
  sessionExpiry = timeout > 0 ? Date.now() + timeout : null;
  scheduleAutoLock();
  broadcast(true);
}

async function touch(): Promise<boolean> {
  if (!getSessionPassword()) return false;
  const timeout = await getSessionTimeoutMs();
  sessionExpiry = timeout > 0 ? Date.now() + timeout : null;
  scheduleAutoLock();
  return true;
}

async function storedHash(): Promise<PasswordHash | null> {
  const settings = await getSettings();
  return (settings.securityPasswordHash as PasswordHash | null) ?? null;
}

export async function isPasswordEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return !!settings.securityPasswordEnabled && !!settings.securityPasswordHash;
}

async function status(): Promise<SecurityStatus> {
  const settings = await getSettings();
  return {
    passwordEnabled: !!settings.securityPasswordEnabled,
    hasPassword: !!settings.securityPasswordHash,
    sessionActive: !!getSessionPassword(),
    sessionTimeoutMs: await getSessionTimeoutMs()
  };
}

export const SECURITY_MEMBERS = {
  'security.getStatus': status,

  'security.setPassword': async (input: { password?: string; currentPassword?: string }) => {
    try {
      const password = String(input?.password ?? '').trim();
      const currentPassword = String(input?.currentPassword ?? '').trim();

      if (!password || password.length < 6) return { ok: false, error: 'password_too_short' };

      const hadPassword = !!(await storedHash());

      // Secrets first, hash second. See the note at the top of this file.
      let converted: { ok: boolean; error?: string; profileId?: string };
      if (hadPassword) {
        if (!currentPassword) return { ok: false, error: 'current_password_required' };
        if (!(await verifyPassword(currentPassword, await storedHash()))) {
          return { ok: false, error: 'invalid_current_password' };
        }
        converted = await changeKeystorePassword(currentPassword, password);
      } else {
        converted = await reEncryptAllKeystores(password);
      }

      if (!converted.ok) {
        console.warn('[platform/mobile] password change aborted, nothing was written:', converted);
        return converted;
      }

      await setSettings({
        securityPasswordEnabled: true,
        securityPasswordHash: await hashPassword(password)
      });
      await startSession(password);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  },

  'security.verifyPassword': async (input: { password?: string }) => {
    try {
      const password = String(input?.password ?? '').trim();
      if (!password) return { ok: false, error: 'password_required' };
      if (!(await verifyPassword(password, await storedHash()))) {
        return { ok: false, error: 'invalid_password' };
      }
      await startSession(password);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  },

  'security.removePassword': async (input: { password?: string }) => {
    try {
      const password = String(input?.password ?? '').trim();
      if (!password) return { ok: false, error: 'password_required' };
      if (!(await verifyPassword(password, await storedHash()))) {
        return { ok: false, error: 'invalid_password' };
      }

      // Same order as setting one: convert first, and only forget the password
      // if every secret came back under the device secret.
      const converted = await reEncryptToDeviceSecret(password);
      if (!converted.ok) {
        console.warn('[platform/mobile] password removal aborted, nothing was written:', converted);
        return converted;
      }

      await setSettings({ securityPasswordEnabled: false, securityPasswordHash: null });
      clearSession();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  },

  'security.lockSession': async () => {
    clearSession();
    return { ok: true };
  },

  'security.checkSession': async () => ({ active: !!getSessionPassword() }),

  'security.touchSession': async () =>
    (await touch()) ? { ok: true } : { ok: false, error: 'no_active_session' },

  'security.extendSession': async () =>
    (await touch()) ? { ok: true } : { ok: false, error: 'no_active_session' },

  'security.onSessionChanged': (callback: (payload: { active: boolean }) => void) => {
    sessionListeners.add(callback);
    return () => sessionListeners.delete(callback);
  }
};
