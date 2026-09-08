import { describe, expect, it, vi } from 'vitest';
import { useDetection } from '../../src/systems/persistence/detection';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import { loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { acquireWriterLease } from '../../src/systems/persistence/writer-lease';
import { SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { detectionGame } from '../helpers/detection';
import { MemoryStorage } from '../helpers/memory-storage';

const writer = { sessionId: 'detection-session', leaseToken: 'detection-token' };
const clock = { nowMs: () => 0 };
function setup(seed: number | null = null) {
  const storage = new MemoryStorage();
  const attempt = { runId: 'run-1', levelId: 'level-1', gameState: detectionGame(undefined, { seed }), generationProvenance: { seed: 999, rngVersion: 'mulberry32-v1', generationVersion: 'initial-board-v1' } };
  expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
  expect(commitCandidateWithWriterLease(storage, writer, clock, null, { revision: 0, activeRun: attempt }).status).toBe('committed');
  storage.operations.length = 0;
  return { storage, attempt };
}

describe('Detection persist-before-publish', () => {
  it.each([null, 123456789])('commits and reopens exact authority with initial seed %s', (seed) => {
    const { storage, attempt } = setup(seed);
    const source = vi.fn(() => 50);
    const result = useDetection(storage, writer, clock, { currentAttempt: attempt, currentRevision: 0, initializeSeed: source });
    expect(result.status).toBe('committed');
    if (result.status !== 'committed' || result.candidate.activeRun === null) throw new Error('Expected committed');
    expect(result.revision).toBe(1);
    expect(source).toHaveBeenCalledTimes(seed === null ? 1 : 0);
    const game = result.candidate.activeRun.gameState;
    expect(game.account.inventory.detection).toBe(2);
    expect(game.runItems.successfulDetectionUses).toBe(1);
    expect(game.runItems.detectionRandomSeed).toBe((seed ?? 50) + 1);
    expect(result.candidate.activeRun.generationProvenance).toEqual(attempt.generationProvenance);
    expect(attempt.gameState.runItems.detectionRandomSeed).toBe(seed);
    const operations = storage.operations.length;
    const reopened = loadPersistedSave(storage);
    if (!('save' in reopened) || reopened.save.activeRun === null) throw new Error('Expected reopen');
    expect(reopened.save.activeRun.gameState).toEqual(game);
    expect(reopened.save.activeRun.gameState).not.toBe(game);
    expect(reopened.revision).toBe(1);
    expect(reopened.save.activeRun.runId).toBe('run-1');
    expect(storage.operations.slice(operations).every((operation) => operation.startsWith('read:'))).toBe(true);
  });
  it.each(['storage', 'stale', 'ownership'] as const)('failure %s preserves null seed and old authority without disclosing target', (failure) => {
    const { storage, attempt } = setup();
    const snapshot = [...storage.data];
    const before = JSON.stringify(attempt);
    if (failure === 'storage') storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);
    const result = useDetection(storage,
      failure === 'ownership' ? { sessionId: 'other', leaseToken: 'other' } : writer,
      clock,
      { currentAttempt: attempt, currentRevision: failure === 'stale' ? 5 : 0, initializeSeed: () => 17 },
    );
    expect(result.status).toBe('commit-rejected');
    if (result.status !== 'commit-rejected') throw new Error('Expected rejected');
    expect(result.failure.status).toBe(failure === 'storage' ? 'persistence-commit-failure' : failure === 'stale' ? 'revision-conflict' : 'writer-not-owner');
    expect(result).not.toHaveProperty('candidate');
    expect(result).not.toHaveProperty('target');
    expect([...storage.data]).toEqual(snapshot);
    expect(JSON.stringify(attempt)).toBe(before);
    const reopened = loadPersistedSave(storage);
    if (!('save' in reopened) || reopened.save.activeRun === null) throw new Error('Expected preserved save');
    expect(reopened.save.activeRun.gameState).toEqual(attempt.gameState);
    expect(reopened.save.activeRun.gameState.runItems.detectionRandomSeed).toBeNull();
    expect(reopened.revision).toBe(0);
  });
  it('no target never obtains entropy or touches storage', () => {
    const storage = new MemoryStorage();
    const source = vi.fn(() => 25);
    const result = useDetection(storage, writer, clock, { currentAttempt: { runId: 'run', levelId: 'level', gameState: detectionGame(['SSS', 'SES', 'SSS'], { seed: null }) }, currentRevision: 0, initializeSeed: source });
    expect(result).toEqual({ status: 'rejected', reason: 'no-hidden-mine' });
    expect(storage.operations).toEqual([]);
    expect(source).not.toHaveBeenCalled();
  });
  it('default initializer uses independent entropy without changing generation provenance', () => {
    const { storage, attempt } = setup();
    const entropy = vi.fn((buffer: Uint32Array) => { buffer[0] = 42; return buffer; });
    vi.stubGlobal('crypto', { getRandomValues: entropy });
    try {
      const result = useDetection(storage, writer, clock, { currentAttempt: attempt, currentRevision: 0 });
      if (result.status !== 'committed' || result.candidate.activeRun === null) throw new Error('Expected committed');
      expect(entropy).toHaveBeenCalledTimes(1);
      expect(result.candidate.activeRun.gameState.runItems.detectionRandomSeed).toBe(43);
      expect(result.candidate.activeRun.generationProvenance).toEqual(attempt.generationProvenance);
    } finally { vi.unstubAllGlobals(); }
  });
});
