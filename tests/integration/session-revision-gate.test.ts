import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
} from '../../src/core/board';
import { type SaveDocumentPersistenceInputV1 } from '../../src/core/persistence/save-v1';
import { createOnBoardPosition, createRunState } from '../../src/core/run';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import { loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import {
  acquireWriterLease,
  type Clock,
  type WriterIdentity,
} from '../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../helpers/memory-storage';

class FakeClock implements Clock {
  constructor(public value = 0) {}
  nowMs(): number { return this.value; }
}

function candidate(revision: number): SaveDocumentPersistenceInputV1 {
  const board = createBoard(createBoardDimensions({ width: 1, height: 1 }), [
    createCellState({
      terrain: 'playable', containsMine: false, explored: true,
      mineRevealed: false, flagged: false,
    }),
  ]);
  return {
    revision,
    activeRun: {
      runId: 'run', levelId: 'level',
      run: createRunState(board, createOnBoardPosition(createCoordinate(0, 0)), {
        phase: { kind: 'won' },
      }),
    },
  };
}

describe('multi-session stale-writer integration', () => {
  it('blocks a second active tab, permits expired takeover, then rejects the old writer', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock();
    const writerA: WriterIdentity = { sessionId: 'tab-a', leaseToken: 'lease-a' };
    const writerB: WriterIdentity = { sessionId: 'tab-b', leaseToken: 'lease-b' };

    expect(acquireWriterLease(storage, writerA, clock, 100).status).toBe('acquired');
    expect(commitCandidateWithWriterLease(storage, writerA, clock, null, candidate(0)).status)
      .toBe('committed');
    expect(acquireWriterLease(storage, writerB, clock, 100).status)
      .toBe('owned-by-another-session');

    clock.value = 100;
    expect(acquireWriterLease(storage, writerB, clock, 100).status).toBe('acquired');
    expect(commitCandidateWithWriterLease(storage, writerB, clock, 0, candidate(1)))
      .toMatchObject({ status: 'committed', revision: 1 });

    const staleAttempt = commitCandidateWithWriterLease(storage, writerA, clock, 0, candidate(1));
    expect(staleAttempt).toEqual({ status: 'writer-not-owner', reason: 'different-owner' });
    expect(Object.hasOwn(staleAttempt, 'candidate')).toBe(false);
    expect(loadPersistedSave(storage)).toMatchObject({ status: 'loaded', revision: 1 });
  });
});
