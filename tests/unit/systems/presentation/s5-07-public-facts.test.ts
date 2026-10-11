import { describe, expect, it } from 'vitest';
import { boardBrowserSave } from '../../../helpers/s5-06-browser-save';
import { MemoryStorage } from '../../../helpers/memory-storage';
import { loadProductionStage4Runtime } from '../../../../src/systems/persistence/production-stage4-runtime';
import { sanitizeStage4Runtime } from '../../../../src/systems/presentation/public-facts';
import { projectPublicFacts } from '../../../../src/ui/presentation-projection';
import { TUTORIAL_MILESTONE_IDS } from '../../../../src/core/settings-tutorial';
import { PRESENTATION_COPY } from '../../../../src/config/presentation-copy';
import { GAME_TUTORIAL_MILESTONES, gameTutorialContexts } from '../../../../src/ui/game-presentation';

function view(variant: Parameters<typeof boardBrowserSave>[0]) {
  const storage = new MemoryStorage();
  for (const [key, value] of boardBrowserSave(variant).entries) storage.data.set(key, value);
  const read = loadProductionStage4Runtime(storage);
  if (read.status !== 'loaded') throw new Error('fixture');
  return { facts: sanitizeStage4Runtime(read.runtime), publicView: projectPublicFacts(sanitizeStage4Runtime(read.runtime)) };
}

describe('S5-07 public allowlist and advisory controls', () => {
  it('provides a centralized semantic resource for each exact persisted tutorial ID', () => {
    expect(TUTORIAL_MILESTONE_IDS).toHaveLength(9);
    expect(GAME_TUTORIAL_MILESTONES).toEqual(TUTORIAL_MILESTONE_IDS);
    for (const id of TUTORIAL_MILESTONE_IDS) {
      expect(PRESENTATION_COPY[`game.tutorial.${id}`]).toBeTruthy();
    }
  });
  it('uses exact phase/position and resource facts without exposing hidden candidates or aliases', () => {
    const variants = ['number', 'pending', 'failed', 'won', 'occupancy', 'benben-available', 'detection-rich'] as const;
    for (const variant of variants) {
      const { facts, publicView } = view(variant);
      expect(publicView.attempt?.phase).toBe(facts.attempt?.phase);
      expect(publicView.attempt?.items).toEqual(facts.attempt?.items);
      expect(publicView.attempt?.items).not.toBe(facts.attempt?.items);
      expect(publicView.attempt?.benben).not.toBe(facts.attempt?.benben);
      expect(publicView.attempt?.claimedRewards).not.toBe(facts.attempt?.claimedRewards);
      expect(Object.isFrozen(publicView.attempt?.claimedRewards)).toBe(true);
      const serialized = JSON.stringify(publicView);
      for (const secret of ['generationProvenance', 'detectionRandomSeed', 'baseSeed', 'oneTimeClaimId',
        '"encounter":', 'mineCoordinates', 'rewardSeed', 'failureStreak']) expect(serialized).not.toContain(secret);
      expect(publicView.attempt?.board.cells.filter((cell) => cell === 'unknown').length)
        .toBeGreaterThan(0);
    }
    expect(view('number').publicView.attempt?.items.detection.offered).toBe(true);
    expect(view('pending').publicView.attempt?.items.detection.offered).toBe(false);
    expect(view('pending').publicView.attempt?.terminal.failure).toBe(true);
    expect(view('failed').publicView.attempt?.terminal.retry).toBe(true);
    expect(view('won').publicView.attempt?.terminal.next).toBe(false);
    expect(view('occupancy').publicView.attempt?.items.airplane.offered).toBe(true);
    expect(view('benben-available').publicView.attempt?.benben).toMatchObject({
      entitlement: 'available', claimOffered: true, temporaryCard: null,
    });
  });
  it('limits prompts and Help to public context, with L4 requiring this operation receipt', () => {
    const l1Pending = view('pending').publicView;
    const l1 = gameTutorialContexts(l1Pending, null);
    expect(l1.prompt).not.toContain('l5-failure-retry-first-step-safety');
    expect(l1.help).not.toContain('l5-failure-retry-first-step-safety');
    expect(l1.help).not.toContain('l4-one-time-coin-reward');
    expect(l1.help).not.toContain('first-shop');
    const base = view('waiting').publicView;
    if (base.attempt === null) throw new Error('fixture');
    const oneTime = { ...base, attempt: { ...base.attempt, levelId: 'level-004',
      claimedRewards: [{ coordinate: { x: 0, y: 0 }, payload: { kind: 'coins' as const, amount: 1 }, oneTime: true }] } };
    expect(gameTutorialContexts(oneTime, null).prompt).not.toContain('l4-one-time-coin-reward');
    expect(gameTutorialContexts(oneTime, null).help).toContain('l4-one-time-coin-reward');
    expect(gameTutorialContexts(oneTime, 'l4-one-time-coin-reward').prompt).toContain('l4-one-time-coin-reward');
    const l5 = { ...base, attempt: { ...base.attempt, levelId: 'level-005', phase: 'failed' as const } };
    expect(gameTutorialContexts(l5, null).prompt).toContain('l5-failure-retry-first-step-safety');
  });
});
