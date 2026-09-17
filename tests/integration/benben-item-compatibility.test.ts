import { describe, expect, it } from 'vitest';
import { claimBenbenAssistance } from '../../src/core/benben-claim';
import { createDetectionCandidateWithTemporaryResource } from '../../src/core/detection';
import { createLuckyCandidateWithTemporaryResource } from '../../src/core/lucky';
import { createMovementCandidateWithAutomaticLuckyResource } from '../../src/core/lucky';
import { createReviveCandidateWithTemporaryResource } from '../../src/core/revive';
import { createGameState } from '../../src/core/game-state';
import { createRunState } from '../../src/core/run';
import { detectionGame } from '../helpers/detection';
import { reviveGame } from '../helpers/revive';

describe('S4-08C pure Claim and Item compatibility composition', () => {
  it('claims deterministically and uses a matching temporary resource without permanent inventory', () => {
    const claim = claimBenbenAssistance({
      attemptLevelId: 'level-1', attemptRunId: 'run-1', claimLevelId: 'level-1',
      hasTakenStep: false, phase: { kind: 'active' },
      benbenByLevel: [{ levelId: 'level-1', status: 'available', failureStreak: 0 }],
      temporaryBenbenCard: null,
    });
    expect(claim.status).toBe('claimed');
    if (claim.status !== 'claimed') throw new Error('fixture');

    const itemGame = detectionGame(undefined, { inventory: 0 });
    expect(claim.temporaryBenbenCard.item).toBe('detection');
    const used = createDetectionCandidateWithTemporaryResource(
      itemGame, () => 1, claim.temporaryBenbenCard,
    );
    expect(used.status).toBe('candidate');
    if (used.status !== 'candidate') throw new Error('fixture');
    expect(used.temporaryBenbenCard).toEqual({ item: 'detection', consumed: true });
    expect(used.candidate.account.inventory.detection).toBe(0);
    expect(used.candidate.runItems.successfulDetectionUses).toBe(1);
    expect(claim.nextBenbenByLevel).toEqual([
      { levelId: 'level-1', status: 'used', failureStreak: 0 },
    ]);
  });

  it('preserves Lucky-before-Revive only for the canonical first-step encounter', () => {
    const first = reviveGame({ first: true, lucky: 0, inventory: 1 });
    const card = { item: 'lucky' as const, consumed: false };
    const lucky = createLuckyCandidateWithTemporaryResource(first, card);
    expect(lucky.status).toBe('candidate');
    expect(createReviveCandidateWithTemporaryResource(first, card))
      .toEqual({ status: 'rejected', reason: 'lucky-priority' });

    const later = reviveGame({ first: false, lucky: 1, inventory: 1 });
    expect(createLuckyCandidateWithTemporaryResource(later, card))
      .toEqual({ status: 'not-applicable', reason: 'not-first-step' });
    const revived = createReviveCandidateWithTemporaryResource(later, card);
    expect(revived.status).toBe('candidate');
    if (revived.status === 'candidate') {
      expect(revived.candidate.account.inventory).toMatchObject({ lucky: 1, revive: 0 });
      expect(revived.temporaryBenbenCard).toEqual(card);
    }
  });

  it('keeps temporary Lucky after a first Safe step and allows later permanent Revive', () => {
    const fixture = reviveGame({ first: true, lucky: 0, inventory: 1 });
    const active = createGameState({
      ...fixture,
      run: createRunState(fixture.run.board, { kind: 'waiting' }, {
        hasTakenStep: false,
        phase: { kind: 'active' },
      }),
    });
    const card = { item: 'lucky' as const, consumed: false };
    const safe = createMovementCandidateWithAutomaticLuckyResource(active, { x: 0, y: 0 }, card);
    expect(safe.status).toBe('candidate');
    if (safe.status !== 'candidate') throw new Error('fixture');
    expect(safe.resolution).toBe('moved');
    expect(safe.temporaryBenbenCard).toEqual(card);

    const mine = createMovementCandidateWithAutomaticLuckyResource(
      safe.candidate, { x: 1, y: 0 }, safe.temporaryBenbenCard,
    );
    expect(mine.status).toBe('candidate');
    if (mine.status !== 'candidate') throw new Error('fixture');
    expect(mine.resolution).toBe('pending');
    expect(mine.temporaryBenbenCard).toEqual(card);

    const revived = createReviveCandidateWithTemporaryResource(
      mine.candidate, mine.temporaryBenbenCard,
    );
    expect(revived.status).toBe('candidate');
    if (revived.status === 'candidate') {
      expect(revived.candidate.account.inventory).toMatchObject({ lucky: 0, revive: 0 });
      expect(revived.temporaryBenbenCard).toEqual(card);
    }
  });
});
