/**
 * Which key combination means what.
 *
 * Only the reading of an input event lives here - no windows, no webContents,
 * no IPC. Two places listen for `before-input-event` (devtools and find-in-page)
 * and each used to carry its own idea of what a shortcut looked like, so the
 * one question a reader has - "what does Ctrl+Shift+I do, and does F12 do the
 * same?" - was answered in two files that could disagree.
 *
 * Pure functions, so the answers can be tested without an Electron process.
 */

/** Chromium reports keyDown, keyUp and char; a shortcut is only the first. */
function isKeyDown(input) {
  const type = String(input?.type || '').toLowerCase();
  return !type || type === 'keydown';
}

function keyOf(input) {
  return String(input?.key || '').toUpperCase();
}

/** Ctrl on Windows and Linux, Cmd on macOS - the same shortcut to a user. */
function hasPrimaryModifier(input) {
  return !!(input?.control || input?.meta);
}

/**
 * Every way to ask for devtools that Chrome answers: F12, Ctrl+Shift+I (Cmd
 * on macOS) and the Ctrl+Alt+I that some keyboard layouts leave reachable.
 */
function isDevtoolsToggle(input) {
  if (!isKeyDown(input)) return false;
  const key = keyOf(input);
  if (key === 'F12') return true;
  if (key !== 'I') return false;
  if (input?.control && input?.alt) return true;
  return hasPrimaryModifier(input) && !!input?.shift;
}

/**
 * F12 alone. Packaged builds allow devtools only for a personal site that
 * asked for it, and only through this one key - the other combinations stay
 * shut so ordinary web and extension content cannot open a devtools window.
 */
function isDevtoolsF12(input) {
  return isKeyDown(input) && keyOf(input) === 'F12';
}

/**
 * The find bar's shortcuts. `null` for anything else, so a caller can return
 * early without knowing which keys are involved.
 *
 * Alt is excluded on purpose: Alt+F opens a menu on several platforms, and a
 * find bar stealing it is worse than not having the shortcut.
 */
function parseFindAction(input) {
  if (!isKeyDown(input)) return null;
  if (input?.alt) return null;

  const key = keyOf(input);
  const primary = hasPrimaryModifier(input);
  const shift = !!input?.shift;

  if (primary && key === 'F') return { action: 'open' };
  if (key === 'F3') return { action: shift ? 'prev' : 'next' };
  if (primary && key === 'G') return { action: shift ? 'prev' : 'next' };
  if (key === 'ESCAPE' || key === 'ESC') return { action: 'close' };

  return null;
}

module.exports = {
  isKeyDown,
  isDevtoolsToggle,
  isDevtoolsF12,
  parseFindAction,
};
