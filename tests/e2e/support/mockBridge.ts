import {
  REQUIRED_FUNCTIONS,
  REQUIRED_NAMESPACES,
  REQUIRED_VALUES,
} from '../../../src/internal/common/lumenBridgeSurface';

/**
 * A stand-in for the Electron bridge, built from the same inventory the real
 * startup check uses.
 *
 * These tests run the renderer in a browser, where `window.lumen` does not
 * exist - `checkLumenAPIReferences()` would put the app straight into its fatal
 * error screen and nothing else would be reachable. Injecting a mock is what
 * makes the real components, the real modals and the real wiring testable at
 * all.
 *
 * Generating it from `lumenBridgeSurface` rather than listing methods by hand
 * means it cannot drift: a method added to the bridge appears here on its own,
 * and the unit test that holds that inventory to `preloads/preload.cjs` keeps the whole
 * chain honest.
 */

/** What an un-stubbed bridge call returns. Enough for a caller to not crash. */
const DEFAULT_REPLY = { ok: true };

export type BridgeOverrides = Record<string, unknown>;

/**
 * Serialised and evaluated inside the page, so it cannot close over anything
 * here. Overrides arrive as source strings for the same reason.
 */
export function buildBridgeInitScript(overrides: Record<string, string> = {}): string {
  const surface = {
    functions: [...REQUIRED_FUNCTIONS],
    values: [...REQUIRED_VALUES],
    namespaces: Object.fromEntries(
      Object.entries(REQUIRED_NAMESPACES).map(([k, v]) => [k, [...v]])
    ),
  };

  return `
(() => {
  const surface = ${JSON.stringify(surface)};
  const overrides = { ${Object.entries(overrides)
    .map(([path, source]) => `${JSON.stringify(path)}: ${source}`)
    .join(',\n    ')} };

  const calls = [];
  window.__bridgeCalls = calls;

  const DEFAULT = ${JSON.stringify(DEFAULT_REPLY)};

  function make(path) {
    const override = overrides[path];
    return (...args) => {
      calls.push({ path, args });
      if (typeof override === 'function') return override(...args);
      if (override !== undefined) return Promise.resolve(override);
      // Subscription-style calls hand back an unsubscribe; returning a
      // function for everything would break callers that await a result, so
      // this is decided by name.
      if (/^(on|.*On)[A-Z]/.test(path.split('.').pop())) return () => {};
      return Promise.resolve(DEFAULT);
    };
  }

  const lumen = {};
  for (const name of surface.functions) lumen[name] = make(name);
  for (const name of surface.values) lumen[name] = overrides[name] ?? '';
  for (const [ns, members] of Object.entries(surface.namespaces)) {
    lumen[ns] = {};
    for (const m of members) lumen[ns][m] = make(ns + '.' + m);
  }

  window.lumen = lumen;
  window.electronAPI = lumen;
})();
`;
}
