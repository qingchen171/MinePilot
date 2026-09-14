import { describe, expect, it } from 'vitest';
import { createAccountState, createItemInventoryState } from '../../src/core/account';
import { createAirplaneCandidate } from '../../src/core/airplane';
import { createCoordinate } from '../../src/core/board';
import { settleMineEncounterAsFailure } from '../../src/core/encounter';
import { createGameState } from '../../src/core/game-state';
import { createInitialBoard } from '../../src/core/initial-board';
import { createLuckyCandidate } from '../../src/core/lucky';
import { moveCharacter } from '../../src/core/movement';
import type { ActiveRunPersistenceInputV2 } from '../../src/core/persistence/save-v2';
import { createReviveCandidate } from '../../src/core/revive';
import { applyRewardClaimsForExploration } from '../../src/core/reward-claim';
import { createRewardState } from '../../src/core/reward';
import { createInitialRunItemState } from '../../src/core/run-item-state';
import { createRunState, createWaitingPosition, createWaitingRunState } from '../../src/core/run';
import { settleTerminalOutcome } from '../../src/core/terminal-settlement';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import { retryFailedAttempt, type LevelGenerationConfiguration } from '../../src/systems/persistence/new-attempt';
import { acquireWriterLease, type Clock, type WriterIdentity } from '../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../helpers/memory-storage';

class FixedClock implements Clock {
  nowMs(): number { return 0; }
}

const writer: WriterIdentity = { sessionId: 'terminal-writer', leaseToken: 'terminal-token' };
const inventory = (changes: Partial<ReturnType<typeof createItemInventoryState>> = {}) =>
  createItemInventoryState({ lucky: 0, detection: 0, airplane: 0, revive: 0, ...changes });

function board(width: number, mines: readonly { x: number; y: number }[] = []) {
  const created = createInitialBoard({
    dimensions: { width, height: 1 }, obstacleCoordinates: [], mineCoordinates: mines,
  });
  if (created.status !== 'created') throw new Error('Expected test Board creation.');
  return created.board;
}

function terminal(runPhase: Parameters<typeof settleTerminalOutcome>[0]['nextPhase'], changes = {}) {
  return settleTerminalOutcome({
    levelId: 'level-1', nextPhase: runPhase, previousDisposition: 'not-applicable',
    completedLevelIds: [], benbenByLevel: [],
    ...(runPhase.kind === 'failed' ? { failureThreshold: 2 } : {}),
    ...changes,
  });
}

