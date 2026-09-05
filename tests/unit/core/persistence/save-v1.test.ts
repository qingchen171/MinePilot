import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
  getCellAt,
  type BoardState,
  type CellState,
} from '../../../../src/core/board';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingPosition,
  type RunState,
} from '../../../../src/core/run';
import {
  serializeSaveDocumentV1,
  validateAndLoadSaveDocumentV1,
  type SaveDocumentV1,
  type ValidateAndLoadSaveDocumentV1Result,
} from '../../../../src/core/persistence/save-v1';

const safe = (explored = false, flagged = false): CellState =>
  createCellState({
    terrain: 'playable',
    containsMine: false,
    explored,
    mineRevealed: false,
    flagged,
  });

const mine = (revealed = false, flagged = false): CellState =>
  createCellState({
    terrain: 'playable',
    containsMine: true,
    explored: false,
    mineRevealed: revealed,
    flagged,
  });

const obstacle = (): CellState =>
  createCellState({
    terrain: 'obstacle',
    containsMine: false,
    explored: false,
    mineRevealed: false,
    flagged: false,
  });

function completeFactsBoard(): BoardState {
  return createBoard(
    createBoardDimensions({ width: 7, height: 1 }),
    [safe(), safe(true), safe(false, true), mine(), mine(false, true), mine(true), obstacle()],
  );
}

function wonBoard(): BoardState {
  return createBoard(
    createBoardDimensions({ width: 3, height: 1 }),
    [safe(true), mine(), obstacle()],
  );
}

function serializeRun(run: RunState): SaveDocumentV1 {
  const result = serializeSaveDocumentV1({
    revision: 7,
    activeRun: {
      runId: 'run-001',
      levelId: 'level-001',
      run,
      generationProvenance: {
        seed: 123456789,
        rngVersion: 'mulberry32-rejection-v1',
        generationVersion: 'initial-board-v1',
      },
    },
  });
  if (result.status !== 'serialized') throw new Error('Expected Save v1 serialization.');
  return result.document;
}

function loadedRun(result: ValidateAndLoadSaveDocumentV1Result): RunState {
  if (result.status !== 'loaded' || result.activeRun === null) {
    throw new Error('Expected a loaded active Run.');
  }
  return result.activeRun.run;
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Expected a record fixture.');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected an array fixture.');
  return value;
}

function clone(input: unknown): unknown {
  return JSON.parse(JSON.stringify(input));
}

function activeRunRecord(document: unknown): Record<string, unknown> {
  return record(record(document).activeRun);
}

function boardRecord(document: unknown): Record<string, unknown> {
  return record(activeRunRecord(document).board);
}

function cellRecord(document: unknown, index: number): Record<string, unknown> {
  return record(array(boardRecord(document).cells)[index]);
}

function expectInvalid(
  input: unknown,
  code: string,
  path?: string,
): void {
  const result = validateAndLoadSaveDocumentV1(input);
  expect(result.status).toBe('invalid');
  if (result.status !== 'invalid') throw new Error('Expected invalid Save v1 input.');
  expect(result.issues[0]).toMatchObject(path === undefined ? { code } : { code, path });
}

