import { describe, expect, it } from 'vitest';
import { useRevive } from '../../src/systems/persistence/revive';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import { loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { acquireWriterLease } from '../../src/systems/persistence/writer-lease';
import { SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { reviveGame } from '../helpers/revive';
import { MemoryStorage } from '../helpers/memory-storage';

const writer = { sessionId: 'revive-session', leaseToken: 'revive-token' };
const clock = { nowMs: () => 0 };
function setup(first = false) {
  const storage = new MemoryStorage();
  const attempt = { runId: 'run-1', levelId: 'level-1', gameState: reviveGame({ first }), generationProvenance: { seed: 999, rngVersion: 'mulberry32-v1', generationVersion: 'initial-board-v1' } };
  expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
  expect(commitCandidateWithWriterLease(storage, writer, clock, null, { revision: 0, activeRun: attempt }).status).toBe('committed');
  storage.operations.length = 0;
  return { storage, attempt };
}

describe('Revive persisted authority', () => {
  it.each([true, false])('reopens pending first=%s then commits and restores exact survival', (first) => {
    const { storage, attempt } = setup(first);
    const pending = loadPersistedSave(storage);
    if (!('save' in pending) || pending.save.activeRun === null) throw new Error('Expected pending');
    expect(pending.save.activeRun.gameState).toEqual(attempt.gameState);
    const result = useRevive(storage, writer, clock, { currentAttempt: pending.save.activeRun, currentRevision: pending.revision });
    if (result.status !== 'committed' || result.candidate.activeRun === null) throw new Error('Expected commit');
    expect(result.revision).toBe(1);
    const next = result.candidate.activeRun;
    expect(next.runId).toBe(attempt.runId);
    expect(next.levelId).toBe(attempt.levelId);
    expect(next.generationProvenance).toEqual(attempt.generationProvenance);
    expect(next.gameState.account.inventory.revive).toBe(1);
    expect(next.gameState.runItems).toEqual({ ...attempt.gameState.runItems, successfulReviveUses: 1 });
    expect(next.gameState.run.phase.kind).toBe('active');
    expect(next.gameState.run.characterPosition).toEqual({ kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 } });
    const operationCount = storage.operations.length;
    const reopened = loadPersistedSave(storage);
    if (!('save' in reopened) || reopened.save.activeRun === null) throw new Error('Expected reopen');
    expect(reopened.save.activeRun).toEqual(next);
    expect(reopened.save.activeRun.gameState).not.toBe(next.gameState);
    expect(reopened.revision).toBe(1);
    expect(storage.operations.slice(operationCount).every((op) => op.startsWith('read:'))).toBe(true);
    expect(attempt.gameState.run.phase.kind).toBe('pending-mine-encounter');
    expect(useRevive(storage, writer, clock, { currentAttempt: attempt, currentRevision: 0 }).status).toBe('commit-rejected');
  });

  it.each(['storage', 'stale', 'ownership'] as const)('rejects %s with old pending authority preserved', (failure) => {
    const { storage, attempt } = setup();
    const before = JSON.stringify(attempt);
    const snapshot = [...storage.data];
    if (failure === 'storage') storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);
    const result = useRevive(storage, failure === 'ownership' ? { sessionId: 'other', leaseToken: 'other' } : writer,
      clock, { currentAttempt: attempt, currentRevision: failure === 'stale' ? 9 : 0 });
    if (result.status !== 'commit-rejected') throw new Error('Expected rejection');
    expect(result.failure.status).toBe(failure === 'storage' ? 'persistence-commit-failure' : failure === 'stale' ? 'revision-conflict' : 'writer-not-owner');
    expect(result).not.toHaveProperty('candidate');
    expect([...storage.data]).toEqual(snapshot);
    expect(JSON.stringify(attempt)).toBe(before);
    const restored = loadPersistedSave(storage);
    if (!('save' in restored) || restored.save.activeRun === null) throw new Error('Expected preserved save');
    expect(restored.revision).toBe(0);
    expect(restored.save.activeRun).toEqual(attempt);
  });

  it.each([{ first: true, lucky: 1 }, { inventory: 0 }, { uses: 1 }])('eligibility failure never touches storage: %j', (options) => {
    const storage = new MemoryStorage();
    const result = useRevive(storage, writer, clock, { currentAttempt: { runId: 'run', levelId: 'level', gameState: reviveGame(options) }, currentRevision: 0 });
    expect(result.status).toBe('rejected');
    expect(result).not.toHaveProperty('candidate');
    expect(storage.operations).toEqual([]);
  });
});
