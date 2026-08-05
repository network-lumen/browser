import type {
  REQUIRED_FUNCTIONS,
  REQUIRED_NAMESPACES,
  REQUIRED_VALUES
} from '../internal/common/lumenBridgeSurface';

/**
 * A method on the preload bridge.
 *
 * Arguments and return stay `any` on purpose. The names come from a list that
 * CI keeps identical to `electron/preload.cjs`, so they are worth trusting;
 * the signatures are not written down anywhere, and inventing them would trade
 * an honest `any` for a confident lie. What this buys is real all the same: a
 * mistyped or removed member is now a compile error rather than `undefined is
 * not a function` at runtime.
 */
type LumenBridgeMethod = (...args: any[]) => any;

/** `window.lumen.<name>()` */
type LumenBridgeFunctions = {
  [K in (typeof REQUIRED_FUNCTIONS)[number]]: LumenBridgeMethod;
};

/** `window.lumen.<name>` - computed values rather than callables. */
type LumenBridgeValues = {
  [K in (typeof REQUIRED_VALUES)[number]]: any;
};

/** `window.lumen.<namespace>.<member>()` */
type LumenBridgeNamespaces = {
  [N in keyof typeof REQUIRED_NAMESPACES]: {
    [M in (typeof REQUIRED_NAMESPACES)[N][number]]: LumenBridgeMethod;
  };
};

/**
 * The trusted `window.lumen` of the main app window, derived from the same
 * inventory `fatal_errors.ts` checks at startup. Deriving rather than
 * hand-writing is the point: the two cannot drift, because there is only one
 * list.
 */
export type LumenBridge = LumenBridgeFunctions & LumenBridgeValues & LumenBridgeNamespaces;
