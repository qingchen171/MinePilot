import { describe, expect, it } from 'vitest';
import { createPresentationRoot } from '../../src/presentation-root';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from '../helpers/memory-storage';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

const owner = { sessionId: 'board-presentation', leaseToken: 'board-presentation-token' };
const clock = { nowMs: () => 100 };
const facts = { nextRunId: () => 'board-presentation-run', nextGenerationSeed: () => 123456789,
  nextDetectionSeed: () => 47 };

function fixture() {
  const storage = new MemoryStorage();
  const session = createProductionStage4Session(storage, owner, clock);
  const root = createPresentationRoot(session, facts);
  expect(root.submit({ kind: 'start', levelId: 'level-001' }).status).toBe('committed');
  const read = session.read();
  if (read.status !== 'loaded' || read.runtime.currentAttempt === null) throw new Error('attempt fixture');
  return { storage, session, root, attempt: read.runtime.currentAttempt };
}

describe('S5-06 public board through the real guarded production session', () => {
  it.each(['pending', 'failed', 'won', 'occupancy', 'zero', 'number'] as const)(
    'constructs a valid committed %s browser scenario without production test hooks', (variant) => {
      const fixture = boardBrowserSave(variant);
      const storage = new MemoryStorage();
      for (const [key, value] of fixture.entries) storage.data.set(key, value);
      const root = createPresentationRoot(createProductionStage4Session(storage, owner, clock), facts);
      expect(root.read()).toMatchObject({ status: 'loaded', view: { attempt: { board: { width: 9, height: 9 } } } });
    },
  );
  it('submits a real public target, commits Save v4, and reconstructs exactly on reopen', () => {
    const f = fixture();
    const cells = f.attempt.run.board.cells;
    const width = f.attempt.run.board.dimensions.width;
    const safeIndex = cells.findIndex((cell) => cell.kind === 'safe');
    const flagIndex = cells.findIndex((cell, index) => index !== safeIndex && cell.kind !== 'obstacle');
    const safe = { x: safeIndex % width, y: Math.floor(safeIndex / width) };
    const flag = { x: flagIndex % width, y: Math.floor(flagIndex / width) };
    expect(f.root.submit({ kind: 'flag', coordinate: flag, flagged: true }).status).toBe('committed');
    const moved = f.root.submit({ kind: 'move', coordinate: safe });
    expect(moved).toMatchObject({ status: 'committed', snapshot: { status: 'loaded', view: {
      attempt: { position: { kind: 'on-board', x: safe.x, y: safe.y } },
    } } });
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 2 });
    const view = f.root.read();
    expect(view.status).toBe('loaded');
    if (view.status !== 'loaded') return;
    expect(view.view.attempt?.board.cells[flagIndex]).toBe('flagged');
    expect(view.view.attempt?.board.cells[safeIndex]).toBe('explored');
    const reopened = createPresentationRoot(createProductionStage4Session(f.storage, owner, clock), facts).read();
    expect(reopened).toEqual(view);
    expect(JSON.stringify(view)).not.toContain('board-presentation-run');
    expect(JSON.stringify(view)).not.toContain('123456789');
  });

  it('never reprojects a failed candidate as committed movement or a false number', () => {
    const f = fixture();
    const before = f.root.read();
    const safeIndex = f.attempt.run.board.cells.findIndex((cell) => cell.kind === 'safe');
    const width = f.attempt.run.board.dimensions.width;
    f.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);
    const result = f.root.submit({ kind: 'move', coordinate: {
      x: safeIndex % width, y: Math.floor(safeIndex / width),
    } });
    expect(result).toMatchObject({ status: 'rejected', reason: 'commit-persistence-commit-failure' });
    expect(f.root.read()).toEqual(before);
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 0 });
  });
});
