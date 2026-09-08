import { describe, expect, it, vi } from 'vitest';
import * as movement from '../../src/core/movement';
import { createGameState } from '../../src/core/game-state';
import { createWaitingRunState } from '../../src/core/run';
import { settleMineEncounterAsFailure } from '../../src/core/encounter';
import { moveCharacterWithAutomaticLucky, resolveAutomaticLucky } from '../../src/systems/persistence/lucky';
import { useRevive } from '../../src/systems/persistence/revive';
import { restartCurrentAttempt, retryFailedAttempt } from '../../src/systems/persistence/new-attempt';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import { loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { acquireWriterLease } from '../../src/systems/persistence/writer-lease';
import { SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { reviveGame } from '../helpers/revive';
import { MemoryStorage } from '../helpers/memory-storage';

const writer = { sessionId: 'lucky-session', leaseToken: 'lucky-token' };
const clock = { nowMs: () => 0 };
function setup(lucky = 2, pending = false) {
  const storage = new MemoryStorage();
  const base = reviveGame({ first: true, lucky });
  const gameState = pending ? base : createGameState({ ...base, run: createWaitingRunState(base.run.board) });
  const attempt = { runId: 'run-1', levelId: 'level-1', gameState,
    generationProvenance: { seed: 999, rngVersion: 'mulberry32-v1', generationVersion: 'initial-board-v1' } };
  expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
  expect(commitCandidateWithWriterLease(storage, writer, clock, null, { revision: 0, activeRun: attempt }).status).toBe('committed');
  storage.operations.length = 0;
  return { storage, attempt };
}

describe('automatic Lucky persisted lifecycle', () => {
  it('movement creates pending and automatically survives before a single commit; reopen never retriggers', () => {
    const { storage, attempt } = setup();
    const spy = vi.spyOn(movement, 'moveCharacter');
    const result = moveCharacterWithAutomaticLucky(storage, writer, clock, { currentAttempt: attempt, currentRevision: 0, target: { x: 1, y: 0 } });
    expect(spy.mock.results[0].value).toMatchObject({ outcome: 'requires-resolution', state: { phase: { kind: 'pending-mine-encounter', encounter: { occurredOnFirstStep: true } } } });
    spy.mockRestore();
    if (result.status !== 'committed' || !result.candidate.activeRun) throw new Error('Expected automatic commit');
    expect(result.resolution).toBe('lucky');
    expect(result.revision).toBe(1);
    const next = result.candidate.activeRun;
    expect(next.gameState.account.inventory).toEqual({ ...attempt.gameState.account.inventory, lucky: 1 });
    expect(next.gameState.runItems).toEqual(attempt.gameState.runItems);
    expect(next.gameState.run).toMatchObject({ phase: { kind: 'active' }, hasTakenStep: true,
      characterPosition: { kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 } } });
    expect(next.runId).toBe(attempt.runId);
    expect(next.generationProvenance).toEqual(attempt.generationProvenance);
    storage.operations.length = 0;
    const reopened = loadPersistedSave(storage);
    if (!('save' in reopened) || !reopened.save.activeRun) throw new Error('Expected reopen');
    expect(reopened.save.activeRun).toEqual(next);
    expect(reopened.revision).toBe(1);
    expect(storage.operations.every(op => op.startsWith('read:'))).toBe(true);
    storage.operations.length = 0;
    expect(resolveAutomaticLucky(storage, writer, clock, { currentAttempt: reopened.save.activeRun, currentRevision: 1 })).toEqual({ status: 'not-applicable', reason: 'no-pending-mine-encounter' });
    expect(storage.operations).toEqual([]);
    const duplicate = moveCharacterWithAutomaticLucky(storage, writer, clock, { currentAttempt: attempt, currentRevision: 0, target: { x: 1, y: 0 } });
    expect(duplicate).toMatchObject({ status: 'commit-rejected', failure: { status: 'revision-conflict' } });
    expect(duplicate).not.toHaveProperty('candidate');
    expect(attempt.gameState.run.characterPosition.kind).toBe('waiting');
    expect(attempt.gameState.account.inventory.lucky).toBe(2);
  });

  it.each([true, false])('not applicable preserves pending for explicit Revive (first=%s)', first => {
    const { storage, attempt } = setup(first ? 0 : 2);
    let current = attempt;
    let revision = 0;
    if (!first) {
      const safe = moveCharacterWithAutomaticLucky(storage, writer, clock, { currentAttempt: current, currentRevision: revision, target: { x: 0, y: 0 } });
      if (safe.status !== 'committed' || !safe.candidate.activeRun) throw new Error('Expected safe');
      current = { ...current, ...safe.candidate.activeRun };
      revision = safe.revision;
    }
    const hit = moveCharacterWithAutomaticLucky(storage, writer, clock, { currentAttempt: current, currentRevision: revision, target: { x: 1, y: 0 } });
    if (hit.status !== 'committed' || !hit.candidate.activeRun) throw new Error('Expected pending');
    expect(hit.resolution).toBe('pending');
    expect(hit.candidate.activeRun.gameState.run.phase.kind).toBe('pending-mine-encounter');
    expect(resolveAutomaticLucky(storage, writer, clock, { currentAttempt: hit.candidate.activeRun, currentRevision: hit.revision })).toEqual({ status: 'not-applicable', reason: first ? 'no-lucky' : 'not-first-step' });
    const revived = useRevive(storage, writer, clock, { currentAttempt: hit.candidate.activeRun, currentRevision: hit.revision });
    if (revived.status !== 'committed' || !revived.candidate.activeRun) throw new Error('Expected Revive');
    expect(revived.candidate.activeRun.gameState.account.inventory.lucky).toBe(first ? 0 : 2);
    expect(revived.candidate.activeRun.gameState.account.inventory.revive).toBe(1);
  });

  it.each(['storage', 'stale', 'ownership'] as const)('automatic %s failure preserves old authority without fallback', failure => {
    const { storage, attempt } = setup();
    const original = JSON.stringify(attempt);
    if (failure === 'storage') storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);
    const result = moveCharacterWithAutomaticLucky(storage, failure === 'ownership' ? { sessionId: 'other', leaseToken: 'other' } : writer,
      clock, { currentAttempt: attempt, currentRevision: failure === 'stale' ? 8 : 0, target: { x: 1, y: 0 } });
    expect(result).toMatchObject({ status: 'commit-rejected', failure: { status: failure === 'storage' ? 'persistence-commit-failure' : failure === 'stale' ? 'revision-conflict' : 'writer-not-owner' } });
    expect(result).not.toHaveProperty('candidate');
    expect(JSON.stringify(attempt)).toBe(original);
    const loaded = loadPersistedSave(storage);
    if (!('save' in loaded)) throw new Error('Expected old authority');
    expect(loaded.save.activeRun).toEqual(attempt);
    expect(loaded.revision).toBe(0);
  });

  it('restored pending stays read-only until explicit continuation and failure retains pending', () => {
    const { storage, attempt } = setup(2, true);
    const loaded = loadPersistedSave(storage);
    expect(storage.operations.every(op => op.startsWith('read:'))).toBe(true);
    if (!('save' in loaded) || !loaded.save.activeRun) throw new Error('Expected pending');
    expect(loaded.save.activeRun).toEqual(attempt);
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);
    const request = { currentAttempt: loaded.save.activeRun, currentRevision: 0 };
    expect(resolveAutomaticLucky(storage, writer, clock, request).status).toBe('commit-rejected');
    expect(attempt.gameState.run.phase.kind).toBe('pending-mine-encounter');
    const success = resolveAutomaticLucky(storage, writer, clock, request);
    expect(success.status).toBe('committed');
  });

  it.each(['restart', 'retry'] as const)('%s never refunds consumed Lucky', action => {
    const { storage, attempt } = setup();
    const rescued = moveCharacterWithAutomaticLucky(storage, writer, clock, { currentAttempt: attempt, currentRevision: 0, target: { x: 1, y: 0 } });
    if (rescued.status !== 'committed' || !rescued.candidate.activeRun) throw new Error('Expected Lucky');
    let current = rescued.candidate.activeRun;
    let revision = rescued.revision;
    if (action === 'retry') {
      const hit = moveCharacterWithAutomaticLucky(storage, writer, clock, { currentAttempt: current, currentRevision: revision, target: { x: 3, y: 0 } });
      if (hit.status !== 'committed' || !hit.candidate.activeRun) throw new Error('Expected later pending');
      const failed = settleMineEncounterAsFailure(hit.candidate.activeRun.gameState.run);
      if (failed.outcome !== 'failed') throw new Error('Expected failure');
      current = { ...current, gameState: createGameState({ ...current.gameState, run: failed.state }) };
      revision = hit.revision + 1;
      expect(commitCandidateWithWriterLease(storage, writer, clock, hit.revision, { revision, activeRun: current }).status).toBe('committed');
    }
    const result = (action === 'restart' ? restartCurrentAttempt : retryFailedAttempt)(storage, writer, clock, {
      currentAttempt: current, currentRevision: revision,
      generationConfiguration: { dimensions: current.gameState.run.board.dimensions, obstacleCoordinates: [], mineCount: 2 },
      runIdSource: { nextRunId: () => 'new-run' },
    });
    if (result.status !== 'committed' || !result.candidate.activeRun) throw new Error('Expected new attempt');
    expect(result.candidate.activeRun.gameState.account.inventory.lucky).toBe(1);
    expect(result.candidate.activeRun.gameState.run.characterPosition.kind).toBe('waiting');
    const reopened = loadPersistedSave(storage);
    if (!('save' in reopened)) throw new Error('Expected restore');
    expect(reopened.save.activeRun).toEqual(result.candidate.activeRun);
  });
});
