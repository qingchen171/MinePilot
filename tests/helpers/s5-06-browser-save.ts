import { createBoard, createCellState, type Coordinate } from '../../src/core/board';
import { countAdjacentMines } from '../../src/core/neighborhood';
import { createCompleteAttempt } from '../../src/core/stage4-attempt-factory';
import { PRODUCTION_LEVEL_CATALOG } from '../../src/core/level-catalog';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { createRunState, createOnBoardPosition, createRevealedMineOccupancyPosition,
  createPendingMineEncounterRunState, createWaitingPosition } from '../../src/core/run';
import { revealMine } from '../../src/core/reveal-mine';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { commitSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from './memory-storage';

type Variant = 'pending' | 'failed' | 'won' | 'occupancy' | 'zero' | 'number';

/** Real valid v4 snapshot. Fixture construction never enters production UI or catalog. */
export function boardBrowserSave(variant: Variant) {
  const made = createCompleteAttempt({ level: PRODUCTION_LEVEL_CATALOG.levels[0]!, runId: `browser-${variant}`,
    generationProvenance: { seed: 123456789, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
  if (made.status !== 'created') throw new Error('attempt fixture');
  const attempt = made.attempt;
  const board = attempt.run.board;
  const width = board.dimensions.width;
  const mineIndex = board.cells.findIndex((cell) => cell.kind === 'mine');
  const mine = { x: mineIndex % width, y: Math.floor(mineIndex / width) };
  let selected: Coordinate | null = null;
  let expectedNumber: number | null = null;
  let run = attempt.run;
  let terminalDisposition: 'not-applicable' | 'settled' = 'not-applicable';
  let rewards = attempt.rewards;
  let account = createInitialStage4GameState().account;
  if (variant === 'pending' || variant === 'failed') {
    run = createPendingMineEncounterRunState(run, mine);
    if (variant === 'failed') {
      run = createRunState(board, createWaitingPosition(), { hasTakenStep: true,
        phase: { kind: 'failed', encounter: { target: mine, occurredOnFirstStep: true } } });
      terminalDisposition = 'settled';
    }
  } else if (variant === 'occupancy') {
    const revealed = revealMine(board, mine);
    if (revealed.outcome !== 'changed') throw new Error('revealed Mine fixture');
    run = createRunState(revealed.board, createRevealedMineOccupancyPosition(mine), { hasTakenStep: true });
    selected = mine;
  } else if (variant === 'won') {
    const explored = createBoard(board.dimensions, board.cells.map((cell) => cell.kind === 'safe'
      ? createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false })
      : cell));
    run = createRunState(explored, createWaitingPosition(), { hasTakenStep: true, phase: { kind: 'won' } });
    rewards = attempt.rewards.map((reward) => ({ ...reward, claimed: true }));
    account = { ...account, completedLevelIds: ['level-001'] };
    terminalDisposition = 'settled';
  } else {
    const rewardCells = new Set(attempt.rewards.map((reward) => `${reward.coordinate.x},${reward.coordinate.y}`));
    const index = board.cells.findIndex((cell, i) => cell.kind === 'safe' &&
      !rewardCells.has(`${i % width},${Math.floor(i / width)}`) &&
      (variant === 'zero' ? countAdjacentMines(board, { x: i % width, y: Math.floor(i / width) }) === 0 :
        countAdjacentMines(board, { x: i % width, y: Math.floor(i / width) }) > 0));
    if (index < 0) throw new Error('number fixture');
    selected = { x: index % width, y: Math.floor(index / width) };
    expectedNumber = countAdjacentMines(board, selected);
    const explored = createBoard(board.dimensions, board.cells.map((cell, i) => i === index
      ? createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false })
      : cell));
    run = createRunState(explored, createOnBoardPosition(selected), { hasTakenStep: true });
  }
  const runtime = createStage4GameState({ ...createInitialStage4GameState(), account,
    currentAttempt: { ...attempt, run, rewards, terminalDisposition } });
  const moveIndex = run.board.cells.findIndex((cell, index) => cell.kind === 'safe' && cell.exploration === 'unexplored' &&
    !rewards.some((reward) => reward.coordinate.x === index % width &&
      reward.coordinate.y === Math.floor(index / width)));
  const moveTarget = moveIndex < 0 ? null : { x: moveIndex % width, y: Math.floor(moveIndex / width) };
  const mapped = mapStage4RuntimeToSaveV4(runtime, 4);
  if (mapped.status !== 'mapped') throw new Error(`v4 ${variant} fixture`);
  const storage = new MemoryStorage();
  if (commitSnapshot(storage, JSON.stringify(mapped.document), 4).status !== 'committed') throw new Error('snapshot fixture');
  return { entries: [...storage.data], selected, expectedNumber, mine, moveTarget };
}
