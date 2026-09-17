import { describe, expect, it } from 'vitest';
import { createAirplaneCandidateWithTemporaryResource } from '../../../src/core/airplane';
import { createDetectionCandidateWithTemporaryResource } from '../../../src/core/detection';
import {
  createMovementCandidateWithAutomaticLuckyResource,
  createLuckyCandidateWithTemporaryResource,
  hasApplicableLuckyForEncounter,
} from '../../../src/core/lucky';
import { createRunState } from '../../../src/core/run';
import { createReviveCandidateWithTemporaryResource } from '../../../src/core/revive';
import { createGameState } from '../../../src/core/game-state';
import { createRunItemState } from '../../../src/core/run-item-state';
import { airplaneGame } from '../../helpers/airplane';
import { detectionGame } from '../../helpers/detection';
import { reviveGame } from '../../helpers/revive';

describe('Detection temporary resource compatibility', () => {
  it('uses a temporary Detection with zero inventory and keeps permanent inventory unchanged', () => {
    const game = detectionGame(undefined, { inventory: 0 });
    const result = createDetectionCandidateWithTemporaryResource(
      game, () => 1, { item: 'detection', consumed: false },
    );
    expect(result.status).toBe('candidate');
    if (result.status !== 'candidate') throw new Error('fixture');
    expect(result.temporaryBenbenCard).toEqual({ item: 'detection', consumed: true });
    expect(result.candidate.account.inventory.detection).toBe(0);
    expect(result.candidate.runItems.successfulDetectionUses).toBe(1);
  });

  it('does not consume or initialize a seed when there is no target', () => {
    const game = detectionGame(['SSS', 'SES', 'SSS'], { inventory: 0, seed: null });
    let calls = 0;
    const card = { item: 'detection' as const, consumed: false };
    expect(createDetectionCandidateWithTemporaryResource(game, () => { calls += 1; return 1; }, card))
      .toEqual({ status: 'rejected', reason: 'no-hidden-mine' });
    expect(calls).toBe(0);
    expect(card.consumed).toBe(false);
    expect(game.runItems).toMatchObject({ successfulDetectionUses: 0, detectionRandomSeed: null });
  });

  it('preserves the shared cap even with an unconsumed temporary card', () => {
    const game = detectionGame(undefined, { inventory: 0, uses: 2 });
    expect(createDetectionCandidateWithTemporaryResource(game, () => 1, { item: 'detection', consumed: false }))
      .toEqual({ status: 'rejected', reason: 'usage-limit-reached' });
  });

  it('falls back to permanent inventory for a consumed or mismatched card', () => {
    for (const card of [
      { item: 'detection' as const, consumed: true },
      { item: 'revive' as const, consumed: false },
    ]) {
      const result = createDetectionCandidateWithTemporaryResource(detectionGame(), () => 1, card);
      expect(result.status).toBe('candidate');
      if (result.status === 'candidate') {
        expect(result.candidate.account.inventory.detection).toBe(2);
        expect(result.temporaryBenbenCard).toEqual(card);
      }
    }
  });
});

describe('Airplane temporary resource compatibility', () => {
  it('consumes a temporary Airplane on a legal no-effect use', () => {
    const game = airplaneGame(['O'], { inventory: 0 });
    const result = createAirplaneCandidateWithTemporaryResource(
      game, { x: 0, y: 0 }, { item: 'airplane', consumed: false },
    );
    expect(result.status).toBe('candidate');
    if (result.status !== 'candidate') throw new Error('fixture');
    expect(result.temporaryBenbenCard).toEqual({ item: 'airplane', consumed: true });
    expect(result.candidate.account.inventory.airplane).toBe(0);
    expect(result.candidate.runItems.successfulAirplaneUses).toBe(1);
  });

  it.each([
    ['cap', airplaneGame(undefined, { inventory: 0, uses: 1 }), { x: 0, y: 0 }, 'usage-limit-reached'],
    ['target', airplaneGame(undefined, { inventory: 0 }), { x: -1, y: 0 }, 'out-of-bounds'],
  ] as const)('does not consume temporary resource for illegal %s', (_name, game, target, reason) => {
    const card = { item: 'airplane' as const, consumed: false };
    expect(createAirplaneCandidateWithTemporaryResource(game, target, card))
      .toEqual({ status: 'rejected', reason });
    expect(card.consumed).toBe(false);
  });
});

