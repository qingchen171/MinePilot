import { describe, expect, it } from 'vitest';
import { createInitialBoard } from '../../src/core/initial-board';
import { createGameState } from '../../src/core/game-state';
import { createAccountState } from '../../src/core/account';
import { createInitialRunItemState } from '../../src/core/run-item-state';
import { createWaitingRunState } from '../../src/core/run';
import { settleMineEncounterAsFailure } from '../../src/core/encounter';
import type { ActiveRunPersistenceInputV2 } from '../../src/core/persistence/save-v2';
import { moveCharacterWithAutomaticLucky, resolveAutomaticLucky } from '../../src/systems/persistence/lucky';
import { useRevive } from '../../src/systems/persistence/revive';
import { useDetection } from '../../src/systems/persistence/detection';
import { useAirplane } from '../../src/systems/persistence/airplane';
import { restartCurrentAttempt, retryFailedAttempt } from '../../src/systems/persistence/new-attempt';
import { commitCandidateWithWriterLease, type GuardedCommitResult } from '../../src/systems/persistence/guarded-persistence';
import { loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { acquireWriterLease } from '../../src/systems/persistence/writer-lease';
import { SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from '../helpers/memory-storage';

const writer = { sessionId: 'stage3', leaseToken: 'stage3-token' };
const clock = { nowMs: () => 0 };
type Authority = { currentAttempt: ActiveRunPersistenceInputV2; currentRevision: number };
function setup(small = false) {
  const built = createInitialBoard({ dimensions: { width: small ? 3 : 5, height: 3 },
    obstacleCoordinates: [], mineCoordinates: small ? [{ x: 0, y: 0 }] :
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }] });
  if (built.status !== 'created') throw new Error('Expected board');
  const currentAttempt = { runId: 'original', levelId: 'level',
    generationProvenance: { seed: 999, rngVersion: 'mulberry32-v1', generationVersion: 'initial-board-v1' },
    gameState: createGameState({ run: createWaitingRunState(built.board),
      account: createAccountState({ lucky: 2, revive: 2, detection: 3, airplane: 2 }),
      runItems: createInitialRunItemState(123) }) };
  const storage = new MemoryStorage();
  expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
  expect(commitCandidateWithWriterLease(storage, writer, clock, null, { revision: 0, activeRun: currentAttempt }).status).toBe('committed');
  return { storage, authority: { currentAttempt, currentRevision: 0 } as Authority };
}

// Read back every successful command through the real JSON/Save v2 reconstruction chain.
function reopen(storage: MemoryStorage, expected: Authority): Authority {
  const start = storage.operations.length;
  const loaded = loadPersistedSave(storage);
  if (!('save' in loaded) || !loaded.save.activeRun) throw new Error('Expected restored authority');
  expect(loaded.revision).toBe(expected.currentRevision);
  expect(loaded.save.activeRun).toEqual(expected.currentAttempt);
  expect(loaded.save.activeRun.gameState).not.toBe(expected.currentAttempt.gameState);
  expect(storage.operations.slice(start).every(op => op.startsWith('read:'))).toBe(true);
  return { currentAttempt: loaded.save.activeRun, currentRevision: loaded.revision };
}
function committed(storage: MemoryStorage, old: Authority, result: { status: string }): Authority {
  expect(result.status).toBe('committed');
  // Runtime narrowing without replacing the real result with a mock.
  if (!('candidate' in result) || !('revision' in result)) throw new Error('Expected commit result');
  const success = result as Extract<GuardedCommitResult, { status: 'committed' }>;
  if (!success.candidate.activeRun) throw new Error('Expected activeRun');
  expect(success.revision).toBe(old.currentRevision + 1);
  return reopen(storage, { currentAttempt: success.candidate.activeRun, currentRevision: success.revision });
}
function move(storage: MemoryStorage, old: Authority, x: number, y: number) {
  return committed(storage, old, moveCharacterWithAutomaticLucky(storage, writer, clock, { ...old, target: { x, y } }));
}

