import { describe, expect, it } from 'vitest';

/**
 * Which key combination means what.
 *
 * Two listeners read the same `before-input-event` - devtools and find-in-page -
 * and each used to carry its own idea of a shortcut. The pair that matters is
 * Escape and F12: Escape has to reach the find bar and nothing else, and F12 is
 * the only devtools key a packaged build honours, so a change that widened
 * either would open devtools on arbitrary web content in production.
 */

const require_ = (await import('node:module')).createRequire(import.meta.url);
const { isDevtoolsToggle, isDevtoolsF12, parseFindAction, isKeyDown } =
  require_('../../electron/hotkeys.cjs');

const key = (over: Record<string, unknown> = {}) => ({ type: 'keyDown', key: '', ...over });

describe('reading an input event', () => {
  it('only answers to keyDown - char and keyUp repeat the same keys', () => {
    expect(isKeyDown(key({ key: 'F12' }))).toBe(true);
    expect(isDevtoolsToggle(key({ key: 'F12', type: 'keyUp' }))).toBe(false);
    expect(parseFindAction(key({ key: 'F', control: true, type: 'char' }))).toBeNull();
  });

  it('treats a missing type as a key press, which is what Electron sends', () => {
    expect(isKeyDown({ key: 'F12' })).toBe(true);
  });
});

describe('devtools', () => {
  it('answers to every combination Chrome does', () => {
    expect(isDevtoolsToggle(key({ key: 'F12' }))).toBe(true);
    expect(isDevtoolsToggle(key({ key: 'i', control: true, shift: true }))).toBe(true);
    expect(isDevtoolsToggle(key({ key: 'I', meta: true, shift: true }))).toBe(true);
    expect(isDevtoolsToggle(key({ key: 'I', control: true, alt: true }))).toBe(true);
  });

  it('leaves a bare letter alone', () => {
    expect(isDevtoolsToggle(key({ key: 'I' }))).toBe(false);
    expect(isDevtoolsToggle(key({ key: 'I', control: true }))).toBe(false);
    expect(isDevtoolsToggle(key({ key: 'F' }))).toBe(false);
  });

  it('recognises F12 alone, and nothing else, for the packaged build', () => {
    expect(isDevtoolsF12(key({ key: 'F12' }))).toBe(true);
    expect(isDevtoolsF12(key({ key: 'I', control: true, shift: true }))).toBe(false);
  });
});

describe('find in page', () => {
  it('opens on the platform shortcut', () => {
    expect(parseFindAction(key({ key: 'f', control: true }))).toEqual({ action: 'open' });
    expect(parseFindAction(key({ key: 'F', meta: true }))).toEqual({ action: 'open' });
  });

  it('steps forward and back', () => {
    expect(parseFindAction(key({ key: 'F3' }))).toEqual({ action: 'next' });
    expect(parseFindAction(key({ key: 'F3', shift: true }))).toEqual({ action: 'prev' });
    expect(parseFindAction(key({ key: 'g', control: true }))).toEqual({ action: 'next' });
    expect(parseFindAction(key({ key: 'g', control: true, shift: true }))).toEqual({ action: 'prev' });
  });

  it('closes on Escape, spelled either way', () => {
    expect(parseFindAction(key({ key: 'Escape' }))).toEqual({ action: 'close' });
    expect(parseFindAction(key({ key: 'Esc' }))).toEqual({ action: 'close' });
  });

  it('keeps its hands off Alt, which opens menus', () => {
    expect(parseFindAction(key({ key: 'F', control: true, alt: true }))).toBeNull();
    expect(parseFindAction(key({ key: 'F' }))).toBeNull();
    expect(parseFindAction(key({ key: 'A', control: true }))).toBeNull();
  });
});