describe('Save v1 pure DTO boundary', () => {
  it('serializes every frozen Board Cell fact explicitly in row-major order', () => {
    const document = serializeRun(
      createRunState(completeFactsBoard(), createOnBoardPosition(createCoordinate(1, 0))),
    );

    expect(document.activeRun?.board).toEqual({
      dimensions: { width: 7, height: 1 },
      cells: [
        { terrain: 'playable', containsMine: false, explored: false, mineRevealed: false, flagged: false },
        { terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false },
        { terrain: 'playable', containsMine: false, explored: false, mineRevealed: false, flagged: true },
        { terrain: 'playable', containsMine: true, explored: false, mineRevealed: false, flagged: false },
        { terrain: 'playable', containsMine: true, explored: false, mineRevealed: false, flagged: true },
        { terrain: 'playable', containsMine: true, explored: false, mineRevealed: true, flagged: false },
        { terrain: 'obstacle', containsMine: false, explored: false, mineRevealed: false, flagged: false },
      ],
    });
    expect(Object.keys(document.activeRun?.board.cells[0] ?? {})).not.toContain('mineCount');
  });

  it('supports a versioned document with no active Run', () => {
    const serialized = serializeSaveDocumentV1({ revision: 0, activeRun: null });
    expect(serialized).toEqual({
      status: 'serialized',
      document: { saveVersion: 1, revision: 0, activeRun: null },
    });
    expect(validateAndLoadSaveDocumentV1({ saveVersion: 1, revision: 0, activeRun: null })).toEqual({
      status: 'loaded',
      document: { saveVersion: 1, revision: 0, activeRun: null },
      activeRun: null,
    });
  });

  it.each([
    [
      'waiting active',
      createRunState(completeFactsBoard(), createWaitingPosition(), {
        hasTakenStep: false,
        phase: { kind: 'active' },
      }),
    ],
    [
      'on-board active',
      createRunState(completeFactsBoard(), createOnBoardPosition(createCoordinate(1, 0))),
    ],
    [
      'pending first-step encounter',
      createRunState(completeFactsBoard(), createWaitingPosition(), {
        hasTakenStep: true,
        phase: {
          kind: 'pending-mine-encounter',
          encounter: { target: createCoordinate(3, 0), occurredOnFirstStep: true },
        },
      }),
    ],
    [
      'failed later encounter',
      createRunState(completeFactsBoard(), createOnBoardPosition(createCoordinate(1, 0)), {
        hasTakenStep: true,
        phase: {
          kind: 'failed',
          encounter: { target: createCoordinate(3, 0), occurredOnFirstStep: false },
        },
      }),
    ],
    [
      'won',
      createRunState(wonBoard(), createOnBoardPosition(createCoordinate(0, 0)), {
        phase: { kind: 'won' },
      }),
    ],
  ] as const)('round-trips authoritative facts for a %s Run', (_description, run) => {
    const document = serializeRun(run);
    const result = validateAndLoadSaveDocumentV1(clone(document));

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded' || result.activeRun === null) {
      throw new Error('Expected a loaded active Run.');
    }
    expect(result.document).toEqual(document);
    expect(result.activeRun).toMatchObject({
      runId: 'run-001',
      levelId: 'level-001',
      generationProvenance: {
        seed: 123456789,
        rngVersion: 'mulberry32-rejection-v1',
        generationVersion: 'initial-board-v1',
      },
    });
    expect(result.activeRun.run).toEqual(run);
    expect(result.activeRun.run).not.toBe(run);
    expect(result.activeRun.run.board).not.toBe(run.board);
  });

  it('does not alias Runtime state into the serialized DTO', () => {
    const run = createRunState(
      completeFactsBoard(),
      createOnBoardPosition(createCoordinate(1, 0)),
    );
    const document = serializeRun(run);
    cellRecord(document, 0).explored = true;
    activeRunRecord(document).runId = 'mutated';

    expect(getCellAt(run.board, createCoordinate(0, 0))).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });
  });

  it('does not alias unknown input into reconstructed authoritative state', () => {
    const input = clone(
      serializeRun(
        createRunState(completeFactsBoard(), createOnBoardPosition(createCoordinate(1, 0))),
      ),
    );
    const result = validateAndLoadSaveDocumentV1(input);
    const run = loadedRun(result);
    cellRecord(input, 1).explored = false;
    record(activeRunRecord(input).characterPosition).kind = 'waiting';

    expect(getCellAt(run.board, createCoordinate(1, 0))).toEqual({
      kind: 'safe',
      exploration: 'explored',
      flagged: false,
    });
    expect(run.characterPosition).toEqual({
      kind: 'on-board',
      coordinate: { x: 1, y: 0 },
    });
    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.board)).toBe(true);
    expect(Object.isFrozen(run.board.cells)).toBe(true);
    expect(Object.isFrozen(run.characterPosition)).toBe(true);
    expect(Object.isFrozen(run.phase)).toBe(true);
  });

  it.each([
    ['non-object', null, 'invalid-input', '$'],
    ['array', [], 'invalid-input', '$'],
    ['missing saveVersion', { revision: 0, activeRun: null }, 'invalid-input', '$.saveVersion'],
    ['wrong saveVersion', { saveVersion: 2, revision: 0, activeRun: null }, 'invalid-save-version', '$.saveVersion'],
    ['negative revision', { saveVersion: 1, revision: -1, activeRun: null }, 'invalid-revision', '$.revision'],
    ['fractional revision', { saveVersion: 1, revision: 1.5, activeRun: null }, 'invalid-revision', '$.revision'],
    ['invalid activeRun', { saveVersion: 1, revision: 0, activeRun: [] }, 'invalid-active-run', 'activeRun'],
  ])('rejects %s', (_description, input, code, path) => {
    expectInvalid(input, code, path);
  });

  it('strictly rejects unknown fields at every Save v1 boundary', () => {
    const topLevel = clone(serializeRun(createRunState(completeFactsBoard(), createWaitingPosition())));
    record(topLevel).futureField = true;
    expectInvalid(topLevel, 'unknown-field', '$.futureField');

    const activeRun = clone(serializeRun(createRunState(completeFactsBoard(), createWaitingPosition())));
    activeRunRecord(activeRun).inventory = [];
    expectInvalid(activeRun, 'unknown-field', 'activeRun.inventory');

    const cell = clone(serializeRun(createRunState(completeFactsBoard(), createWaitingPosition())));
    cellRecord(cell, 0).displayNumber = 0;
    expectInvalid(cell, 'unknown-field', 'activeRun.board.cells[0].displayNumber');
  });

  it.each([
    ['empty runId', (document: unknown) => { activeRunRecord(document).runId = ' '; }, 'invalid-run-id', 'activeRun.runId'],
    ['empty levelId', (document: unknown) => { activeRunRecord(document).levelId = ''; }, 'invalid-level-id', 'activeRun.levelId'],
    ['non-boolean hasTakenStep', (document: unknown) => { activeRunRecord(document).hasTakenStep = 1; }, 'invalid-has-taken-step', 'activeRun.hasTakenStep'],
    ['invalid position kind', (document: unknown) => { record(activeRunRecord(document).characterPosition).kind = 'mine'; }, 'invalid-character-position', 'activeRun.characterPosition.kind'],
    ['invalid position coordinate', (document: unknown) => { record(record(activeRunRecord(document).characterPosition).coordinate).x = -1; }, 'invalid-coordinate', 'activeRun.characterPosition.coordinate'],
    ['invalid phase kind', (document: unknown) => { record(activeRunRecord(document).phase).kind = 'paused'; }, 'invalid-phase', 'activeRun.phase.kind'],
  ] as const)('rejects %s', (_description, mutate, code, path) => {
    const document = clone(
      serializeRun(
        createRunState(completeFactsBoard(), createOnBoardPosition(createCoordinate(1, 0))),
      ),
    );
    mutate(document);
    expectInvalid(document, code, path);
  });

  it.each([
    ['invalid dimensions', (document: unknown) => { record(boardRecord(document).dimensions).width = 0; }, 'invalid-dimensions'],
    ['wrong cell count', (document: unknown) => { array(boardRecord(document).cells).pop(); }, 'invalid-cell-count'],
    ['illegal Cell facts', (document: unknown) => { cellRecord(document, 6).containsMine = true; }, 'invalid-cell-state'],
  ] as const)('delegates %s rejection to the Stage 1 Board validator', (_description, mutate, detail) => {
    const document = clone(serializeRun(createRunState(completeFactsBoard(), createWaitingPosition())));
    mutate(document);
    const result = validateAndLoadSaveDocumentV1(document);
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') throw new Error('Expected invalid Board input.');
    expect(result.issues[0]).toMatchObject({ code: 'invalid-board', detail });
  });

  it.each([
    ['unexplored Safe', createCoordinate(0, 0)],
    ['Hidden Mine', createCoordinate(3, 0)],
    ['Obstacle', createCoordinate(6, 0)],
  ] as const)('rejects on-board position pointing to %s', (_description, coordinate) => {
    const document = clone(
      serializeRun(
        createRunState(completeFactsBoard(), createOnBoardPosition(createCoordinate(1, 0))),
      ),
    );
    record(activeRunRecord(document).characterPosition).coordinate = {
      x: coordinate.x,
      y: coordinate.y,
    };
    expectInvalid(document, 'inconsistent-run', 'activeRun');
  });

  it('rejects an out-of-bounds on-board coordinate', () => {
    const document = clone(
      serializeRun(
        createRunState(completeFactsBoard(), createOnBoardPosition(createCoordinate(1, 0))),
      ),
    );
    record(activeRunRecord(document).characterPosition).coordinate = { x: 7, y: 0 };
    expectInvalid(document, 'inconsistent-run', 'activeRun');
  });

  it.each([
    ['Safe', createCoordinate(0, 0)],
    ['flagged Mine', createCoordinate(4, 0)],
  ] as const)('rejects a pending encounter pointing to %s', (_description, target) => {
    const pending = createRunState(completeFactsBoard(), createWaitingPosition(), {
      hasTakenStep: true,
      phase: {
        kind: 'pending-mine-encounter',
        encounter: { target: createCoordinate(3, 0), occurredOnFirstStep: true },
      },
    });
    const document = clone(serializeRun(pending));
    const phase = record(activeRunRecord(document).phase);
    record(record(phase.encounter).target).x = target.x;
    expectInvalid(document, 'inconsistent-run', 'activeRun');
  });

  it('rejects invalid encounter coordinates and occurredOnFirstStep types', () => {
    const pending = createRunState(completeFactsBoard(), createWaitingPosition(), {
      hasTakenStep: true,
      phase: {
        kind: 'pending-mine-encounter',
        encounter: { target: createCoordinate(3, 0), occurredOnFirstStep: true },
      },
    });
    const invalidCoordinate = clone(serializeRun(pending));
    record(record(record(activeRunRecord(invalidCoordinate).phase).encounter).target).x = -1;
    expectInvalid(invalidCoordinate, 'invalid-coordinate', 'activeRun.phase.encounter.target');

    const invalidFirstStep = clone(serializeRun(pending));
    record(record(activeRunRecord(invalidFirstStep).phase).encounter).occurredOnFirstStep = 'yes';
    expectInvalid(
      invalidFirstStep,
      'invalid-encounter',
      'activeRun.phase.encounter.occurredOnFirstStep',
    );
  });

  it('rejects won when required Safe Cells remain unexplored', () => {
    const document = clone(serializeRun(createRunState(completeFactsBoard(), createWaitingPosition())));
    record(activeRunRecord(document).phase).kind = 'won';
    expectInvalid(document, 'inconsistent-run', 'activeRun');
  });

  it.each([
    ['invalid seed', (provenance: Record<string, unknown>) => { provenance.seed = 0x1_0000_0000; }, 'seed'],
    ['invalid RNG version', (provenance: Record<string, unknown>) => { provenance.rngVersion = ''; }, 'rngVersion'],
    ['invalid generation version', (provenance: Record<string, unknown>) => { provenance.generationVersion = 1; }, 'generationVersion'],
  ] as const)('rejects %s provenance', (_description, mutate, field) => {
    const document = clone(serializeRun(createRunState(completeFactsBoard(), createWaitingPosition())));
    mutate(record(activeRunRecord(document).generationProvenance));
    expectInvalid(document, 'invalid-provenance', `activeRun.generationProvenance.${field}`);
  });

  it('returns structured issues when typed persistence metadata is invalid at runtime', () => {
    const run = createRunState(completeFactsBoard(), createWaitingPosition());
    expect(serializeSaveDocumentV1({ revision: -1, activeRun: null })).toEqual({
      status: 'invalid',
      issues: [{ code: 'invalid-revision', path: '$.revision' }],
    });
    const result = serializeSaveDocumentV1({
      revision: 0,
      activeRun: { runId: '', levelId: 'level-001', run },
    });
    expect(result).toEqual({
      status: 'invalid',
      issues: [{ code: 'invalid-run-id', path: 'activeRun.runId' }],
    });
  });
});
