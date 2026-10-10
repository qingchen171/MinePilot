import { describe, expect, it } from 'vitest';
import { createPresentationRoot } from '../../src/presentation-root';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from '../helpers/memory-storage';
import { countAdjacentMines } from '../../src/core/neighborhood';

const identity = { sessionId: 's5-07', leaseToken: 's5-07-token' };
const clock = { nowMs: () => 100 };
const technical = { nextRunId: () => 's5-07-run', nextGenerationSeed: () => 123456789,
  nextDetectionSeed: () => 777 };
const coordinate = (index: number, width: number) => ({ x: index % width, y: Math.floor(index / width) });

function setup() {
  const storage = new MemoryStorage();
  const session = createProductionStage4Session(storage, identity, clock);
  const root = createPresentationRoot(session, technical);
  expect(root.submit({ kind: 'start', levelId: 'level-001' }).status).toBe('committed');
  const read = session.read();
  if (read.status !== 'loaded' || !read.runtime.currentAttempt) throw new Error('fixture');
  return { storage, session, root, attempt: read.runtime.currentAttempt };
}

describe('S5-07 public presentation over the guarded production session', () => {
  it('uses the selected-coordinate semantic Airplane, commits one resource/usage, and reopens public facts', () => {
    const f = setup();
    const before = f.root.read();
    expect(before).toMatchObject({ status: 'loaded', view: { attempt: { phase: 'active',
      items: { airplane: { offered: true, resource: 'account', usesRemaining: 1 } },
      benben: { entitlement: 'unavailable', claimOffered: false } } } });
    const target = { x: 0, y: 0 };
    const outcome = f.root.submit({ kind: 'airplane', coordinate: target });
    expect(outcome.status).toBe('committed');
    if (outcome.status !== 'committed' || outcome.snapshot.status === 'recovery') return;
    expect(outcome.snapshot.view.account.inventory.airplane).toBe(0);
    expect(outcome.snapshot.view.attempt?.itemUses.airplane).toBe(1);
    expect(outcome.snapshot.view.attempt?.position.kind).toBe('waiting');
    expect(outcome.rewardReceipt?.status).toBe('proven');
    const reopened = createPresentationRoot(createProductionStage4Session(f.storage, identity, clock), technical).read();
    expect(reopened).toEqual(outcome.snapshot);
    expect(JSON.stringify(reopened)).not.toContain('s5-07-run');
    expect(JSON.stringify(reopened)).not.toContain('123456789');
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 1 });
  });

  it('automatically resolves first Mine with Lucky, then presents a later pending decision and Revive', () => {
    const f = setup();
    const cells = f.attempt.run.board.cells;
    const width = f.attempt.run.board.dimensions.width;
    const mines = cells.map((cell, index) => cell.kind === 'mine' ? index : -1).filter((index) => index >= 0);
    expect(mines.length).toBeGreaterThan(1);
    const first = f.root.submit({ kind: 'move', coordinate: coordinate(mines[0]!, width) });
    expect(first).toMatchObject({ status: 'committed', firstLucky: true, snapshot: { status: 'loaded', view: {
      account: { inventory: { lucky: 0, revive: 1 } }, attempt: { phase: 'active',
        position: { kind: 'revealed-mine-occupancy' } },
    } } });
    const second = f.root.submit({ kind: 'move', coordinate: coordinate(mines[1]!, width) });
    expect(second).toMatchObject({ status: 'committed', snapshot: { status: 'loaded', view: {
      attempt: { phase: 'pending-mine-encounter', terminal: { failure: true },
        items: { revive: { offered: true } } },
    } } });
    const revived = f.root.submit({ kind: 'revive' });
    expect(revived).toMatchObject({ status: 'committed', snapshot: { status: 'loaded', view: {
      account: { inventory: { revive: 0 } }, attempt: { phase: 'active',
        position: { kind: 'revealed-mine-occupancy' } },
    } } });
    expect(createPresentationRoot(createProductionStage4Session(f.storage, identity, clock), technical).read())
      .toEqual(f.root.read());
  });

  it('keeps failed Item candidates and uncertainty out of public committed presentation', () => {
    const f = setup();
    const before = f.root.read();
    const index = f.attempt.run.board.cells.findIndex((cell) => cell.kind === 'safe');
    const target = coordinate(index, f.attempt.run.board.dimensions.width);
    f.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);
    const result = f.root.submit({ kind: 'airplane', coordinate: target });
    expect(result).toMatchObject({ status: 'rejected', policy: { retainEnvelope: false } });
    expect(f.root.read()).toEqual(before);
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 0 });
    expect(f.root.gameRetryAvailable()).toBe(false);
  });

  it('keeps no-target Detection zero-cost and commits a successful adjacent scan exactly once', () => {
    for (const [neighborCount, shouldCommit] of [[0, false], [1, true]] as const) {
      const f = setup();
      const board = f.attempt.run.board;
      const width = board.dimensions.width;
      const index = board.cells.findIndex((cell, at) => cell.kind === 'safe' &&
        (shouldCommit ? countAdjacentMines(board, coordinate(at, width)) > 0 :
          countAdjacentMines(board, coordinate(at, width)) === neighborCount));
      expect(index).toBeGreaterThanOrEqual(0);
      const moved = f.root.submit({ kind: 'move', coordinate: coordinate(index, width) });
      expect(moved.status).toBe('committed');
      const before = f.root.read();
      const priorRevision = loadCommittedSnapshot(f.storage);
      const detection = f.root.submit({ kind: 'detection' });
      if (shouldCommit) {
        expect(detection).toMatchObject({ status: 'committed', snapshot: { status: 'loaded', view: {
          account: { inventory: { detection: 1 } }, attempt: { itemUses: { detection: 1 } },
        } } });
        expect(createPresentationRoot(createProductionStage4Session(f.storage, identity, clock), technical).read())
          .toEqual(f.root.read());
      } else {
        expect(detection).toMatchObject({ status: 'rejected', reason: 'no-hidden-mine' });
        expect(f.root.read()).toEqual(before);
        expect(loadCommittedSnapshot(f.storage)).toEqual(priorRevision);
      }
    }
  });

  it('persists explicit tutorial acknowledgment without claiming display alone saved it', () => {
    const f = setup();
    const before = f.root.read();
    expect(before.status).toBe('loaded');
    if (before.status !== 'loaded') return;
    expect(before.view.tutorialProgress.acknowledgedMilestoneIds).not.toContain('first-items');
    const outcome = f.root.submit({ kind: 'acknowledge-tutorial', milestoneId: 'first-items' });
    expect(outcome).toMatchObject({ status: 'committed', snapshot: { status: 'loaded', view: {
      tutorialProgress: { acknowledgedMilestoneIds: ['first-items'] },
    } } });
    expect(createPresentationRoot(createProductionStage4Session(f.storage, identity, clock), technical).read())
      .toEqual(f.root.read());
    expect(f.root.submit({ kind: 'acknowledge-tutorial', milestoneId: 'first-items' }))
      .toMatchObject({ status: 'rejected', reason: 'tutorial-already-acknowledged' });
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 1 });
  });
});
