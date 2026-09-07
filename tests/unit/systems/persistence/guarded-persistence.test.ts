import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
} from '../../../../src/core/board';
import { createGameState } from '../../../../src/core/game-state';
import { type SaveDocumentPersistenceInputV2 } from '../../../../src/core/persistence/save-v2';
import { createInitialRunItemState } from '../../../../src/core/run-item-state';
import { createOnBoardPosition, createRunState } from '../../../../src/core/run';
import { SNAPSHOT_STORAGE_KEYS } from '../../../../src/systems/persistence/crash-safe-snapshot-store';
import { commitCandidateWithWriterLease } from '../../../../src/systems/persistence/guarded-persistence';
import { loadPersistedSave } from '../../../../src/systems/persistence/persistence-coordinator';
import {
  acquireWriterLease,
  WRITER_LEASE_STORAGE_KEY,
  type Clock,
  type WriterIdentity,
} from '../../../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../../../helpers/memory-storage';
import { createTestAccount } from '../../../helpers/save-v2';

class FakeClock implements Clock {
  constructor(public value = 0) {}
  nowMs(): number { return this.value; }
}

const writer: WriterIdentity = { sessionId: 'session', leaseToken: 'token' };

function candidate(revision: number): SaveDocumentPersistenceInputV2 {
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
      gameState: createGameState({
        account: createTestAccount(),
        run: createRunState(board, createOnBoardPosition(createCoordinate(0, 0)), {
          phase: { kind: 'won' },
        }),
        runItems: createInitialRunItemState(0),
      }),
    },
  };
}

function ready(): { storage: MemoryStorage; clock: FakeClock } {
  const storage = new MemoryStorage();
  const clock = new FakeClock();
  expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
  return { storage, clock };
}

function expectNotPublishable(result: ReturnType<typeof commitCandidateWithWriterLease>): void {
  expect(result.status).not.toBe('committed');
  expect(Object.hasOwn(result, 'candidate')).toBe(false);
}

