import {
  createBoardDimensions,
  createCoordinate,
  type BoardDimensions,
  type Coordinate,
} from '../../core/board';
import { createInitialBoard } from '../../core/initial-board';
import { selectMineCoordinates } from '../../core/mine-placement';
import {
  type ActiveRunPersistenceInputV1,
  type SaveDocumentPersistenceInputV1,
} from '../../core/persistence/save-v1';
import { createSeededRandomSource } from '../../core/random';
import { createWaitingRunState } from '../../core/run';
import { commitCandidateWithWriterLease, type GuardedCommitResult } from './guarded-persistence';
import type { StringKeyValueStorage } from './key-value-storage';
import type { Clock, WriterIdentity } from './writer-lease';

const UINT32_RANGE = 0x1_0000_0000;
const DEFAULT_MAX_GENERATION_ATTEMPTS = 4_096;

export interface LevelGenerationConfiguration {
  readonly dimensions: BoardDimensions;
  readonly obstacleCoordinates: readonly Coordinate[];
  readonly mineCount: number;
}

export interface RunIdSource {
  nextRunId(): string;
}

export interface NewAttemptRequest {
  readonly currentAttempt: ActiveRunPersistenceInputV1;
  readonly currentRevision: number;
  readonly generationConfiguration: LevelGenerationConfiguration;
  readonly runIdSource: RunIdSource;
  readonly maxGenerationAttempts?: number;
}

export type NewAttemptFailureReason =
  | 'restart-not-allowed'
  | 'retry-not-allowed'
  | 'missing-generation-provenance'
  | 'invalid-generation-configuration'
  | 'generation-configuration-mismatch'
  | 'invalid-generation-attempt-limit'
  | 'no-alternative-mine-layout'
  | 'generation-search-exhausted'
  | 'invalid-new-run-id'
  | 'same-run-id';

export type NewAttemptResult =
  | {
      readonly status: 'committed';
      readonly candidate: SaveDocumentPersistenceInputV1;
      readonly revision: number;
      readonly selectedSeed: number;
      readonly generationAttempts: number;
    }
  | { readonly status: 'rejected'; readonly reason: NewAttemptFailureReason }
  | { readonly status: 'commit-rejected'; readonly failure: Exclude<GuardedCommitResult, { status: 'committed' }> };

function coordinateKey({ x, y }: Coordinate): string {
  return `${x},${y}`;
}

function mineKeys(attempt: ActiveRunPersistenceInputV1): Set<string> {
  const width = attempt.run.board.dimensions.width;
  return new Set(attempt.run.board.cells.flatMap((cell, index) =>
    cell.kind === 'mine' ? [`${index % width},${Math.floor(index / width)}`] : [],
  ));
}

function obstacleKeys(attempt: ActiveRunPersistenceInputV1): Set<string> {
  const width = attempt.run.board.dimensions.width;
  return new Set(attempt.run.board.cells.flatMap((cell, index) =>
    cell.kind === 'obstacle' ? [`${index % width},${Math.floor(index / width)}`] : [],
  ));
}

function sameKeys(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((key) => right.has(key));
}

function prepareCandidates(
  configuration: LevelGenerationConfiguration,
): { coordinates: readonly Coordinate[]; obstacleKeys: Set<string> } | undefined {
  let dimensions: BoardDimensions;
  try {
    dimensions = createBoardDimensions(configuration.dimensions);
  } catch {
    return undefined;
  }
  const structural = createInitialBoard({
    dimensions,
    obstacleCoordinates: configuration.obstacleCoordinates,
    mineCoordinates: [],
  });
  if (structural.status !== 'created') return undefined;
  const obstacles = new Set(configuration.obstacleCoordinates.map(coordinateKey));
  const coordinates: Coordinate[] = [];
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      const coordinate = createCoordinate(x, y);
      if (!obstacles.has(coordinateKey(coordinate))) coordinates.push(coordinate);
    }
  }
  if (
    !Number.isSafeInteger(configuration.mineCount) ||
    configuration.mineCount < 0 ||
    configuration.mineCount > coordinates.length
  ) return undefined;
  return { coordinates, obstacleKeys: obstacles };
}