describe('Lucky and Revive applicability compatibility', () => {
  it('uses occurredOnFirstStep even though pending hasTakenStep is true', () => {
    const game = reviveGame({ first: true, lucky: 0, inventory: 1 });
    expect(game.run.hasTakenStep).toBe(true);
    expect(hasApplicableLuckyForEncounter(game, { item: 'lucky', consumed: false })).toBe(true);
    const result = createLuckyCandidateWithTemporaryResource(game, { item: 'lucky', consumed: false });
    expect(result.status).toBe('candidate');
    if (result.status !== 'candidate') throw new Error('fixture');
    expect(result.temporaryBenbenCard).toEqual({ item: 'lucky', consumed: true });
    expect(result.candidate.account.inventory.lucky).toBe(0);
  });

  it('keeps first-step temporary Lucky ahead of permanent Revive', () => {
    const game = reviveGame({ first: true, lucky: 0, inventory: 2 });
    expect(createReviveCandidateWithTemporaryResource(game, { item: 'lucky', consumed: false }))
      .toEqual({ status: 'rejected', reason: 'lucky-priority' });
  });

  it('resolves applicable first-step Lucky before exposing a pending candidate', () => {
    const pendingFixture = reviveGame({ first: true, lucky: 0, inventory: 1 });
    const active = createGameState({
      ...pendingFixture,
      run: createRunState(pendingFixture.run.board, { kind: 'waiting' }, {
        hasTakenStep: false,
        phase: { kind: 'active' },
      }),
    });
    const result = createMovementCandidateWithAutomaticLuckyResource(
      active, { x: 1, y: 0 }, { item: 'lucky', consumed: false },
    );
    expect(result.status).toBe('candidate');
    if (result.status !== 'candidate') throw new Error('fixture');
    expect(result.resolution).toBe('lucky');
    expect(result.candidate.run.phase).toEqual({ kind: 'active' });
    expect(result.temporaryBenbenCard).toEqual({ item: 'lucky', consumed: true });
  });

  it('returns pending when first-step Lucky is unavailable', () => {
    const pendingFixture = reviveGame({ first: true, lucky: 0, inventory: 1 });
    const active = createGameState({
      ...pendingFixture,
      run: createRunState(pendingFixture.run.board, { kind: 'waiting' }, {
        hasTakenStep: false,
        phase: { kind: 'active' },
      }),
    });
    const result = createMovementCandidateWithAutomaticLuckyResource(active, { x: 1, y: 0 }, null);
    expect(result.status).toBe('candidate');
    if (result.status === 'candidate') {
      expect(result.resolution).toBe('pending');
      expect(result.candidate.run.phase.kind).toBe('pending-mine-encounter');
    }
  });

  it('keeps first-step permanent Lucky ahead of temporary Revive', () => {
    const game = reviveGame({ first: true, lucky: 1, inventory: 0 });
    expect(createReviveCandidateWithTemporaryResource(game, { item: 'revive', consumed: false }))
      .toEqual({ status: 'rejected', reason: 'lucky-priority' });
  });

  it('does not let later-step temporary Lucky trigger or block permanent Revive', () => {
    const game = reviveGame({ first: false, lucky: 0, inventory: 1 });
    expect(hasApplicableLuckyForEncounter(game, { item: 'lucky', consumed: false })).toBe(false);
    expect(createLuckyCandidateWithTemporaryResource(game, { item: 'lucky', consumed: false }))
      .toEqual({ status: 'not-applicable', reason: 'not-first-step' });
    const revived = createReviveCandidateWithTemporaryResource(game, { item: 'lucky', consumed: false });
    expect(revived.status).toBe('candidate');
    if (revived.status !== 'candidate') throw new Error('fixture');
    expect(revived.temporaryBenbenCard).toEqual({ item: 'lucky', consumed: false });
    expect(revived.candidate.account.inventory).toMatchObject({ lucky: 0, revive: 0 });
  });

  it('does not let later-step permanent Lucky trigger or block Revive', () => {
    const game = reviveGame({ first: false, lucky: 2, inventory: 1 });
    const revived = createReviveCandidateWithTemporaryResource(game, null);
    expect(revived.status).toBe('candidate');
    if (revived.status !== 'candidate') throw new Error('fixture');
    expect(revived.candidate.account.inventory).toMatchObject({ lucky: 2, revive: 0 });
  });

  it('uses a temporary Revive with no permanent inventory and keeps usage shared', () => {
    const game = reviveGame({ first: false, lucky: 0, inventory: 0 });
    const result = createReviveCandidateWithTemporaryResource(game, { item: 'revive', consumed: false });
    expect(result.status).toBe('candidate');
    if (result.status !== 'candidate') throw new Error('fixture');
    expect(result.temporaryBenbenCard).toEqual({ item: 'revive', consumed: true });
    expect(result.candidate.runItems.successfulReviveUses).toBe(1);
    const hitAgain = createGameState({
      ...result.candidate,
      run: reviveGame({ uses: 1 }).run,
      runItems: createRunItemState({ ...result.candidate.runItems, successfulReviveUses: 1 }),
    });
    expect(createReviveCandidateWithTemporaryResource(hitAgain, { item: 'revive', consumed: false }))
      .toEqual({ status: 'rejected', reason: 'usage-limit-reached' });
  });
});