describe('session-owned revision guard', () => {
  it('commits fresh storage only with expected null and candidate revision zero', () => {
    const { storage, clock } = ready();
    const input = candidate(0);
    const result = commitCandidateWithWriterLease(storage, writer, clock, null, input);

    expect(result).toMatchObject({
      status: 'committed', candidate: input, revision: 0, previousAuthority: 'no-save',
    });
  });

  it.each([
    ['fresh revision one', null, 1, 'invalid-next-revision'],
    ['same revision', 0, 0, 'invalid-next-revision'],
    ['skipped revision', 0, 2, 'invalid-next-revision'],
    ['lower revision', 0, -1, 'invalid-next-revision'],
  ] as const)('rejects %s without publishing', (_name, expected, next, status) => {
    const { storage, clock } = ready();
    if (expected !== null) {
      expect(commitCandidateWithWriterLease(storage, writer, clock, null, candidate(0)).status)
        .toBe('committed');
    }
    const result = commitCandidateWithWriterLease(storage, writer, clock, expected, candidate(next));
    expect(result.status).toBe(status);
    expectNotPublishable(result);
  });

  it('commits the exact zero-to-one progression', () => {
    const { storage, clock } = ready();
    expect(commitCandidateWithWriterLease(storage, writer, clock, null, candidate(0)).status)
      .toBe('committed');

    expect(commitCandidateWithWriterLease(storage, writer, clock, 0, candidate(1)))
      .toMatchObject({ status: 'committed', revision: 1 });
  });

  it('rejects stale expected revision after another successful commit', () => {
    const { storage, clock } = ready();
    expect(commitCandidateWithWriterLease(storage, writer, clock, null, candidate(0)).status)
      .toBe('committed');
    expect(commitCandidateWithWriterLease(storage, writer, clock, 0, candidate(1)).status)
      .toBe('committed');

    const result = commitCandidateWithWriterLease(storage, writer, clock, 0, candidate(1));
    expect(result).toEqual({
      status: 'revision-conflict', expectedRevision: 0, actualRevision: 1,
    });
    expectNotPublishable(result);
  });

  it('rejects missing, different, and expired writer authority before persistence commit', () => {
    const noLease = new MemoryStorage();
    const clock = new FakeClock();
    expect(commitCandidateWithWriterLease(noLease, writer, clock, null, candidate(0)))
      .toEqual({ status: 'writer-not-owner', reason: 'no-lease' });

    const active = ready();
    expect(commitCandidateWithWriterLease(
      active.storage, { sessionId: 'other', leaseToken: 'other' }, active.clock, null, candidate(0),
    )).toEqual({ status: 'writer-not-owner', reason: 'different-owner' });

    active.clock.value = 30_000;
    expect(commitCandidateWithWriterLease(active.storage, writer, active.clock, null, candidate(0)))
      .toEqual({ status: 'lease-expired' });
  });

  it('second ownership verification catches an ordinary takeover race', () => {
    const clock = new FakeClock();
    class RacingStorage extends MemoryStorage {
      guardedCommitActive = false;
      guardedLeaseReads = 0;
      readonly observedSessions: string[] = [];

      override read(key: string) {
        if (this.guardedCommitActive && key === WRITER_LEASE_STORAGE_KEY) {
          this.guardedLeaseReads += 1;
          if (this.guardedLeaseReads === 2) {
            this.data.set(key, JSON.stringify({
              formatVersion: 1,
              sessionId: 'racer',
              leaseToken: 'racer-token',
              expiresAtMs: 30_000,
            }));
          }
        }
        const result = super.read(key);
        if (
          this.guardedCommitActive &&
          key === WRITER_LEASE_STORAGE_KEY &&
          result.status === 'success' &&
          result.value !== null
        ) {
          const observed = JSON.parse(result.value) as { readonly sessionId: string };
          this.observedSessions.push(observed.sessionId);
        }
        return result;
      }
    }
    const storage = new RacingStorage();
    expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
    expect(commitCandidateWithWriterLease(storage, writer, clock, null, candidate(0)).status)
      .toBe('committed');
    storage.guardedCommitActive = true;

    const result = commitCandidateWithWriterLease(storage, writer, clock, 0, candidate(1));
    expect(result).toEqual({ status: 'writer-not-owner', reason: 'different-owner' });
    expect(storage.observedSessions).toEqual(['session', 'racer']);
    expect(loadPersistedSave(storage)).toMatchObject({ status: 'loaded', revision: 0 });
  });

  it('does not overwrite corrupt or malformed authoritative persistence', () => {
    const corrupt = ready();
    corrupt.storage.data.set(SNAPSHOT_STORAGE_KEYS.slotA, 'orphan');
    const corruptResult = commitCandidateWithWriterLease(
      corrupt.storage, writer, corrupt.clock, null, candidate(0),
    );
    expect(corruptResult).toMatchObject({
      status: 'persistence-load-failure', failure: { status: 'corrupt' },
    });

    const malformed = ready();
    const payload = '{bad-json';
    const snapshot = JSON.stringify({
      formatVersion: 1, slot: 'A', revision: 0, serializedPayload: payload,
    });
    malformed.storage.data.set(SNAPSHOT_STORAGE_KEYS.slotA, snapshot);
    malformed.storage.data.set(SNAPSHOT_STORAGE_KEYS.head, JSON.stringify({
      formatVersion: 1, slot: 'A', revision: 0,
    }));
    expect(commitCandidateWithWriterLease(malformed.storage, writer, malformed.clock, 0, candidate(1)))
      .toMatchObject({
        status: 'persistence-load-failure', failure: { status: 'malformed-json' },
      });
  });

  it('uses a valid recovered backup revision and preserves its provenance', () => {
    const { storage, clock } = ready();
    expect(commitCandidateWithWriterLease(storage, writer, clock, null, candidate(0)).status)
      .toBe('committed');
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{broken');

    expect(commitCandidateWithWriterLease(storage, writer, clock, 0, candidate(1)))
      .toMatchObject({ status: 'committed', revision: 1, previousAuthority: 'head-backup' });
  });

  it('preserves underlying commit failure and exposes no candidate', () => {
    const { storage, clock } = ready();
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotA);
    const result = commitCandidateWithWriterLease(storage, writer, clock, null, candidate(0));

    expect(result).toMatchObject({
      status: 'persistence-commit-failure',
      failure: { status: 'persistence-failure', failure: { stage: 'slot-write' } },
    });
    expectNotPublishable(result);
  });
});
