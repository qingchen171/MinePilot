import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
  type BoardState,
} from '../../../../src/core/board';
import {
  CURRENT_SAVE_VERSION,
  loadSaveDocument,
} from '../../../../src/core/persistence/save-dispatcher';
import {
  serializeSaveDocumentV1,
  type SaveDocumentV1,
} from '../../../../src/core/persistence/save-v1';
import { migrateValidatedSaveDocumentV1ToV2 } from '../../../../src/core/persistence/save-v2';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingPosition,
  type RunPhase,
} from '../../../../src/core/run';

function activeBoard(): BoardState {
  return createBoard(createBoardDimensions({ width: 2, height: 1 }), [
    createCellState({
      terrain: 'playable',
      containsMine: false,
      explored: true,
      mineRevealed: false,
      flagged: false,
    }),
    createCellState({
      terrain: 'playable',
      containsMine: true,
      explored: false,
      mineRevealed: false,
      flagged: false,
    }),
  ]);
}

function wonBoard(): BoardState {
  return createBoard(createBoardDimensions({ width: 1, height: 1 }), [
    createCellState({
      terrain: 'playable',
      containsMine: false,
      explored: true,
      mineRevealed: false,
      flagged: false,
    }),
  ]);
}

function documentForPhase(phase: RunPhase): SaveDocumentV1 {
  const board = phase.kind === 'won' ? wonBoard() : activeBoard();
  const position = phase.kind === 'pending-mine-encounter'
    ? createWaitingPosition()
    : createOnBoardPosition(createCoordinate(0, 0));
  const serialized = serializeSaveDocumentV1({
    revision: 7,
    activeRun: {
      runId: 'run-001',
      levelId: 'level-001',
      run: createRunState(board, position, {
        hasTakenStep: true,
        phase,
      }),
    },
  });
  if (serialized.status !== 'serialized') {
    throw new Error('Expected a valid Save v1 test fixture.');
  }
  return serialized.document;
}

function clone(input: unknown): unknown {
  return structuredClone(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('Save version dispatcher', () => {
  it('loads a current v2 document without migration', () => {
    const document = migrateValidatedSaveDocumentV1ToV2(documentForPhase({ kind: 'active' }));
    const result = loadSaveDocument(document);

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') throw new Error('Expected current v2 load.');
    expect(result).toMatchObject({ saveVersion: 2, sourceSaveVersion: 2 });
    expect(result.document).toEqual(document);
  });

  it('loads a valid v1 document through the single read-only v1-to-v2 migration branch', () => {
    const document = documentForPhase({ kind: 'active' });
    const result = loadSaveDocument(document);

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') throw new Error('Expected a loaded Save.');
    expect(result.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(result.sourceSaveVersion).toBe(1);
    expect(result.document.saveVersion).toBe(2);
    expect(result.document.revision).toBe(document.revision);
    expect(result.activeRun?.gameState.run.phase).toEqual({ kind: 'active' });
    expect(result.account.inventory).toEqual({ lucky: 0, detection: 0, airplane: 0, revive: 0 });
    expect(result.activeRun?.gameState.runItems).toMatchObject({
      successfulDetectionUses: 0,
      successfulAirplaneUses: 0,
      successfulReviveUses: 0,
      detectionRandomSeed: null,
    });
  });

  it.each([
    ['active', { kind: 'active' }],
    [
      'pending mine encounter',
      {
        kind: 'pending-mine-encounter',
        encounter: { target: createCoordinate(1, 0), occurredOnFirstStep: true },
      },
    ],
    [
      'failed',
      {
        kind: 'failed',
        encounter: { target: createCoordinate(1, 0), occurredOnFirstStep: false },
      },
    ],
    ['won', { kind: 'won' }],
  ] as const)('preserves v1 %s semantics', (_description, phase) => {
    const result = loadSaveDocument(documentForPhase(phase));

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded' || result.activeRun === null) {
      throw new Error('Expected a loaded active Run.');
    }
    expect(result.activeRun.gameState.run.phase).toEqual(phase);
  });

  it.each([
    ['non-object input', null],
    ['array input', []],
    ['missing property', { revision: 0, activeRun: null }],
  ])('classifies %s as missing-version', (_description, input) => {
    expect(loadSaveDocument(input)).toEqual({ status: 'missing-version' });
  });

  it.each([
    ['string', '1'],
    ['null', null],
    ['boolean', true],
    ['object', { value: 1 }],
    ['array', [1]],
  ])('rejects a %s saveVersion as an invalid type', (_description, saveVersion) => {
    expect(loadSaveDocument({ saveVersion })).toEqual({
      status: 'invalid-version',
      reason: 'invalid-type',
    });
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['fractional', 1.5],
    ['negative', -1],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects a %s saveVersion as an invalid number', (_description, saveVersion) => {
    expect(loadSaveDocument({ saveVersion })).toEqual({
      status: 'invalid-version',
      reason: 'invalid-number',
    });
  });

  it('classifies a future version without attempting current validation', () => {
    expect(loadSaveDocument({ saveVersion: 3, futureField: true })).toEqual({
      status: 'unsupported-future-version',
      saveVersion: 3,
    });
  });

  it('classifies the only valid older version number without inventing a migration', () => {
    expect(loadSaveDocument({ saveVersion: 0, legacyField: true })).toEqual({
      status: 'unsupported-old-version',
      saveVersion: 0,
    });
  });

  it.each([
    [
      'invalid Board',
      (document: Record<string, unknown>) => {
        const activeRun = document.activeRun as Record<string, unknown>;
        const board = activeRun.board as Record<string, unknown>;
        const dimensions = board.dimensions as Record<string, unknown>;
        dimensions.width = 0;
      },
      { code: 'invalid-board', detail: 'invalid-dimensions' },
    ],
    [
      'inconsistent Run',
      (document: Record<string, unknown>) => {
        const activeRun = document.activeRun as Record<string, unknown>;
        activeRun.characterPosition = {
          kind: 'on-board',
          coordinate: { x: 1, y: 0 },
        };
      },
      { code: 'inconsistent-run', path: 'activeRun' },
    ],
    [
      'unknown v1 field',
      (document: Record<string, unknown>) => {
        document.futureField = true;
      },
      { code: 'unknown-field', path: '$.futureField' },
    ],
  ] as const)('preserves S2-02 issues for an invalid old v1 document with %s', (_description, mutate, issue) => {
    const input = clone(documentForPhase({ kind: 'active' }));
    if (!isRecord(input)) {
      throw new Error('Expected a document fixture.');
    }
    mutate(input);
    const result = loadSaveDocument(input);

    expect(result.status).toBe('invalid-old-version-document');
    if (result.status !== 'invalid-old-version-document') {
      throw new Error('Expected invalid old-version document.');
    }
    expect(result.issues[0]).toMatchObject(issue);
  });

  it('does not mutate the inspected input', () => {
    const input = clone(documentForPhase({ kind: 'active' }));
    const before = clone(input);

    loadSaveDocument(input);

    expect(input).toEqual(before);
  });

  it('keeps current v2 validation issues distinct from invalid legacy v1', () => {
    const input = {
      ...migrateValidatedSaveDocumentV1ToV2(documentForPhase({ kind: 'active' })),
      unexpected: true,
    };

    const result = loadSaveDocument(input);

    expect(result).toMatchObject({
      status: 'invalid-current-version-document',
      saveVersion: 2,
      issues: [{ code: 'unknown-field', path: '$.unexpected' }],
    });
  });
});
