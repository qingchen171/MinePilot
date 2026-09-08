import { describe, expect, it, vi } from 'vitest';
import { useAirplane } from '../../src/systems/persistence/airplane';
import * as guarded from '../../src/systems/persistence/guarded-persistence';
import { loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { acquireWriterLease } from '../../src/systems/persistence/writer-lease';
import { SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { airplaneGame } from '../helpers/airplane';
import { MemoryStorage } from '../helpers/memory-storage';

const writer = { sessionId: 'airplane-session', leaseToken: 'airplane-token' };
const clock = { nowMs: () => 0 };
function setup(gameState = airplaneGame()) {
  const storage = new MemoryStorage();
  const attempt = { runId: 'run-1', levelId: 'level-1', gameState, generationProvenance: { seed: 999, rngVersion: 'mulberry32-v1', generationVersion: 'initial-board-v1' } };
  expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
  expect(guarded.commitCandidateWithWriterLease(storage, writer, clock, null, { revision: 0, activeRun: attempt }).status).toBe('committed');
  storage.operations.length = 0;
  return { storage, attempt };
}

describe('Airplane atomic persistence', () => {
  it.each(['waiting', 'on-board', 'revealed-mine-occupancy'] as const)('commits complete won result and reopens %s', (kind) => {
    const position = kind === 'waiting' ? { kind } : { kind, coordinate: { x: kind === 'on-board' ? 1 : 0, y: 0 } };
    const { storage, attempt } = setup(airplaneGame(['RE', 'WF'], { position }));
    const commit = vi.spyOn(guarded, 'commitCandidateWithWriterLease');
    try {
      const result = useAirplane(storage, writer, clock, { currentAttempt: attempt, currentRevision: 0, target: { x: 0, y: 0 } });
      if (result.status !== 'committed' || result.candidate.activeRun === null) throw new Error('Expected commit');
      expect(commit).toHaveBeenCalledTimes(1);
      const next = result.candidate.activeRun;
      expect(next.gameState.run.phase.kind).toBe('won');
      expect(next.gameState.run.characterPosition).toEqual(position);
      expect(next.gameState.run.hasTakenStep).toBe(attempt.gameState.run.hasTakenStep);
      expect(next.gameState.account.inventory).toEqual({ ...attempt.gameState.account.inventory, airplane: 1 });
      expect(next.gameState.runItems).toEqual({ ...attempt.gameState.runItems, successfulAirplaneUses: 1 });
      expect(next.runId).toBe(attempt.runId);
      expect(next.levelId).toBe(attempt.levelId);
      expect(next.generationProvenance).toEqual(attempt.generationProvenance);
      const operationCount = storage.operations.length;
      const reopened = loadPersistedSave(storage);
      if (!('save' in reopened) || reopened.save.activeRun === null) throw new Error('Expected reopen');
      expect(reopened.save.activeRun).toEqual(next);
      expect(reopened.save.activeRun.gameState).not.toBe(next.gameState);
      expect(reopened.revision).toBe(1);
      expect(storage.operations.slice(operationCount).every((op) => op.startsWith('read:'))).toBe(true);
    } finally { vi.restoreAllMocks(); }
  });
  it.each(['storage', 'stale', 'ownership'] as const)('rejects %s without publishable candidate and preserves old authority', (failure) => {
    const { storage, attempt } = setup();
    const before = JSON.stringify(attempt);
    if (failure === 'storage') storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    const result = useAirplane(storage, failure === 'ownership' ? { sessionId: 'other', leaseToken: 'other' } : writer,
      clock, { currentAttempt: attempt, currentRevision: failure === 'stale' ? 9 : 0, target: { x: 1, y: 1 } });
    if (result.status !== 'commit-rejected') throw new Error('Expected rejection');
    expect(result.failure.status).toBe(failure === 'storage' ? 'persistence-commit-failure' : failure === 'stale' ? 'revision-conflict' : 'writer-not-owner');
    expect(result).not.toHaveProperty('candidate');
    expect(JSON.stringify(attempt)).toBe(before);
    const restored = loadPersistedSave(storage);
    if (!('save' in restored) || restored.save.activeRun === null) throw new Error('Expected preserved save');
    expect(restored.revision).toBe(0);
    expect(restored.save.activeRun).toEqual(attempt);
  });
  it('invalid target never touches persistence', () => {
    const { storage, attempt } = setup();
    expect(useAirplane(storage, writer, clock, { currentAttempt: attempt, currentRevision: 0, target: { x: -1, y: 0 } }))
      .toEqual({ status: 'rejected', reason: 'out-of-bounds' });
    expect(storage.operations).toEqual([]);
  });
});
