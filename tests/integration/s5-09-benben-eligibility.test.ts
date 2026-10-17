import { describe, expect, it } from 'vitest';
import { deriveBenbenEligibility } from '../../src/core/benben-random';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from '../helpers/memory-storage';

const owner = { sessionId: 's5-09-benben', leaseToken: 's5-09-benben-token' };
const clock = { nowMs: () => 100 };
const creation = (runId: string, baseSeed: number) => ({ runId, baseSeed,
  rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' });

function loaded(session: ReturnType<typeof createProductionStage4Session>) {
  const read = session.read();
  if (read.status !== 'loaded' || read.runtime.currentAttempt === null) throw new Error('committed Attempt');
  return read;
}

function target(session: ReturnType<typeof createProductionStage4Session>, kind: 'safe' | 'mine') {
  const board = loaded(session).runtime.currentAttempt!.run.board;
  const index = board.cells.findIndex((cell) => cell.kind === kind);
  if (index < 0) throw new Error(`${kind} target`);
  return { x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) };
}

describe('S5-09 G4 deterministic eligibility through guarded production v4 session', () => {
  for (const [name, thirdRunId, success] of [
    ['available', 's5-09-third-2', true],
    ['unavailable', 's5-09-third-4', false],
  ] as const) {
    it(`reopens failure streaks 1, 2 and independent third-roll ${name} without a rejected-commit reroll`, () => {
      expect(deriveBenbenEligibility({ levelId: 'level-001', runId: thirdRunId }))
        .toMatchObject({ status: 'derived', success });
      const storage = new MemoryStorage();
      const session = createProductionStage4Session(storage, owner, clock);
      const runIds = [`s5-09-${name}-first`, `s5-09-${name}-second`, thirdRunId];
      expect(session.execute({ kind: 'start', levelId: 'level-001', creation: creation(runIds[0]!, 101),
        expectedRevision: null, expectedRunId: null })).toMatchObject({ status: 'committed', revision: 0 });
      for (let cycle = 0; cycle < 3; cycle++) {
        const runId = runIds[cycle]!;
        let revision = loaded(session).persistence.revision;
        expect(session.execute({ kind: 'move', coordinate: target(session, 'safe'),
          expectedRevision: revision, expectedRunId: runId })).toMatchObject({ status: 'committed' });
        revision = loaded(session).persistence.revision;
        expect(session.execute({ kind: 'move', coordinate: target(session, 'mine'),
          expectedRevision: revision, expectedRunId: runId })).toMatchObject({ status: 'committed' });
        revision = loaded(session).persistence.revision;
        const failure = { kind: 'failure' as const, expectedRevision: revision, expectedRunId: runId };
        if (cycle === 2) {
          const before = loaded(session);
          const snapshot = loadCommittedSnapshot(storage);
          if (snapshot.status !== 'loaded') throw new Error('snapshot');
          storage.failNext('write', snapshot.slot === 'A' ? SNAPSHOT_STORAGE_KEYS.slotB : SNAPSHOT_STORAGE_KEYS.slotA);
          expect(session.execute(failure)).toEqual({ status: 'rejected', reason: 'commit-persistence-commit-failure' });
          expect(session.read()).toEqual(before);
          expect(loadCommittedSnapshot(storage)).toMatchObject({ status: 'loaded', revision });
        }
        expect(session.execute(failure)).toMatchObject({ status: 'committed', revision: revision + 1 });
        const after = loaded(session);
        const reopened = createProductionStage4Session(storage, owner, clock).read();
        expect(reopened).toEqual(after);
        expect(after.runtime.account.benbenByLevel).toEqual([{
          levelId: 'level-001', status: cycle === 2 && success ? 'available' : 'unavailable',
          failureStreak: cycle === 2 ? 0 : cycle + 1,
        }]);
        if (cycle < 2) {
          expect(session.execute({ kind: 'retry', creation: creation(runIds[cycle + 1]!, 102 + cycle),
            expectedRevision: after.persistence.revision, expectedRunId: runId }))
            .toMatchObject({ status: 'committed', revision: after.persistence.revision + 1 });
        }
      }
    });
  }
});
