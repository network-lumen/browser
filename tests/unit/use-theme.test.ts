import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../../src/composables/useTheme';
import { STORAGE_KEYS } from '../../src/internal/services/storage';

/**
 * Which theme the app wears.
 *
 * Two things are worth pinning. The class list is exclusive - `dark` and
 * `system` must never both be on the root, since the two stylesheets set the
 * same variables and whichever loses is decided by file order rather than by
 * the user. And a stored value that is not one of the three has to fall back
 * instead of being written onto the root, where it would match no stylesheet
 * and leave the app unstyled.
 */

const { theme, effectiveTheme, setTheme, initTheme } = useTheme();

let matchesDark = false;
const listeners: ((e: MediaQueryListEvent) => void)[] = [];

beforeEach(() => {
  localStorage.clear();
  matchesDark = false;
  listeners.length = 0;
  document.documentElement.className = '';
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return matchesDark; },
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.push(fn),
    removeEventListener: () => {},
  })));
  setTheme('light');
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.className = '';
});

const rootClasses = () => Array.from(document.documentElement.classList);

describe('setTheme', () => {
  it('puts light on no class at all, which is the default stylesheet', () => {
    setTheme('light');
    expect(rootClasses()).toEqual([]);
    expect(effectiveTheme.value).toBe('light');
  });

  it('marks dark', () => {
    setTheme('dark');
    expect(rootClasses()).toEqual(['dark']);
    expect(effectiveTheme.value).toBe('dark');
  });

  it('marks system, and resolves it against the OS preference', () => {
    matchesDark = true;
    initTheme();
    setTheme('system');
    expect(rootClasses()).toEqual(['system']);
    expect(effectiveTheme.value).toBe('dark');
  });

  it('never leaves two theme classes on the root at once', () => {
    // Both stylesheets set the same variables; the winner would be decided by
    // file order rather than by the user.
    for (const next of ['dark', 'system', 'light', 'dark'] as const) {
      setTheme(next);
      expect(rootClasses().filter((c) => c === 'dark' || c === 'system').length).toBeLessThanOrEqual(1);
    }
  });

  it('remembers the choice', () => {
    setTheme('dark');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
  });

  it('leaves classes it does not own alone', () => {
    document.documentElement.classList.add('some-other-class');
    setTheme('dark');
    expect(rootClasses()).toContain('some-other-class');
  });
});

describe('initTheme', () => {
  it('restores what was stored', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'dark');
    initTheme();
    expect(theme.value).toBe('dark');
    expect(rootClasses()).toEqual(['dark']);
  });

  it('ignores a stored value that is not one of the three', () => {
    // Writing it onto the root would match no stylesheet at all.
    localStorage.setItem(STORAGE_KEYS.theme, 'midnight');
    setTheme('light');
    initTheme();
    expect(theme.value).toBe('light');
    expect(rootClasses()).toEqual([]);
  });

  it('follows the OS when it changes, in system mode', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'system');
    initTheme();
    expect(effectiveTheme.value).toBe('light');

    matchesDark = true;
    for (const fn of listeners) fn({ matches: true } as MediaQueryListEvent);
    expect(effectiveTheme.value).toBe('dark');
    expect(rootClasses()).toEqual(['system']);
  });

  it('does not follow the OS once a theme was chosen explicitly', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'light');
    initTheme();
    for (const fn of listeners) fn({ matches: true } as MediaQueryListEvent);
    expect(effectiveTheme.value).toBe('light');
  });
});
