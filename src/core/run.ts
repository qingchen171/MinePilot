import { createCoordinate, getCellAt, type BoardState, type Coordinate } from './board';
import { areAllRequiredSafeCellsExplored } from './victory';

export interface WaitingPosition {
  readonly kind: 'waiting';
}

export interface OnBoardPosition {
  readonly kind: 'on-board';
  readonly coordinate: Coordinate;
}

export interface RevealedMineOccupancyPosition {
  readonly kind: 'revealed-mine-occupancy';
  readonly coordinate: Coordinate;
}

export type CharacterPosition =
  | WaitingPosition
  | OnBoardPosition
  | RevealedMineOccupancyPosition;

export interface MineEncounter {
  readonly target: Coordinate;
  readonly occurredOnFirstStep: boolean;
}

export type RunPhase =
  | { readonly kind: 'active' }
  | { readonly kind: 'pending-mine-encounter'; readonly encounter: MineEncounter }
  | { readonly kind: 'failed'; readonly encounter: MineEncounter }
  | { readonly kind: 'won' };

export interface RunState {
  readonly board: BoardState;
  readonly characterPosition: CharacterPosition;
  readonly hasTakenStep: boolean;
  readonly phase: RunPhase;
}

export interface RunStateOptions {
  readonly hasTakenStep?: boolean;
  readonly phase?: RunPhase;
}

export function createWaitingPosition(): WaitingPosition {
  return Object.freeze({ kind: 'waiting' });
}

export function createOnBoardPosition(coordinate: Coordinate): OnBoardPosition {
  return Object.freeze({
    kind: 'on-board',
    coordinate: createCoordinate(coordinate.x, coordinate.y),
  });
}

export function createRevealedMineOccupancyPosition(
  coordinate: Coordinate,
): RevealedMineOccupancyPosition {
  return Object.freeze({
    kind: 'revealed-mine-occupancy',
    coordinate: createCoordinate(coordinate.x, coordinate.y),
  });
}

function copyCharacterPosition(position: CharacterPosition): CharacterPosition {
  if (position.kind === 'waiting') return createWaitingPosition();
  if (position.kind === 'on-board') return createOnBoardPosition(position.coordinate);
  if (position.kind === 'revealed-mine-occupancy') {
    return createRevealedMineOccupancyPosition(position.coordinate);
  }
  throw new Error('Character position kind is invalid.');
}

function copyEncounter(encounter: MineEncounter): MineEncounter {
  return Object.freeze({
    target: createCoordinate(encounter.target.x, encounter.target.y),
    occurredOnFirstStep: encounter.occurredOnFirstStep,
  });
}

function copyPhase(phase: RunPhase): RunPhase {
  if (phase.kind === 'active' || phase.kind === 'won') {
    return Object.freeze({ kind: phase.kind });
  }
  return Object.freeze({ kind: phase.kind, encounter: copyEncounter(phase.encounter) });
}

export function createRunState(
  board: BoardState,
  characterPosition: CharacterPosition,
  options: RunStateOptions = {},
): RunState {
  const position = copyCharacterPosition(characterPosition);
  const hasTakenStep = options.hasTakenStep ?? position.kind !== 'waiting';
  const phase = copyPhase(options.phase ?? { kind: 'active' });

  if (position.kind === 'on-board') {
    const cell = getCellAt(board, position.coordinate);
    if (cell === undefined) throw new Error('An on-board character position must be inside the board.');
    if (cell.kind !== 'safe' || cell.exploration !== 'explored') {
      throw new Error('An on-board character position must reference an explored safe cell.');
    }
    if (!hasTakenStep) throw new Error('An on-board character must have taken a step.');
  }

  if (position.kind === 'revealed-mine-occupancy') {
    const cell = getCellAt(board, position.coordinate);
    if (cell === undefined) {
      throw new Error('A revealed-mine occupancy position must be inside the board.');
    }
    if (cell.kind !== 'mine' || cell.revelation !== 'revealed') {
      throw new Error('A revealed-mine occupancy position must reference a revealed mine.');
    }
    if (!hasTakenStep) {
      throw new Error('A revealed-mine occupancy position requires a recorded step.');
    }
  }

  if (phase.kind === 'pending-mine-encounter' || phase.kind === 'failed') {
    if (!hasTakenStep) throw new Error('A mine encounter requires a recorded step attempt.');
    const targetCell = getCellAt(board, phase.encounter.target);
    if (targetCell?.kind !== 'mine' || targetCell.revelation !== 'hidden' || targetCell.flagged) {
      throw new Error('A mine encounter must reference an unflagged hidden mine.');
    }
    if (phase.encounter.occurredOnFirstStep && position.kind !== 'waiting') {
      throw new Error('A first-step mine encounter must originate from waiting.');
    }
  }
  if (phase.kind === 'won' && !areAllRequiredSafeCellsExplored(board)) {
    throw new Error('A won run requires every required safe cell to be explored.');
  }

  return Object.freeze({ board, characterPosition: position, hasTakenStep, phase });
}

export function createWaitingRunState(board: BoardState): RunState {
  return createRunState(board, createWaitingPosition());
}

export function createPendingMineEncounterRunState(
  run: RunState,
  target: Coordinate,
): RunState {
  if (run.phase.kind !== 'active') throw new Error('Only an active run can begin a mine encounter.');

  return createRunState(run.board, run.characterPosition, {
    hasTakenStep: true,
    phase: {
      kind: 'pending-mine-encounter',
      encounter: {
        target,
        occurredOnFirstStep: !run.hasTakenStep,
      },
    },
  });
}

export type SettleRunAsWonResult =
  | { readonly outcome: 'won'; readonly state: RunState }
  | {
      readonly outcome: 'rejected';
      readonly reason: 'run-not-active' | 'required-safe-cells-unexplored';
    };

export function settleRunAsWon(run: RunState): SettleRunAsWonResult {
  if (run.phase.kind !== 'active') {
    return { outcome: 'rejected', reason: 'run-not-active' };
  }
  if (!areAllRequiredSafeCellsExplored(run.board)) {
    return { outcome: 'rejected', reason: 'required-safe-cells-unexplored' };
  }

  return {
    outcome: 'won',
    state: createRunState(run.board, run.characterPosition, {
      hasTakenStep: run.hasTakenStep,
      phase: { kind: 'won' },
    }),
  };
}
