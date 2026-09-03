import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
  getCellAt,
  type BoardState,
  type Coordinate,
} from '../../src/core/board';
import { getCurrentCellMineCount } from '../../src/core/current-cell-mine-count';
import { settleMineEncounterAsFailure } from '../../src/core/encounter';
import { createInitialBoard } from '../../src/core/initial-board';
import { selectMineCoordinates } from '../../src/core/mine-placement';
import { moveCharacter, type MoveCharacterResult } from '../../src/core/movement';
import { createSeededRandomSource } from '../../src/core/random';
import { setRunFlagged, type RunFlagTransitionResult } from '../../src/core/run-flag';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingRunState,
  type RunState,
} from '../../src/core/run';
import { areAllRequiredSafeCellsExplored } from '../../src/core/victory';

function createdBoard(result: ReturnType<typeof createInitialBoard>): BoardState {
  if (result.status !== 'created') throw new Error(`Expected a created Board, got ${result.reason}.`);
  return result.board;
}

function movedState(result: MoveCharacterResult): RunState {
  if (result.outcome !== 'moved') throw new Error(`Expected movement, got ${result.outcome}.`);
  return result.state;
}

function changedFlagState(result: RunFlagTransitionResult): RunState {
  if (result.outcome !== 'changed') throw new Error(`Expected a Flag change, got ${result.outcome}.`);
  return result.state;
}

function coordinateKeys(coordinates: readonly Coordinate[]): string[] {
  return coordinates.map(({ x, y }) => `${x},${y}`);
}