describe('Reward-before-terminal composition', () => {
  it('settles movement victory only after the final Safe Reward is claimed', () => {
    const oldRun = createWaitingRunState(board(1));
    const movement = moveCharacter(oldRun, createCoordinate(0, 0));
    if (movement.outcome !== 'moved') throw new Error('Expected final Safe movement.');
    expect(movement.state.phase.kind).toBe('won');

    const reward = applyRewardClaimsForExploration({
      oldBoard: oldRun.board,
      nextBoard: movement.state.board,
      rewards: [createRewardState({
        coordinate: createCoordinate(0, 0), payload: { kind: 'coins', amount: 5 },
        claimed: false, oneTimeClaimId: 'completion-reward',
      })],
      assets: { inventory: inventory(), coins: 1, oneTimeClaimIds: [] },
    });
    expect(reward).toMatchObject({
      status: 'claimed', nextCoins: 6, nextOneTimeClaimIds: ['completion-reward'],
      nextRewards: [{ claimed: true }],
    });
    const settlement = terminal(movement.state.phase);
    expect(settlement).toMatchObject({
      status: 'settled', terminalDisposition: 'settled', nextCompletedLevelIds: ['level-1'],
    });
  });

  it('settles a real movement win with no Reward', () => {
    const oldRun = createWaitingRunState(board(1));
    const movement = moveCharacter(oldRun, createCoordinate(0, 0));
    if (movement.outcome !== 'moved') throw new Error('Expected movement.');
    expect(applyRewardClaimsForExploration({
      oldBoard: oldRun.board, nextBoard: movement.state.board, rewards: [],
      assets: { inventory: inventory(), coins: 0, oneTimeClaimIds: [] },
    })).toEqual({ status: 'nothing-to-claim' });
    expect(terminal(movement.state.phase)).toMatchObject({ status: 'settled' });
  });

  it('composes a real Airplane win, its Item consumption, Rewards, then terminal settlement', () => {
    const oldGame = createGameState({
      account: createAccountState(inventory({ airplane: 1 })),
      run: createWaitingRunState(board(2)),
      runItems: createInitialRunItemState(null),
    });
    const airplane = createAirplaneCandidate(oldGame, createCoordinate(0, 0));
    if (airplane.status !== 'candidate') throw new Error('Expected Airplane candidate.');
    expect(airplane.candidate.run.phase.kind).toBe('won');
    expect(airplane.candidate.account.inventory.airplane).toBe(0);
    const reward = applyRewardClaimsForExploration({
      oldBoard: oldGame.run.board,
      nextBoard: airplane.candidate.run.board,
      rewards: [createRewardState({
        coordinate: createCoordinate(1, 0), payload: { kind: 'item', item: 'airplane', quantity: 2 },
        claimed: false, oneTimeClaimId: null,
      })],
      assets: { inventory: airplane.candidate.account.inventory, coins: 0, oneTimeClaimIds: [] },
    });
    expect(reward).toMatchObject({ status: 'claimed', nextInventory: { airplane: 2 } });
    expect(terminal(airplane.candidate.run.phase, {
      benbenByLevel: [{ levelId: 'level-1', status: 'available', failureStreak: 0 }],
    })).toMatchObject({
      status: 'settled',
      nextBenbenByLevel: [{ levelId: 'level-1', status: 'available', failureStreak: 0 }],
    });
  });

  it('settles a real Airplane win with no Reward', () => {
    const game = createGameState({
      account: createAccountState(inventory({ airplane: 1 })),
      run: createWaitingRunState(board(1)),
      runItems: createInitialRunItemState(null),
    });
    const airplane = createAirplaneCandidate(game, createCoordinate(0, 0));
    if (airplane.status !== 'candidate') throw new Error('Expected Airplane candidate.');
    expect(terminal(airplane.candidate.run.phase)).toMatchObject({ status: 'settled' });
  });
});

