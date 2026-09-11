import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccountState } from '../../src/core/account';
import { createBoard, createCellState } from '../../src/core/board';
import { createGameState } from '../../src/core/game-state';
import { createInitialRunItemState } from '../../src/core/run-item-state';
import { createRevealedMineOccupancyPosition, createRunState } from '../../src/core/run';
import { migrateOldSaveDocumentToV3, validateSaveDocumentV3 } from '../../src/core/persistence/save-v3';
import * as random from '../../src/core/random';
import { commitCandidateSaveV2, loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { MemoryStorage } from '../helpers/memory-storage';

afterEach(() => vi.restoreAllMocks());

describe('S4-04 pure target-v3 path does not switch persistence authority', () => {
  it('migrates committed occupancy with no writes, RNG, revision change or Runtime publication', () => {
    const board = createBoard({ width: 2, height: 1 }, [
      createCellState({ terrain: 'playable', containsMine: true, explored: false, mineRevealed: true, flagged: false }),
      createCellState({ terrain: 'playable', containsMine: false, explored: false, mineRevealed: false, flagged: true }),
    ]);
    const gameState = createGameState({
      account: createAccountState({ lucky: 2, detection: 1, airplane: 0, revive: 1 }),
      run: createRunState(board, createRevealedMineOccupancyPosition({ x: 0, y: 0 }), { hasTakenStep: true }),
      runItems: createInitialRunItemState(null),
    });
    const storage = new MemoryStorage();
    expect(commitCandidateSaveV2(storage, { revision: 8, activeRun: { runId: 'run', levelId: 'level', gameState } }).status).toBe('committed');
    const bytes = [...storage.data.entries()];
    const start = storage.operations.length;
    const rng = vi.spyOn(random, 'createSeededRandomSource');
    const loaded = loadPersistedSave(storage);
    if (!('save' in loaded)) throw new Error('Expected committed save');
    const migrated = migrateOldSaveDocumentToV3(loaded.save.document);
    expect(migrated).toMatchObject({ status: 'validated', document: { revision: 8, currentAttempt: { generationProvenance: null, runItems: { detectionRandomSeed: null }, run: { characterPosition: { kind: 'revealed-mine-occupancy', coordinate: { x: 0, y: 0 } }, hasTakenStep: true, phase: { kind: 'active' } } } } });
    if (migrated.status !== 'validated') throw new Error('Expected DTO');
    expect(validateSaveDocumentV3(migrated.document)).toEqual(migrated);
    expect(migrated).not.toHaveProperty('activeRun');
    expect(migrated).not.toHaveProperty('candidate');
    expect(rng).not.toHaveBeenCalled();
    expect([...storage.data.entries()]).toEqual(bytes);
    expect(storage.operations.slice(start).every((op) => op.startsWith('read:'))).toBe(true);
    const reopened = loadPersistedSave(storage);
    expect(reopened).toMatchObject({ revision: 8, save: { saveVersion: 2, sourceSaveVersion: 2, document: loaded.save.document } });
  });
});
