import { describe, expect, it } from 'vitest';
import { createCoordinate, getCellAt, type BoardState } from '../../../src/core/board';
import {
  createInitialBoard,
  type CreateInitialBoardResult,
  type InitialBoardInput,
} from '../../../src/core/initial-board';
import { selectMineCoordinates } from '../../../src/core/mine-placement';
import { createSeededRandomSource } from '../../../src/core/random';

function input(overrides: Partial<InitialBoardInput> = {}): InitialBoardInput {
  return {
    dimensions: { width: 3, height: 2 },
    obstacleCoordinates: [],
    mineCoordinates: [],
    ...overrides,
  };
}

function createdBoard(result: CreateInitialBoardResult): BoardState {
  if (result.status !== 'created') throw new Error('Expected an initial Board.');
  return result.board;
}

describe('initial Board assembly', () => {
  it('constructs safe, hidden-mine, and obstacle facts in row-major order', () => {
    const board = createdBoard(
      createInitialBoard(input({
        obstacleCoordinates: [createCoordinate(1, 0), createCoordinate(0, 1)],
        mineCoordinates: [createCoordinate(2, 0), createCoordinate(1, 1)],
      })),
    );

    expect(board.cells).toHaveLength(6);
    expect(board.cells).toEqual([
      { kind: 'safe', exploration: 'unexplored', flagged: false },
      { kind: 'obstacle' },
      { kind: 'mine', revelation: 'hidden', flagged: false },
      { kind: 'obstacle' },
      { kind: 'mine', revelation: 'hidden', flagged: false },
      { kind: 'safe', exploration: 'unexplored', flagged: false },
    ]);
  });

  it('initializes every Cell without explored, flagged, or revealed-mine state', () => {
    const board = createdBoard(
      createInitialBoard(input({
        obstacleCoordinates: [createCoordinate(0, 0)],
        mineCoordinates: [createCoordinate(1, 0)],
      })),
    );

    expect(board.cells.some((cell) => cell.kind === 'safe' && cell.exploration === 'explored')).toBe(false);
    expect(board.cells.some((cell) => cell.kind !== 'obstacle' && cell.flagged)).toBe(false);
    expect(board.cells.some((cell) => cell.kind === 'mine' && cell.revelation === 'revealed')).toBe(false);
  });

  it.each([
    [{ width: 0, height: 1 }],
    [{ width: 1, height: -1 }],
    [{ width: 1.5, height: 1 }],
    [{ width: Number.POSITIVE_INFINITY, height: 1 }],
  ])('rejects invalid dimensions %j', (dimensions) => {
    expect(createInitialBoard(input({ dimensions }))).toEqual({
      status: 'invalid',
      reason: 'invalid-dimensions',
    });
  });

  it('rejects a duplicate obstacle coordinate without deduplicating it', () => {
    const coordinate = createCoordinate(1, 1);

    expect(createInitialBoard(input({ obstacleCoordinates: [coordinate, coordinate] }))).toEqual({
      status: 'invalid',
      reason: 'duplicate-obstacle-coordinate',
      coordinateIndex: 1,
    });
  });

  it('rejects a duplicate mine coordinate without deduplicating it', () => {
    const coordinate = createCoordinate(1, 1);

    expect(createInitialBoard(input({ mineCoordinates: [coordinate, coordinate] }))).toEqual({
      status: 'invalid',
      reason: 'duplicate-mine-coordinate',
      coordinateIndex: 1,
    });
  });

  it.each([
    ['obstacle', 'obstacleCoordinates', { x: 3, y: 0 }, 'invalid-obstacle-coordinate'],
    ['obstacle', 'obstacleCoordinates', { x: -1, y: 0 }, 'invalid-obstacle-coordinate'],
    ['mine', 'mineCoordinates', { x: 0, y: 2 }, 'invalid-mine-coordinate'],
    ['mine', 'mineCoordinates', { x: 0.5, y: 0 }, 'invalid-mine-coordinate'],
  ] as const)('rejects an invalid %s coordinate', (_label, field, coordinate, reason) => {
    expect(createInitialBoard(input({ [field]: [coordinate] }))).toEqual({
      status: 'invalid',
      reason,
      coordinateIndex: 0,
    });
  });

  it('rejects a coordinate shared by a Mine and an Obstacle', () => {
    const coordinate = createCoordinate(2, 1);

    expect(createInitialBoard(input({
      obstacleCoordinates: [coordinate],
      mineCoordinates: [coordinate],
    }))).toEqual({
      status: 'invalid',
      reason: 'mine-obstacle-overlap',
      coordinateIndex: 0,
    });
  });

  it('allows zero Mines and zero Obstacles', () => {
    const board = createdBoard(createInitialBoard(input()));

    expect(board.cells.every((cell) => cell.kind === 'safe')).toBe(true);
  });

  it.each([
    ['safe', [], [], { kind: 'safe', exploration: 'unexplored', flagged: false }],
    ['mine', [], [createCoordinate(0, 0)], { kind: 'mine', revelation: 'hidden', flagged: false }],
    ['obstacle', [createCoordinate(0, 0)], [], { kind: 'obstacle' }],
  ] as const)('allows a 1 by 1 %s Board', (_label, obstacles, mines, expected) => {
    const board = createdBoard(createInitialBoard(input({
      dimensions: { width: 1, height: 1 },
      obstacleCoordinates: obstacles,
      mineCoordinates: mines,
    })));

    expect(board.cells).toEqual([expected]);
  });

  it('allows an all-Obstacle Board as a structurally valid extreme', () => {
    const obstacles = [
      createCoordinate(0, 0),
      createCoordinate(1, 0),
      createCoordinate(0, 1),
      createCoordinate(1, 1),
    ];
    const board = createdBoard(createInitialBoard(input({
      dimensions: { width: 2, height: 2 },
      obstacleCoordinates: obstacles,
    })));

    expect(board.cells).toEqual(Array.from({ length: 4 }, () => ({ kind: 'obstacle' })));
  });

  it('produces identical Board facts regardless of coordinate input order', () => {
    const obstacles = [createCoordinate(2, 1), createCoordinate(0, 0)];
    const mines = [createCoordinate(1, 1), createCoordinate(2, 0)];
    const first = createdBoard(createInitialBoard(input({ obstacleCoordinates: obstacles, mineCoordinates: mines })));
    const second = createdBoard(createInitialBoard(input({
      obstacleCoordinates: [...obstacles].reverse(),
      mineCoordinates: [...mines].reverse(),
    })));

    expect(first).toEqual(second);
  });

  it('does not mutate input arrays or coordinate objects', () => {
    const obstacle = { x: 0, y: 0 };
    const mine = { x: 1, y: 0 };
    const dimensions = { width: 3, height: 2 };
    const obstacleCoordinates = [obstacle];
    const mineCoordinates = [mine];
    const source = input({ dimensions, obstacleCoordinates, mineCoordinates });
    const snapshot = structuredClone(source);

    const board = createdBoard(createInitialBoard(source));
    expect(source).toEqual(snapshot);

    dimensions.width = 1;
    obstacle.x = 2;
    mine.x = 2;
    obstacleCoordinates.push({ x: 2, y: 1 });
    mineCoordinates.length = 0;

    expect(snapshot).toEqual({
      dimensions: { width: 3, height: 2 },
      obstacleCoordinates: [{ x: 0, y: 0 }],
      mineCoordinates: [{ x: 1, y: 0 }],
    });
    expect(getCellAt(board, { x: 0, y: 0 })).toEqual({ kind: 'obstacle' });
    expect(getCellAt(board, { x: 1, y: 0 })).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: false,
    });
    expect(board.dimensions).toEqual({ width: 3, height: 2 });
  });

  it('composes S1-09 selected coordinates into matching initial Mine facts', () => {
    const candidates = [
      createCoordinate(0, 0),
      createCoordinate(1, 0),
      createCoordinate(2, 0),
      createCoordinate(0, 1),
      createCoordinate(1, 1),
      createCoordinate(2, 1),
    ];
    const placement = selectMineCoordinates(candidates, 3, createSeededRandomSource(123));
    if (placement.status !== 'selected') throw new Error('Expected selected coordinates.');

    const board = createdBoard(createInitialBoard(input({ mineCoordinates: placement.coordinates })));
    const mineKeys = new Set(placement.coordinates.map(({ x, y }) => `${x},${y}`));

    for (let y = 0; y < board.dimensions.height; y += 1) {
      for (let x = 0; x < board.dimensions.width; x += 1) {
        expect(getCellAt(board, { x, y })?.kind).toBe(mineKeys.has(`${x},${y}`) ? 'mine' : 'safe');
      }
    }
  });
});
