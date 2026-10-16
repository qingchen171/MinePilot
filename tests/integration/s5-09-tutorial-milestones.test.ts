import { describe, expect, it } from 'vitest';
import { TUTORIAL_MILESTONE_IDS } from '../../src/core/settings-tutorial';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from '../helpers/memory-storage';

const owner = { sessionId: 's5-09-tutorial', leaseToken: 's5-09-tutorial-token' };
const clock = { nowMs: () => 100 };
const snapshotWrites = (operation: string) => Object.values(SNAPSHOT_STORAGE_KEYS)
  .some((key) => operation === `write:${key}`);
// Pin the frozen S5-04 product IDs independently of the implementation's iterable.
const FROZEN_IDS = [
  'l1-movement-current-number', 'l2-number-hides-on-leave',
  'l3-flag-misclick-protection', 'l4-one-time-coin-reward',
  'l5-failure-retry-first-step-safety', 'first-lucky',
  'first-obstacle', 'first-items', 'first-shop',
] as const;

describe('S5-09 G5 all nine exact tutorial milestones, guarded v4 authority', () => {
  it('persists each explicit acknowledgment once and reopens without display-implied progress', () => {
    expect(TUTORIAL_MILESTONE_IDS).toEqual(FROZEN_IDS);
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    expect(session.read()).toMatchObject({ status: 'fresh', runtime: {
      tutorialProgress: { acknowledgedMilestoneIds: [] } } });
    for (const [index, milestoneId] of TUTORIAL_MILESTONE_IDS.entries()) {
      const expectedRevision = index === 0 ? null : index - 1;
      const beforeWrites = storage.operations.filter(snapshotWrites).length;
      expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId,
        expectedRevision, expectedRunId: null }))
        .toMatchObject({ status: 'committed', revision: index });
      expect(storage.operations.filter(snapshotWrites).length).toBeGreaterThan(beforeWrites);
      const reopened = createProductionStage4Session(storage, owner, clock).read();
      expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: index, sourceSaveVersion: 4 },
        runtime: { currentAttempt: null, tutorialProgress: {
          acknowledgedMilestoneIds: TUTORIAL_MILESTONE_IDS.slice(0, index + 1) } } });
      const writesAfter = storage.operations.filter(snapshotWrites).length;
      expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId,
        expectedRevision: index, expectedRunId: null }))
        .toEqual({ status: 'rejected', reason: 'tutorial-already-acknowledged' });
      expect(storage.operations.filter(snapshotWrites).length).toBe(writesAfter);
      expect(loadCommittedSnapshot(storage)).toMatchObject({ status: 'loaded', revision: index });
    }
  });
});
