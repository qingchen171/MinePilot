import { createBoard, createCellState, type Coordinate } from '../../src/core/board';
import { countAdjacentMines } from '../../src/core/neighborhood';
import { createCompleteAttempt } from '../../src/core/stage4-attempt-factory';
import { PRODUCTION_LEVEL_CATALOG } from '../../src/core/level-catalog';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { createRewardState } from '../../src/core/reward';
import { createTemporaryBenbenCard } from '../../src/core/temporary-benben-card';
import { createRunState, createOnBoardPosition, createRevealedMineOccupancyPosition,
  createPendingMineEncounterRunState, createWaitingPosition } from '../../src/core/run';
import { revealMine } from '../../src/core/reveal-mine';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { validateSaveDocumentV4 } from '../../src/core/persistence/save-v4';
import { commitSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from './memory-storage';

type Variant = 'pending' | 'failed' | 'won' | 'occupancy' | 'zero' | 'number' |
  'benben-available' | 'detection-rich' | 'temporary-detection' | 'waiting' | 'coin-reward' | 'one-time-l4';

/** Real valid v4 snapshot. Fixture construction never enters production UI or catalog. */
export function boardBrowserSave(variant: Variant, preferredCoordinate?: Coordinate) {
  // The coin case is a catalog-generated Reward in a deterministic preloaded L1 snapshot,
  // not a changed production reward table or a fresh-install promise.
  let made = createCompleteAttempt({ level: PRODUCTION_LEVEL_CATALOG.levels[0]!, runId: `browser-${variant}`,
    generationProvenance: { seed: 123456789, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
  if (variant === 'coin-reward') {
    for (let seed = 1; seed <= 100 &&
        (made.status !== 'created' || !made.attempt.rewards.some((reward) => reward.payload.kind === 'coins')); seed++) {
      made = createCompleteAttempt({ level: PRODUCTION_LEVEL_CATALOG.levels[0]!, runId: `browser-${variant}`,
        generationProvenance: { seed, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
    }
  }
  if (made.status !== 'created') throw new Error('attempt fixture');
  if (preferredCoordinate) {
    for (let seed = 1; seed <= 1000; seed++) {
      made = createCompleteAttempt({ level: PRODUCTION_LEVEL_CATALOG.levels[0]!, runId: `browser-${variant}`,
        generationProvenance: { seed, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
      if (made.status !== 'created') throw new Error('generated corner fixture');
      const cell = made.attempt.run.board.cells[preferredCoordinate.y * 9 + preferredCoordinate.x]!;
      if (cell.kind === 'safe' && !made.attempt.rewards.some((reward) =>
        reward.coordinate.x === preferredCoordinate.x && reward.coordinate.y === preferredCoordinate.y) &&
        countAdjacentMines(made.attempt.run.board, preferredCoordinate) > 0) break;
      if (seed === 1000) throw new Error('no generated corner fixture');
    }
  }
  if (variant === 'coin-reward' && !made.attempt.rewards.some((reward) => reward.payload.kind === 'coins'))
    throw new Error('catalog-generated coin fixture');
  const attempt = made.attempt;
  const board = attempt.run.board;
  const width = board.dimensions.width;
  const mineIndex = board.cells.findIndex((cell) => cell.kind === 'mine');
  const mine = { x: mineIndex % width, y: Math.floor(mineIndex / width) };
  const secondMineIndex = board.cells.findIndex((cell, index) => cell.kind === 'mine' && index !== mineIndex);
  const anotherMine = secondMineIndex < 0 ? null : { x: secondMineIndex % width, y: Math.floor(secondMineIndex / width) };
  const rewardTarget = (variant === 'coin-reward'
    ? attempt.rewards.find((reward) => reward.payload.kind === 'coins') : attempt.rewards[0])?.coordinate ?? null;
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
  } else if (variant === 'waiting' || variant === 'coin-reward') {
    // Preserve the real fresh waiting Attempt and its hidden Board for browser input evidence.
  } else if (variant === 'one-time-l4') {
    if (rewards.length < 1) throw new Error('one-time compatibility fixture needs a Safe Reward coordinate');
    const reward = rewards[0]!;
    rewards = [createRewardState({ coordinate: reward.coordinate, payload: { kind: 'coins', amount: 1 },
      claimed: false, oneTimeClaimId: 'browser-l4-once' })];
    account = { ...account, completedLevelIds: ['level-001', 'level-002', 'level-003'], oneTimeClaimIds: [] };
  } else if (variant === 'benben-available') {
    account = { ...account, benbenByLevel: [{ levelId: 'level-001', status: 'available', failureStreak: 0 }] };
  } else {
    if (variant === 'temporary-detection')
      account = { ...account, benbenByLevel: [{ levelId: 'level-001', status: 'used', failureStreak: 0 }] };
    const rewardCells = new Set(attempt.rewards.map((reward) => `${reward.coordinate.x},${reward.coordinate.y}`));
    const index = board.cells.findIndex((cell, i) => (!preferredCoordinate ||
      i === preferredCoordinate.y * width + preferredCoordinate.x) && cell.kind === 'safe' &&
      !rewardCells.has(`${i % width},${Math.floor(i / width)}`) &&
      (variant === 'zero' ? countAdjacentMines(board, { x: i % width, y: Math.floor(i / width) }) === 0 :
        (variant === 'detection-rich' || variant === 'temporary-detection')
          ? countAdjacentMines(board, { x: i % width, y: Math.floor(i / width) }) >= 2 :
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
    currentAttempt: { ...attempt, levelId: variant === 'one-time-l4' ? 'level-004' : attempt.levelId,
      run, rewards, terminalDisposition,
      temporaryBenbenCard: variant === 'temporary-detection'
        ? createTemporaryBenbenCard({ item: 'detection', consumed: false }) : null } });
  const moveIndex = run.board.cells.findIndex((cell, index) => cell.kind === 'safe' && cell.exploration === 'unexplored' &&
    !rewards.some((reward) => reward.coordinate.x === index % width &&
      reward.coordinate.y === Math.floor(index / width)));
  const moveTarget = moveIndex < 0 ? null : { x: moveIndex % width, y: Math.floor(moveIndex / width) };
  const mapped = mapStage4RuntimeToSaveV4(runtime, 4);
  if (mapped.status !== 'mapped') throw new Error(`v4 ${variant} fixture`);
  if (validateSaveDocumentV4(JSON.parse(JSON.stringify(mapped.document)) as unknown).status !== 'validated')
    throw new Error(`strict v4 ${variant} fixture`);
  const storage = new MemoryStorage();
  if (commitSnapshot(storage, JSON.stringify(mapped.document), 4).status !== 'committed') throw new Error('snapshot fixture');
  return { entries: [...storage.data], selected, expectedNumber, mine, anotherMine, rewardTarget, moveTarget };
}