describe('Failure, survival, Retry, and legacy composition', () => {
  function pendingAfterStep() {
    const waiting = createWaitingRunState(board(3, [createCoordinate(2, 0)]));
    const safe = moveCharacter(waiting, createCoordinate(0, 0));
    if (safe.outcome !== 'moved') throw new Error('Expected Safe step.');
    const hit = moveCharacter(safe.state, createCoordinate(2, 0));
    if (hit.outcome !== 'requires-resolution') throw new Error('Expected pending encounter.');
    return hit.state;
  }

  it('settles a real Failure and applies consecutive history only on later real Failures', () => {
    const failure = settleMineEncounterAsFailure(pendingAfterStep());
    if (failure.outcome !== 'failed') throw new Error('Expected Failure.');
    const first = terminal(failure.state.phase);
    expect(first).toMatchObject({
      status: 'settled', nextBenbenByLevel: [{ levelId: 'level-1', status: 'unavailable', failureStreak: 1 }],
    });
    if (first.status !== 'settled') return;
    expect(terminal(failure.state.phase, {
      benbenByLevel: first.nextBenbenByLevel,
    })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [{ levelId: 'level-1', status: 'available', failureStreak: 0 }],
    });
  });

  it('rejects settlement after real Lucky and Revive survival', () => {
    const firstHit = moveCharacter(
      createWaitingRunState(board(2, [createCoordinate(0, 0)])),
      createCoordinate(0, 0),
    );
    if (firstHit.outcome !== 'requires-resolution') throw new Error('Expected first-step encounter.');
    const lucky = createLuckyCandidate(createGameState({
      account: createAccountState(inventory({ lucky: 1, revive: 1 })),
      run: firstHit.state,
      runItems: createInitialRunItemState(null),
    }));
    if (lucky.status !== 'candidate') throw new Error('Expected Lucky survival.');
    expect(lucky.candidate.run.phase.kind).toBe('active');
    expect(terminal(lucky.candidate.run.phase)).toEqual({
      status: 'rejected', reason: 'invalid-terminal-transition',
    });

    const revive = createReviveCandidate(createGameState({
      account: createAccountState(inventory({ revive: 1 })),
      run: pendingAfterStep(),
      runItems: createInitialRunItemState(null),
    }));
    if (revive.status !== 'candidate') throw new Error('Expected Revive survival.');
    expect(revive.candidate.run.phase.kind).toBe('active');
    expect(terminal(revive.candidate.run.phase)).toEqual({
      status: 'rejected', reason: 'invalid-terminal-transition',
    });
  });

  function persistedFailedAttempt(): {
    storage: MemoryStorage;
    clock: FixedClock;
    attempt: ActiveRunPersistenceInputV2;
  } {
    const failedBoard = board(3, [createCoordinate(2, 0)]);
    const failedRun = createRunState(failedBoard, createWaitingPosition(), {
      hasTakenStep: true,
      phase: {
        kind: 'failed',
        encounter: { target: createCoordinate(2, 0), occurredOnFirstStep: true },
      },
    });
    const attempt: ActiveRunPersistenceInputV2 = {
      runId: 'old-run', levelId: 'level-1',
      gameState: createGameState({
        account: createAccountState(inventory()),
        run: failedRun,
        runItems: createInitialRunItemState(10),
      }),
      generationProvenance: {
        seed: 10, rngVersion: 'mulberry32-v1', generationVersion: 'initial-board-v1',
      },
    };
    const storage = new MemoryStorage();
    const clock = new FixedClock();
    expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
    expect(commitCandidateWithWriterLease(storage, writer, clock, null, {
      revision: 0, activeRun: attempt,
    }).status).toBe('committed');
    return { storage, clock, attempt };
  }

  function retry(fixture: ReturnType<typeof persistedFailedAttempt>) {
    const configuration: LevelGenerationConfiguration = {
      dimensions: { width: 3, height: 1 }, obstacleCoordinates: [], mineCount: 1,
    };
    return retryFailedAttempt(fixture.storage, writer, fixture.clock, {
      currentAttempt: fixture.attempt,
      currentRevision: 0,
      generationConfiguration: configuration,
      runIdSource: { nextRunId: () => 'new-run' },
    });
  }

  it('does not apply terminal settlement again during Retry', () => {
    const fixture = persistedFailedAttempt();
    const first = terminal(fixture.attempt.gameState.run.phase, {
      benbenByLevel: [{ levelId: 'level-1', status: 'unavailable', failureStreak: 1 }],
    });
    if (first.status !== 'settled') throw new Error('Expected settlement.');
    expect(first.nextBenbenByLevel[0]?.failureStreak).toBe(0);
    expect(retry(fixture).status).toBe('committed');
    expect(settleTerminalOutcome({
      levelId: 'level-1', nextPhase: fixture.attempt.gameState.run.phase,
      previousDisposition: first.terminalDisposition,
      completedLevelIds: first.nextCompletedLevelIds,
      benbenByLevel: first.nextBenbenByLevel,
      failureThreshold: 2,
    })).toEqual({ status: 'not-applicable', reason: 'already-settled' });
    expect(first.nextBenbenByLevel).toEqual([{ levelId: 'level-1', status: 'available', failureStreak: 0 }]);
  });

  it('allows legacy failed Retry without retroactive settlement', () => {
    const fixture = persistedFailedAttempt();
    const history = [{ levelId: 'level-1', status: 'unavailable', failureStreak: 1 }] as const;
    expect(settleTerminalOutcome({
      levelId: 'level-1', nextPhase: fixture.attempt.gameState.run.phase,
      previousDisposition: 'legacy-excluded', completedLevelIds: [], benbenByLevel: history,
      failureThreshold: 2,
    })).toEqual({ status: 'not-applicable', reason: 'legacy-excluded' });
    expect(retry(fixture).status).toBe('committed');
    expect(history[0].failureStreak).toBe(1);
  });
});