function buildAndCommit(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  request: NewAttemptRequest,
): NewAttemptResult {
  const provenance = request.currentAttempt.generationProvenance;
  if (provenance === undefined) {
    return { status: 'rejected', reason: 'missing-generation-provenance' };
  }
  const prepared = prepareCandidates(request.generationConfiguration);
  if (prepared === undefined) {
    return { status: 'rejected', reason: 'invalid-generation-configuration' };
  }
  const currentBoard = request.currentAttempt.run.board;
  if (
    currentBoard.dimensions.width !== request.generationConfiguration.dimensions.width ||
    currentBoard.dimensions.height !== request.generationConfiguration.dimensions.height ||
    !sameKeys(obstacleKeys(request.currentAttempt), prepared.obstacleKeys) ||
    mineKeys(request.currentAttempt).size !== request.generationConfiguration.mineCount
  ) {
    return { status: 'rejected', reason: 'generation-configuration-mismatch' };
  }
  const maxAttempts = request.maxGenerationAttempts ?? DEFAULT_MAX_GENERATION_ATTEMPTS;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) {
    return { status: 'rejected', reason: 'invalid-generation-attempt-limit' };
  }
  if (
    request.generationConfiguration.mineCount === 0 ||
    request.generationConfiguration.mineCount === prepared.coordinates.length
  ) {
    return { status: 'rejected', reason: 'no-alternative-mine-layout' };
  }

  const previousMines = mineKeys(request.currentAttempt);
  let selected: readonly Coordinate[] | undefined;
  let selectedSeed = provenance.seed;
  let generationAttempts = 0;
  for (let offset = 1; offset <= maxAttempts; offset += 1) {
    const seed = (provenance.seed + offset) % UINT32_RANGE;
    const placement = selectMineCoordinates(
      prepared.coordinates,
      request.generationConfiguration.mineCount,
      createSeededRandomSource(seed),
    );
    if (placement.status !== 'selected') {
      return { status: 'rejected', reason: 'invalid-generation-configuration' };
    }
    generationAttempts = offset;
    if (!sameKeys(previousMines, new Set(placement.coordinates.map(coordinateKey)))) {
      selected = placement.coordinates;
      selectedSeed = seed;
      break;
    }
  }
  if (selected === undefined) {
    return { status: 'rejected', reason: 'generation-search-exhausted' };
  }

  const runId = request.runIdSource.nextRunId();
  if (typeof runId !== 'string' || runId.trim().length === 0) {
    return { status: 'rejected', reason: 'invalid-new-run-id' };
  }
  if (runId === request.currentAttempt.runId) {
    return { status: 'rejected', reason: 'same-run-id' };
  }
  const board = createInitialBoard({
    dimensions: request.generationConfiguration.dimensions,
    obstacleCoordinates: request.generationConfiguration.obstacleCoordinates,
    mineCoordinates: selected,
  });
  if (board.status !== 'created') {
    return { status: 'rejected', reason: 'invalid-generation-configuration' };
  }
  const candidate: SaveDocumentPersistenceInputV1 = {
    revision: request.currentRevision + 1,
    activeRun: {
      runId,
      levelId: request.currentAttempt.levelId,
      run: createWaitingRunState(board.board),
      generationProvenance: { ...provenance, seed: selectedSeed },
    },
  };
  const committed = commitCandidateWithWriterLease(
    storage,
    identity,
    clock,
    request.currentRevision,
    candidate,
  );
  return committed.status === 'committed'
    ? { status: 'committed', candidate, revision: committed.revision, selectedSeed, generationAttempts }
    : { status: 'commit-rejected', failure: committed };
}

export function restartCurrentAttempt(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  request: NewAttemptRequest,
): NewAttemptResult {
  if (request.currentAttempt.run.phase.kind !== 'active' &&
      request.currentAttempt.run.phase.kind !== 'pending-mine-encounter') {
    return { status: 'rejected', reason: 'restart-not-allowed' };
  }
  return buildAndCommit(storage, identity, clock, request);
}

export function retryFailedAttempt(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  request: NewAttemptRequest,
): NewAttemptResult {
  if (request.currentAttempt.run.phase.kind !== 'failed') {
    return { status: 'rejected', reason: 'retry-not-allowed' };
  }
  return buildAndCommit(storage, identity, clock, request);
}