describe('Stage 3 real cross-Item lifecycle Freeze evidence', () => {
  it('Lucky rescue reopens, later encounter uses Revive without a second Lucky or double rescue', () => {
    const { storage, authority: initial } = setup();
    const original = JSON.stringify(initial);
    const lucky = move(storage, initial, 0, 0);
    expect(lucky.currentAttempt.gameState.account.inventory).toEqual({ lucky: 1, revive: 2, detection: 3, airplane: 2 });
    expect(lucky.currentAttempt.gameState.run).toMatchObject({ phase: { kind: 'active' }, characterPosition: { kind: 'revealed-mine-occupancy', coordinate: { x: 0, y: 0 } } });
    expect(useRevive(storage, writer, clock, lucky)).toEqual({ status: 'rejected', reason: 'no-pending-mine-encounter' });
    const pending = move(storage, lucky, 4, 0);
    expect(pending.currentAttempt.gameState.run.phase).toMatchObject({ kind: 'pending-mine-encounter', encounter: { occurredOnFirstStep: false } });
    expect(resolveAutomaticLucky(storage, writer, clock, pending)).toEqual({ status: 'not-applicable', reason: 'not-first-step' });
    const revived = committed(storage, pending, useRevive(storage, writer, clock, pending));
    expect(revived.currentAttempt.gameState.account.inventory).toEqual({ lucky: 1, revive: 1, detection: 3, airplane: 2 });
    expect(revived.currentAttempt.gameState.runItems.successfulReviveUses).toBe(1);
    expect(revived.currentAttempt.gameState.run.phase.kind).toBe('active');
    const duplicate = useRevive(storage, writer, clock, pending);
    expect(duplicate).toMatchObject({ status: 'commit-rejected', failure: { status: 'revision-conflict' } });
    expect(duplicate).not.toHaveProperty('candidate');
    reopen(storage, revived);
    expect(JSON.stringify(initial)).toBe(original);
  });

  it('Detection -> reopen -> Airplane -> won -> reopen rejects every Item without further consumption', () => {
    const { storage, authority } = setup(true);
    const safe = move(storage, authority, 1, 1);
    const detected = committed(storage, safe, useDetection(storage, writer, clock, safe));
    expect(detected.currentAttempt.gameState.run.board.cells[0]).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
    expect(detected.currentAttempt.gameState.runItems.detectionRandomSeed).toBe(124);
    expect(detected.currentAttempt.gameState.run.phase.kind).toBe('active');
    const won = committed(storage, detected, useAirplane(storage, writer, clock, { ...detected, target: { x: 1, y: 1 } }));
    expect(won.currentAttempt.gameState.run.phase.kind).toBe('won');
    expect(won.currentAttempt.gameState.run.board.cells[0]).toEqual(detected.currentAttempt.gameState.run.board.cells[0]);
    expect(won.currentAttempt.gameState.account.inventory).toEqual({ lucky: 2, revive: 2, detection: 2, airplane: 1 });
    expect(won.currentAttempt.gameState.runItems).toEqual({ successfulDetectionUses: 1, successfulAirplaneUses: 1, successfulReviveUses: 0, detectionRandomSeed: 124 });
    const start = storage.operations.length;
    expect(useDetection(storage, writer, clock, won)).toEqual({ status: 'rejected', reason: 'run-won' });
    expect(useAirplane(storage, writer, clock, { ...won, target: { x: 1, y: 1 } })).toEqual({ status: 'rejected', reason: 'run-won' });
    expect(useRevive(storage, writer, clock, won)).toEqual({ status: 'rejected', reason: 'no-pending-mine-encounter' });
    expect(resolveAutomaticLucky(storage, writer, clock, won)).toEqual({ status: 'not-applicable', reason: 'no-pending-mine-encounter' });
    expect(storage.operations.slice(start)).toEqual([]);
    reopen(storage, won);
  });

  it.each(['restart', 'retry'] as const)('all four Items consumed then %s resets only attempt-local facts and rejects old authority', action => {
    const { storage, authority } = setup();
    const lucky = move(storage, authority, 0, 0);
    const detected = committed(storage, lucky, useDetection(storage, writer, clock, lucky));
    const pending = move(storage, detected, 4, 0);
    const revived = committed(storage, pending, useRevive(storage, writer, clock, pending));
    let current = committed(storage, revived, useAirplane(storage, writer, clock, { ...revived, target: { x: 1, y: 1 } }));
    expect(current.currentAttempt.gameState.run.phase.kind).toBe('active');
    expect(current.currentAttempt.gameState.account.inventory).toEqual({ lucky: 1, detection: 2, revive: 1, airplane: 1 });
    expect(current.currentAttempt.gameState.runItems).toEqual({ successfulDetectionUses: 1, successfulAirplaneUses: 1, successfulReviveUses: 1, detectionRandomSeed: 124 });
    if (action === 'retry') {
      current = move(storage, current, 4, 2);
      expect(useRevive(storage, writer, clock, current)).toEqual({ status: 'rejected', reason: 'usage-limit-reached' });
      const failure = settleMineEncounterAsFailure(current.currentAttempt.gameState.run);
      if (failure.outcome !== 'failed') throw new Error('Expected explicit failure');
      current = committed(storage, current, commitCandidateWithWriterLease(storage, writer, clock, current.currentRevision, {
        revision: current.currentRevision + 1, activeRun: { ...current.currentAttempt,
          gameState: createGameState({ ...current.currentAttempt.gameState, run: failure.state }) },
      }));
    }
    const next = committed(storage, current, (action === 'restart' ? restartCurrentAttempt : retryFailedAttempt)(storage, writer, clock, {
      ...current, generationConfiguration: { dimensions: { width: 5, height: 3 }, obstacleCoordinates: [], mineCount: 4 },
      runIdSource: { nextRunId: () => 'new-attempt' },
    }));
    expect(next.currentAttempt.runId).toBe('new-attempt');
    expect(next.currentAttempt.levelId).toBe(current.currentAttempt.levelId);
    expect(next.currentAttempt.gameState.account).toEqual(current.currentAttempt.gameState.account);
    expect(next.currentAttempt.gameState.runItems).toEqual({ successfulDetectionUses: 0, successfulAirplaneUses: 0, successfulReviveUses: 0,
      detectionRandomSeed: next.currentAttempt.generationProvenance?.seed });
    expect(next.currentAttempt.gameState.run).toMatchObject({ phase: { kind: 'active' }, hasTakenStep: false, characterPosition: { kind: 'waiting' } });
    expect(next.currentAttempt.gameState.run.board.cells.every(cell => cell.kind === 'obstacle' || (!cell.flagged && (cell.kind === 'safe' ? cell.exploration === 'unexplored' : cell.revelation === 'hidden')))).toBe(true);
    const oldRequest = moveCharacterWithAutomaticLucky(storage, writer, clock, { ...authority, target: { x: 0, y: 0 } });
    expect(oldRequest).toMatchObject({ status: 'commit-rejected', failure: { status: 'revision-conflict' } });
    expect(oldRequest).not.toHaveProperty('candidate');
    reopen(storage, next);
  });

  it.each(['storage', 'stale', 'ownership'] as const)('rescue chain %s failure never falls through to Failure or publishes resources', fault => {
    const { storage, authority } = setup();
    for (const stage of ['lucky', 'revive'] as const) {
      let current = authority;
      if (stage === 'revive') {
        const lucky = move(storage, authority, 0, 0);
        current = move(storage, lucky, 4, 0);
      }
      const original = JSON.stringify(current);
      if (fault === 'storage') storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
      const identity = fault === 'ownership' ? { sessionId: 'other', leaseToken: 'other' } : writer;
      const request = { ...current, currentRevision: fault === 'stale' ? 99 : current.currentRevision };
      const result = stage === 'lucky'
        ? moveCharacterWithAutomaticLucky(storage, identity, clock, { ...request, target: { x: 0, y: 0 } })
        : useRevive(storage, identity, clock, request);
      expect(result).toMatchObject({ status: 'commit-rejected', failure: { status: fault === 'storage' ? 'persistence-commit-failure' : fault === 'stale' ? 'revision-conflict' : 'writer-not-owner' } });
      expect(result).not.toHaveProperty('candidate');
      expect(JSON.stringify(current)).toBe(original);
      expect(current.currentAttempt.gameState.run.phase.kind).toBe(stage === 'lucky' ? 'active' : 'pending-mine-encounter');
      reopen(storage, current);
    }
  });
});