describe('Stage 1 core lifecycle integration', () => {
  it('completes the baseline Failure lifecycle without UI or presentation state', () => {
    const start = createCoordinate(0, 0);
    const revisitVia = createCoordinate(2, 0);
    const hiddenMine = createCoordinate(1, 1);
    const initialBoard = createdBoard(
      createInitialBoard({
        dimensions: createBoardDimensions({ width: 3, height: 2 }),
        obstacleCoordinates: [createCoordinate(2, 1)],
        mineCoordinates: [hiddenMine],
      }),
    );
    const initialRun = createWaitingRunState(initialBoard);

    const firstMove = moveCharacter(initialRun, start);
    const afterFirstMove = movedState(firstMove);
    expect(afterFirstMove.phase).toEqual({ kind: 'active' });
    expect(afterFirstMove.characterPosition).toEqual({ kind: 'on-board', coordinate: start });
    expect(afterFirstMove.hasTakenStep).toBe(true);
    expect(getCellAt(afterFirstMove.board, start)).toEqual({
      kind: 'safe',
      exploration: 'explored',
      flagged: false,
    });
    expect(getCurrentCellMineCount(afterFirstMove)).toEqual({ status: 'available', mineCount: 1 });
    expect(initialRun.characterPosition).toEqual({ kind: 'waiting' });
    expect(getCellAt(initialRun.board, start)).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });

    const afterLeaving = movedState(moveCharacter(afterFirstMove, revisitVia));
    const boardAfterLeaving = afterLeaving.board;
    const afterRevisit = movedState(moveCharacter(afterLeaving, start));
    expect(afterRevisit.phase).toEqual({ kind: 'active' });
    expect(afterRevisit.characterPosition).toEqual({ kind: 'on-board', coordinate: start });
    expect(afterRevisit.board).toBe(boardAfterLeaving);
    expect(getCellAt(afterRevisit.board, start)).toEqual({
      kind: 'safe',
      exploration: 'explored',
      flagged: false,
    });

    const afterFlag = changedFlagState(setRunFlagged(afterRevisit, hiddenMine, true));
    expect(getCellAt(afterFlag.board, hiddenMine)).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: true,
    });
    expect(moveCharacter(afterFlag, hiddenMine)).toEqual({ outcome: 'rejected', reason: 'flagged' });
    expect(afterFlag.characterPosition).toEqual(afterRevisit.characterPosition);
    expect(afterFlag.hasTakenStep).toBe(afterRevisit.hasTakenStep);

    const afterUnflag = changedFlagState(setRunFlagged(afterFlag, hiddenMine, false));
    const encounterResult = moveCharacter(afterUnflag, hiddenMine);
    expect(encounterResult.outcome).toBe('requires-resolution');
    if (encounterResult.outcome !== 'requires-resolution') throw new Error('Expected a mine encounter.');
    const pending = encounterResult.state;
    expect(pending.phase).toEqual({
      kind: 'pending-mine-encounter',
      encounter: { target: hiddenMine, occurredOnFirstStep: false },
    });
    expect(pending.characterPosition).toEqual(afterUnflag.characterPosition);
    expect(pending.board).toBe(afterUnflag.board);
    expect(getCellAt(pending.board, hiddenMine)).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: false,
    });
    expect(moveCharacter(pending, revisitVia)).toEqual({
      outcome: 'rejected',
      reason: 'pending-mine-encounter',
    });
    expect(setRunFlagged(pending, createCoordinate(0, 1), true)).toEqual({
      outcome: 'rejected',
      reason: 'pending-mine-encounter',
    });

    const failureResult = settleMineEncounterAsFailure(pending);
    expect(failureResult.outcome).toBe('failed');
    if (failureResult.outcome !== 'failed') throw new Error('Expected Failure settlement.');
    const failed = failureResult.state;
    expect(failed.phase).toEqual({
      kind: 'failed',
      encounter: { target: hiddenMine, occurredOnFirstStep: false },
    });
    expect(failed.board).toBe(pending.board);
    expect(failed.characterPosition).toEqual(pending.characterPosition);
    expect(getCellAt(failed.board, start)).toEqual({
      kind: 'safe',
      exploration: 'explored',
      flagged: false,
    });
    expect(getCellAt(failed.board, hiddenMine)).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: false,
    });
    expect(moveCharacter(failed, revisitVia)).toEqual({ outcome: 'rejected', reason: 'run-failed' });
    expect(setRunFlagged(failed, createCoordinate(0, 1), true)).toEqual({
      outcome: 'rejected',
      reason: 'run-failed',
    });
  });

  it('completes the baseline Victory lifecycle only after every required Safe is explored', () => {
    const wrongFlagTarget = createCoordinate(0, 1);
    const mineCoordinate = createCoordinate(2, 1);
    const board = createdBoard(
      createInitialBoard({
        dimensions: createBoardDimensions({ width: 3, height: 2 }),
        obstacleCoordinates: [createCoordinate(1, 1)],
        mineCoordinates: [mineCoordinate],
      }),
    );
    let run = createWaitingRunState(board);

    for (const coordinate of [
      createCoordinate(0, 0),
      createCoordinate(1, 0),
      createCoordinate(2, 0),
    ]) {
      run = movedState(moveCharacter(run, coordinate));
      expect(run.phase).toEqual({ kind: 'active' });
    }

    run = changedFlagState(setRunFlagged(run, wrongFlagTarget, true));
    expect(moveCharacter(run, wrongFlagTarget)).toEqual({ outcome: 'rejected', reason: 'flagged' });
    expect(areAllRequiredSafeCellsExplored(run.board)).toBe(false);
    expect(run.phase).toEqual({ kind: 'active' });
    expect(getCellAt(run.board, mineCoordinate)).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: false,
    });

    run = changedFlagState(setRunFlagged(run, wrongFlagTarget, false));
    const boardBeforeWinningMove = run.board;
    const won = movedState(moveCharacter(run, wrongFlagTarget));
    expect(won.phase).toEqual({ kind: 'won' });
    expect(areAllRequiredSafeCellsExplored(won.board)).toBe(true);
    expect(getCellAt(won.board, wrongFlagTarget)).toEqual({
      kind: 'safe',
      exploration: 'explored',
      flagged: false,
    });
    expect(getCellAt(boardBeforeWinningMove, wrongFlagTarget)).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });
    expect(getCellAt(won.board, createCoordinate(1, 1))).toEqual({ kind: 'obstacle' });
    expect(getCellAt(won.board, mineCoordinate)).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: false,
    });
    expect(moveCharacter(won, createCoordinate(0, 0))).toEqual({ outcome: 'rejected', reason: 'run-won' });
    expect(setRunFlagged(won, mineCoordinate, true)).toEqual({ outcome: 'rejected', reason: 'run-won' });
    expect(getCurrentCellMineCount(won)).toEqual({ status: 'available', mineCount: 0 });
  });

  it('combines deterministic placement and initial assembly into the authoritative Board truth', () => {
    const candidates = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => createCoordinate(x, y)),
    ).flat();
    const selection = selectMineCoordinates(candidates, 4, createSeededRandomSource(123456789));
    expect(selection.status).toBe('selected');
    if (selection.status !== 'selected') throw new Error('Expected deterministic Mine placement.');
    expect(coordinateKeys(selection.coordinates)).toEqual(['2,2', '0,0', '0,2', '1,2']);

    const board = createdBoard(
      createInitialBoard({
        dimensions: createBoardDimensions({ width: 3, height: 3 }),
        obstacleCoordinates: [],
        mineCoordinates: selection.coordinates,
      }),
    );
    const boardMineKeys = board.cells.flatMap((cell, index) =>
      cell.kind === 'mine' ? [`${index % 3},${Math.floor(index / 3)}`] : [],
    );
    expect(boardMineKeys).toEqual(['0,0', '0,2', '1,2', '2,2']);
    expect(board.cells).toHaveLength(9);
  });

  it('counts a Revealed Mine through the same current-cell query and neighborhood truth', () => {
    const board = createBoard(
      createBoardDimensions({ width: 2, height: 1 }),
      [
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
          mineRevealed: true,
          flagged: false,
        }),
      ],
    );
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)), {
      hasTakenStep: true,
    });

    expect(getCurrentCellMineCount(run)).toEqual({ status: 'available', mineCount: 1 });
  });
});
