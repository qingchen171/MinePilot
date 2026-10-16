import { describe, expect, it } from 'vitest';
import { createInitialStage4GameState } from '../../../src/core/stage4-game-state';
import { sanitizeStage4Runtime } from '../../../src/systems/presentation/public-facts';
import { createEffectEpoch } from '../../../src/ui/effect-epoch';
import { projectEffectCue } from '../../../src/ui/effect-cues';

const publicFacts = sanitizeStage4Runtime(createInitialStage4GameState());

describe('S5-08 disposable effect projection', () => {
  it('never invents a Reward, Lucky or Benben special cue from ordinary public facts', () => {
    const base = { operationId: 'op-1', target: null, before: publicFacts, after: publicFacts,
      rewardReceipt: { status: 'insufficient-proof' as const }, firstLucky: false };
    expect(projectEffectCue({ ...base, kind: 'move' })).toMatchObject({ kind: 'saved', rewardCount: 0 });
    expect(projectEffectCue({ ...base, kind: 'claim-benben' })).toMatchObject({ kind: 'saved' });
    expect(projectEffectCue({ ...base, kind: 'airplane' })).toMatchObject({ kind: 'saved' });
  });
  it('invalidates old asynchronous decoration tokens without blocking subsequent commits', () => {
    const epochs = createEffectEpoch();
    const first = epochs.current();
    expect(epochs.valid(first)).toBe(true);
    const second = epochs.invalidate();
    expect(epochs.valid(first)).toBe(false);
    expect(epochs.valid(second)).toBe(true);
    epochs.dispose();
    expect(epochs.valid(second)).toBe(false);
  });
});
