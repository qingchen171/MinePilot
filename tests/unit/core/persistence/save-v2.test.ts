import { describe, expect, it } from 'vitest';
import { createAccountState } from '../../../../src/core/account';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
} from '../../../../src/core/board';
import { createGameState } from '../../../../src/core/game-state';
import {
  serializeSaveDocumentV2,
  validateAndLoadSaveDocumentV2,
  type SaveDocumentPersistenceInputV2,
} from '../../../../src/core/persistence/save-v2';
import { createRunItemState } from '../../../../src/core/run-item-state';
import {
  createRevealedMineOccupancyPosition,
  createRunState,
} from '../../../../src/core/run';

function candidate(): SaveDocumentPersistenceInputV2 {
  const board = createBoard(createBoardDimensions({ width: 2, height: 1 }), [
    createCellState({
      terrain: 'playable', containsMine: false, explored: true,
      mineRevealed: false, flagged: false,
    }),
    createCellState({
      terrain: 'playable', containsMine: true, explored: false,
      mineRevealed: true, flagged: false,
    }),
  ]);
  return {
    revision: 8,
    activeRun: {
      runId: 'run-v2',
      levelId: 'level-v2',
      gameState: createGameState({
        account: createAccountState({ lucky: 4, detection: 3, airplane: 2, revive: 1 }),
        run: createRunState(
          board,
          createRevealedMineOccupancyPosition(createCoordinate(1, 0)),
          { hasTakenStep: true, phase: { kind: 'active' } },
        ),
        runItems: createRunItemState({
          successfulDetectionUses: 1,
          successfulAirplaneUses: 1,
          successfulReviveUses: 1,
          detectionRandomSeed: 987654321,
        }),
      }),
      generationProvenance: {
        seed: 123,
        rngVersion: 'mulberry32-v1',
        generationVersion: 'initial-board-v1',
      },
    },
  };
}

function serializedDocument() {
  const serialized = serializeSaveDocumentV2(candidate());
  if (serialized.status !== 'serialized') throw new Error('Expected a valid Save v2 fixture.');
  return serialized.document;
}

function mutableRecord(input: unknown): Record<string, unknown> {
  const cloned: unknown = structuredClone(input);
  if (typeof cloned !== 'object' || cloned === null || Array.isArray(cloned)) {
    throw new Error('Expected a record fixture.');
  }
  return cloned as Record<string, unknown>;
}

