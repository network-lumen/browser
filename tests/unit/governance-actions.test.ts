import { describe, expect, it } from 'vitest';
import { reactive, ref, isReactive } from 'vue';
import { toGovernanceActionPayloads } from '../../src/internal/services/governanceActions';
import type { GovernanceActionDraft } from '../../src/types/networkGovernance';

/**
 * What the proposal form hands to the IPC bridge.
 *
 * Electron puts every IPC argument through structured clone, which refuses a
 * Proxy. The drafts come out of a `ref`, so they are Proxies, and submitting a
 * proposal with any action at all failed with "An object could not be cloned" -
 * a message that names neither the argument nor the field. A text-only proposal
 * worked, which made it look like the action builders were at fault.
 *
 * structuredClone is the real oracle here, so the tests call it.
 */

function draftsFromForm(): GovernanceActionDraft[] {
  // Exactly how NetworkPage holds them.
  const drafts = ref<GovernanceActionDraft[]>([]);
  drafts.value.push({
    id: 'a1',
    templateId: 'dns-update-fee',
    values: { updateFeeUlmn: '0.01' },
  });
  drafts.value.push({
    id: 'a2',
    templateId: 'dns-update-guards',
    values: { updateRateLimitSeconds: '30', updatePowDifficulty: '0' },
  });
  return drafts.value;
}

describe('drafts taken straight from the form', () => {
  it('are reactive, which is the whole problem', () => {
    expect(isReactive(draftsFromForm()[0])).toBe(true);
  });

  it('cannot be sent over IPC as they are', () => {
    expect(() => structuredClone(draftsFromForm()[0])).toThrow();
  });
});

describe('once flattened', () => {
  it('survives structured clone', () => {
    const payloads = toGovernanceActionPayloads(draftsFromForm());
    expect(() => structuredClone(payloads)).not.toThrow();
  });

  it('keeps every action, in order, with its values', () => {
    expect(toGovernanceActionPayloads(draftsFromForm())).toEqual([
      { templateId: 'dns-update-fee', values: { updateFeeUlmn: '0.01' } },
      { templateId: 'dns-update-guards', values: { updateRateLimitSeconds: '30', updatePowDifficulty: '0' } },
    ]);
  });

  it('drops the local draft id, which the chain has no use for', () => {
    expect(Object.keys(toGovernanceActionPayloads(draftsFromForm())[0]).sort()).toEqual([
      'templateId',
      'values',
    ]);
  });

  it('leaves nothing reactive behind', () => {
    const payloads = toGovernanceActionPayloads(draftsFromForm());
    expect(isReactive(payloads[0])).toBe(false);
    expect(isReactive(payloads[0].values)).toBe(false);
  });

  it('copies the values rather than aliasing them, so later edits do not leak', () => {
    const drafts = draftsFromForm();
    const payloads = toGovernanceActionPayloads(drafts);
    drafts[0].values.updateFeeUlmn = '99';
    expect(payloads[0].values.updateFeeUlmn).toBe('0.01');
  });
});

describe('edges', () => {
  it('handles a proposal with no actions', () => {
    expect(toGovernanceActionPayloads([])).toEqual([]);
  });

  it('survives a draft nested one level deeper in reactivity', () => {
    const state = reactive({ drafts: [{ id: 'x', templateId: 'gateways-update-params', values: { a: '1' } }] });
    const payloads = toGovernanceActionPayloads(state.drafts);
    expect(() => structuredClone(payloads)).not.toThrow();
    expect(payloads[0].values).toEqual({ a: '1' });
  });
});
