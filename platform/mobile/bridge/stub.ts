/**
 * Builds `window.lumen` for the mobile target from the contract itself.
 *
 * `src/internal/common/lumenBridgeSurface.ts` already describes the bridge as
 * data, because `fatal_errors.ts` validates against it and
 * `src/types/lumenBridge.ts` derives its type from it. Walking the same lists
 * here makes this a third consumer rather than a second source of truth: the
 * mobile bridge is complete by construction, and a member added for the
 * desktop cannot quietly go missing on Android.
 *
 * What a not-yet-implemented member does when called is deliberate:
 *
 *  - subscriptions return a no-op unsubscribe (see `isSubscription`), because
 *    callers keep that return value and call it on teardown;
 *  - everything else returns a *rejected promise*, never a synchronous throw.
 *    Screens already handle a failing bridge call - that is what a dropped RPC
 *    looks like - so they degrade instead of taking the app down. A throw at
 *    the call site would crash whatever component happened to render first.
 */

import {
  REQUIRED_FUNCTIONS,
  REQUIRED_NAMESPACES,
  REQUIRED_VALUES
} from '../../../src/internal/common/lumenBridgeSurface';
import type {
  BridgeMember,
  BridgeReport,
  MemberState,
  MobileSupport
} from '../../../src/types/platformBridge';
import { MOBILE_IMPL, MOBILE_VALUES } from '../impl';
import { isSubscription, mobileSupportOf } from './support';

const state = new Map<string, MemberState>();

/** One line per member, however many times the UI pokes at it. */
const warned = new Set<string>();

function warnOnce(member: string): void {
  if (warned.has(member)) return;
  warned.add(member);
  console.warn(`[platform/mobile] window.lumen.${member} has no Android equivalent - returning a failed result.`);
}

/** Error thrown (as a rejection) by a member with no mobile implementation. */
export class BridgeNotImplementedError extends Error {
  readonly member: string;
  readonly support: MobileSupport;

  constructor(member: string, support: MobileSupport) {
    super(
      support === 'unsupported'
        ? `window.lumen.${member} has no Android equivalent and is not planned. ` +
          'The UI that calls it should be hidden on this target.'
        : `window.lumen.${member} is not implemented on mobile yet. ` +
          'Add it to platform/mobile/impl/index.ts.'
    );
    this.name = 'BridgeNotImplementedError';
    this.member = member;
    this.support = support;
  }
}

/**
 * Resolves one contract member to a callable: the real implementation if
 * `impl/` has one, otherwise a stub shaped by its classification.
 */
function resolveMember(flatName: string, memberName: string): BridgeMember {
  const real = MOBILE_IMPL[flatName];
  if (real) {
    state.set(flatName, 'implemented');
    return real;
  }

  const support = mobileSupportOf(flatName);
  state.set(flatName, support === 'unsupported' ? 'unsupported' : 'stubbed');

  if (isSubscription(memberName)) {
    // Returns the unsubscribe the caller expects. The callback never fires,
    // which is the honest behaviour for an event source that does not exist.
    return () => () => {};
  }

  if (support === 'unsupported') {
    // Resolves rather than rejects, and the difference is not cosmetic. The UI
    // calls several of these at startup without awaiting them - setWindowMode
    // and find.setActiveTarget both fire on the first render - so a rejection
    // becomes an unhandled rejection, which the renderer's error reporting
    // dutifully forwards as a crash on every single launch. There is nothing to
    // fix at the call site either: the answer really is "not here". So the
    // caller gets a failed result it can read, warned once so it is still
    // visible, instead of an exception nobody is positioned to catch.
    return () => {
      warnOnce(flatName);
      return Promise.resolve({ ok: false, error: 'unsupported_on_mobile', member: flatName });
    };
  }

  // A planned member still rejects: that one IS a to-do, and it should be loud
  // while the screen that needs it is being built.
  return () => Promise.reject(new BridgeNotImplementedError(flatName, support));
}

/**
 * The bridge object. Typed as the contract's own `LumenBridge` at the call
 * site in `install.ts`; built loosely here because it is assembled by name.
 */
export function buildMobileBridge(): Record<string, unknown> {
  state.clear();
  const bridge: Record<string, unknown> = {};

  for (const name of REQUIRED_VALUES) {
    // `fatal_errors.ts` checks `name in lumen`, so an undefined value still
    // has to be an own property - assigning it is what makes that true.
    bridge[name] = MOBILE_VALUES[name];
    state.set(name, name in MOBILE_VALUES ? 'implemented' : 'stubbed');
  }

  for (const name of REQUIRED_FUNCTIONS) {
    bridge[name] = resolveMember(name, name);
  }

  for (const [namespace, members] of Object.entries(REQUIRED_NAMESPACES)) {
    const group: Record<string, BridgeMember> = {};
    for (const member of members as readonly string[]) {
      group[member] = resolveMember(`${namespace}.${member}`, member);
    }
    bridge[namespace] = group;
  }

  return bridge;
}

/** Inventory of the last-built bridge, for the console helper and for tests. */
export function bridgeReport(): BridgeReport {
  const report: BridgeReport = {
    implemented: [],
    stubbed: [],
    unsupported: [],
    total: state.size
  };
  for (const [name, how] of state) report[how].push(name);
  return report;
}