describe('Save v2 DTO and explicit runtime mapping', () => {
  it('persists Account authority even when there is no active Run', () => {
    const serialized = serializeSaveDocumentV2({
      revision: 3,
      account: createAccountState({ lucky: 5, detection: 4, airplane: 3, revive: 2 }),
      activeRun: null,
    });

    expect(serialized).toMatchObject({
      status: 'serialized',
      document: {
        saveVersion: 2,
        revision: 3,
        account: { inventory: { lucky: 5, detection: 4, airplane: 3, revive: 2 } },
        activeRun: null,
      },
    });
    if (serialized.status !== 'serialized') throw new Error('Expected inactive v2 Save.');
    expect(validateAndLoadSaveDocumentV2(serialized.document)).toMatchObject({
      status: 'loaded',
      account: { inventory: { lucky: 5, detection: 4, airplane: 3, revive: 2 } },
      activeRun: null,
    });
  });

  it('maps current Account, Run, RunItem, and occupancy facts into an explicit v2 DTO', () => {
    const document = serializedDocument();

    expect(document).toMatchObject({
      saveVersion: 2,
      revision: 8,
      account: { inventory: { lucky: 4, detection: 3, airplane: 2, revive: 1 } },
      activeRun: {
        runId: 'run-v2',
        levelId: 'level-v2',
        characterPosition: {
          kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 },
        },
        runItems: {
          successfulDetectionUses: 1,
          successfulAirplaneUses: 1,
          successfulReviveUses: 1,
          detectionRandomSeed: 987654321,
        },
      },
    });
    expect(JSON.stringify(document)).not.toContain('gameState');
  });

  it('strictly validates and reconstructs occupancy through authoritative runtime constructors', () => {
    const loaded = validateAndLoadSaveDocumentV2(serializedDocument());

    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded' || loaded.activeRun === null) {
      throw new Error('Expected a loaded Save v2 active Run.');
    }
    expect(loaded.activeRun.gameState.run.characterPosition).toEqual({
      kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 },
    });
    expect(loaded.activeRun.gameState.runItems.detectionRandomSeed).toBe(987654321);
    expect(loaded.activeRun.gameState.account.inventory.lucky).toBe(4);
    expect(Object.isFrozen(loaded.activeRun.gameState)).toBe(true);
  });

  it('keeps null Detection provenance explicitly unknown across v2 round-trip', () => {
    const input = candidate();
    if (input.activeRun === null) throw new Error('Expected active fixture.');
    const unknownSeedCandidate: SaveDocumentPersistenceInputV2 = {
      revision: input.revision,
      activeRun: {
        ...input.activeRun,
        gameState: createGameState({
          ...input.activeRun.gameState,
          runItems: createRunItemState({
            ...input.activeRun.gameState.runItems,
            detectionRandomSeed: null,
          }),
        }),
      },
    };
    const serialized = serializeSaveDocumentV2(unknownSeedCandidate);
    expect(serialized.status).toBe('serialized');
    if (serialized.status !== 'serialized') throw new Error('Expected null seed serialization.');
    expect(serialized.document.activeRun?.runItems.detectionRandomSeed).toBeNull();

    const loaded = validateAndLoadSaveDocumentV2(serialized.document);
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded' || loaded.activeRun === null) throw new Error('Expected load.');
    expect(loaded.activeRun.gameState.runItems.detectionRandomSeed).toBeNull();
  });

  it('does not alias Runtime, DTO, or reconstructed Runtime objects', () => {
    const input = candidate();
    if (input.activeRun === null) throw new Error('Expected active fixture.');
    const originalGameState = input.activeRun.gameState;
    const serialized = serializeSaveDocumentV2(input);
    if (serialized.status !== 'serialized' || serialized.document.activeRun === null) {
      throw new Error('Expected serialization.');
    }
    const dtoAccount = serialized.document.account as { inventory: { lucky: number } };
    const dtoActiveRun = serialized.document.activeRun as {
      runItems: { successfulDetectionUses: number };
    };
    dtoAccount.inventory.lucky = 999;
    dtoActiveRun.runItems.successfulDetectionUses = 2;
    expect(originalGameState.account.inventory.lucky).toBe(4);
    expect(originalGameState.runItems.successfulDetectionUses).toBe(1);

    const loadInput = serializedDocument();
    const loaded = validateAndLoadSaveDocumentV2(loadInput);
    if (loaded.status !== 'loaded' || loaded.activeRun === null) throw new Error('Expected load.');
    const reconstructed = loaded.activeRun.gameState;
    expect(reconstructed).not.toBe(originalGameState);
    expect(reconstructed.account).not.toBe(originalGameState.account);
    expect(reconstructed.run).not.toBe(originalGameState.run);
    expect(reconstructed.runItems).not.toBe(originalGameState.runItems);

    const loadAccount = loadInput.account as { inventory: { lucky: number } };
    const loadActiveRun = loadInput.activeRun as {
      runItems: { successfulDetectionUses: number };
    };
    loadAccount.inventory.lucky = 111;
    loadActiveRun.runItems.successfulDetectionUses = 0;
    expect(reconstructed.account.inventory.lucky).toBe(4);
    expect(reconstructed.runItems.successfulDetectionUses).toBe(1);
  });

  it.each([
    ['top-level unknown field', (document: Record<string, unknown>) => { document.future = true; }, 'unknown-field'],
    ['account unknown field', (document: Record<string, unknown>) => {
      (document.account as Record<string, unknown>).coins = 5;
    }, 'unknown-field'],
    ['invalid inventory', (document: Record<string, unknown>) => {
      ((document.account as Record<string, unknown>).inventory as Record<string, unknown>).lucky = -1;
    }, 'invalid-inventory'],
    ['run-items unknown field', (document: Record<string, unknown>) => {
      const active = document.activeRun as Record<string, unknown>;
      (active.runItems as Record<string, unknown>).futureCounter = 1;
    }, 'unknown-field'],
    ['invalid run-items', (document: Record<string, unknown>) => {
      const active = document.activeRun as Record<string, unknown>;
      (active.runItems as Record<string, unknown>).successfulDetectionUses = 3;
    }, 'invalid-run-items'],
    ['occupancy on non-revealed Mine', (document: Record<string, unknown>) => {
      const active = document.activeRun as Record<string, unknown>;
      const board = active.board as Record<string, unknown>;
      const cells = board.cells as Record<string, unknown>[];
      cells[1].mineRevealed = false;
    }, 'inconsistent-run'],
  ] as const)('rejects %s without constructing a competing Runtime truth', (_name, mutate, code) => {
    const document = mutableRecord(serializedDocument());
    mutate(document);

    const loaded = validateAndLoadSaveDocumentV2(document);
    expect(loaded.status).toBe('invalid');
    if (loaded.status !== 'invalid') throw new Error('Expected invalid Save v2.');
    expect(loaded.issues[0]?.code).toBe(code);
  });

  it('does not mutate external v2 input during validation', () => {
    const input = structuredClone(serializedDocument());
    const before = structuredClone(input);

    validateAndLoadSaveDocumentV2(input);

    expect(input).toEqual(before);
  });
});
