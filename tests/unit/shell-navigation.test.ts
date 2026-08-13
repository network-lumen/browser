import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * What may replace the app's own window.
 *
 * That window carries `preloads/preload.cjs` - the trusted bridge, with the
 * wallet, the profiles and the gateway server on it. Content belongs in a
 * `<webview>`, which gets the restricted preload instead; a page that reached
 * the top level of the shell would get everything.
 *
 * `setWindowOpenHandler` never covered this: it answers window.open and
 * target=_blank, not a plain link, a redirect, or `location.href = …`.
 */

const { isShellNavigation } = stubElectron().load<any>('windows.cjs');

const DEV = 'http://localhost:5173/';
const PACKAGED = 'file:///C:/Program%20Files/Lumen/resources/app/dist/index.html';

describe('while developing, the shell lives on the dev server', () => {
  it('lets it navigate within its own origin', () => {
    expect(isShellNavigation(DEV, 'http://localhost:5173/')).toBe(true);
    expect(isShellNavigation(DEV, 'http://localhost:5173/?splash=1')).toBe(true);
  });

  it('refuses another origin, however similar', () => {
    expect(isShellNavigation(DEV, 'http://localhost:5174/')).toBe(false);
    expect(isShellNavigation(DEV, 'https://localhost:5173/')).toBe(false);
    expect(isShellNavigation(DEV, 'http://localhost.evil.test/')).toBe(false);
    expect(isShellNavigation(DEV, 'https://example.test/')).toBe(false);
  });
});

describe('packaged, the shell is a file next to its assets', () => {
  it('lets it navigate within its own directory', () => {
    expect(isShellNavigation(PACKAGED, PACKAGED)).toBe(true);
    expect(
      isShellNavigation(PACKAGED, 'file:///C:/Program%20Files/Lumen/resources/app/dist/other.html'),
    ).toBe(true);
  });

  it('refuses the rest of the disk', () => {
    // Every file: URL reports an origin of "null", so comparing origins here
    // would wave through anything on the machine.
    expect(isShellNavigation(PACKAGED, 'file:///C:/Users/someone/secrets.html')).toBe(false);
    expect(isShellNavigation(PACKAGED, 'file:///C:/Program%20Files/Lumen/resources/app/index.html')).toBe(false);
  });
});

describe('everything else', () => {
  it('allows about:blank, which Chromium navigates to on its own', () => {
    expect(isShellNavigation(DEV, 'about:blank')).toBe(true);
  });

  it('refuses a scheme change, and anything unparseable', () => {
    expect(isShellNavigation(DEV, 'file:///C:/x.html')).toBe(false);
    expect(isShellNavigation(PACKAGED, 'http://localhost:5173/')).toBe(false);
    expect(isShellNavigation(DEV, 'lumen://home')).toBe(false);
    expect(isShellNavigation(DEV, 'javascript:alert(1)')).toBe(false);
    expect(isShellNavigation(DEV, '')).toBe(false);
    expect(isShellNavigation('', 'http://localhost:5173/')).toBe(false);
  });
});
