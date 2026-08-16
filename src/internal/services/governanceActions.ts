import { toRaw } from 'vue';
import type { GovernanceActionDraft, GovernanceActionPayload } from '../../types/networkGovernance';

/**
 * Action drafts, flattened into something the IPC bridge can carry.
 *
 * The drafts live in a `ref`, so every one of them - and the `values` object
 * inside it - is a Vue reactive Proxy. Electron sends IPC arguments through the
 * structured clone algorithm, and structured clone refuses a Proxy outright:
 * the whole submission came back as "An object could not be cloned", with
 * nothing to say which argument was at fault. A text-only proposal went through
 * fine, because strings are strings; adding one action broke it.
 *
 * `toRaw` alone is not enough as a habit - it unwraps one level - so the values
 * are copied out into a plain object. They are all strings by construction
 * (GovernanceActionDraft), so a shallow copy reaches the bottom.
 */
export function toGovernanceActionPayloads(
  drafts: readonly GovernanceActionDraft[]
): GovernanceActionPayload[] {
  return drafts.map((draft) => ({
    templateId: String(toRaw(draft).templateId || ''),
    values: { ...toRaw(draft.values) },
  }));
}
