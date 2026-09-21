/** Stage 4 pure candidate composition, shared by dormant tests and the activated production facade. */
import type { Coordinate } from '../../core/board';
import { createAccountState } from '../../core/account';
import type { AttemptState, GenerationProvenance } from '../../core/attempt-state';
import { claimBenbenAssistance } from '../../core/benben-claim';
import { deriveBenbenEligibility } from '../../core/benben-random';
import { createAirplaneCandidateWithTemporaryResource } from '../../core/airplane';
import { createDetectionCandidateWithTemporaryResource } from '../../core/detection';
import { settleMineEncounterAsFailure } from '../../core/encounter';
import { createGameState, type GameState } from '../../core/game-state';
import { createMovementCandidateWithAutomaticLuckyResource } from '../../core/lucky';
import { getLevelAccess, type LevelCatalog, type LevelDefinition, PRODUCTION_LEVEL_CATALOG } from '../../core/level-catalog';
import { mapStage4RuntimeToSaveV3 } from '../../core/persistence/stage4-runtime-mapping';
import type { SaveDocumentV3 } from '../../core/persistence/save-v3';
import { createSeededRandomSource } from '../../core/random';
import { selectMineCoordinates } from '../../core/mine-placement';
import { applyRewardClaimsForExploration } from '../../core/reward-claim';
import { createReviveCandidateWithTemporaryResource } from '../../core/revive';
import { setRunFlagged } from '../../core/run-flag';
import { createStage4AccountState, type Stage4AccountState } from '../../core/stage4-account';
import { createCompleteAttempt } from '../../core/stage4-attempt-factory';
import { createStage4GameState, type Stage4GameState } from '../../core/stage4-game-state';
import { createStableId } from '../../core/stable-id';
import { settleTerminalOutcome } from '../../core/terminal-settlement';
import type { RunState } from '../../core/run';
import { loadProductionPersistedSave } from './persistence-coordinator';
import type { StringKeyValueStorage } from './key-value-storage';

const UINT32_RANGE = 0x1_0000_0000;
const MAX_SEARCH = 4096;

export interface CreationFacts {
  readonly runId: string;
  readonly baseSeed: number;
  readonly rngVersion: string;
  readonly generationVersion: string;
}

type Authority = { readonly expectedRevision: number | null; readonly expectedRunId: string | null };
type NewAttemptIntent = { readonly creation: CreationFacts };
export type DormantMutationIntent = Authority & (
  | ({ readonly kind: 'start'; readonly levelId: string } & NewAttemptIntent)
  | ({ readonly kind: 'restart' | 'retry' | 'replay' | 'next' } & NewAttemptIntent)
  | { readonly kind: 'abandon' | 'dismiss' | 'failure' | 'revive' | 'claim-benben' }
  | { readonly kind: 'flag'; readonly coordinate: Coordinate; readonly flagged: boolean }
  | { readonly kind: 'move' | 'airplane'; readonly coordinate: Coordinate }
  | { readonly kind: 'detection'; readonly initializeSeed?: number }
);

/** Narrow commit port. Production binds it to the Stage 2 lease/revision gate. */
export interface DormantCommitBoundary {
  commit(document: SaveDocumentV3, expectedRevision: number | null):
    | { readonly status: 'committed' }
    | { readonly status: 'rejected'; readonly reason: string };
}

export type DormantMutationResult =
  | { readonly status: 'committed'; readonly runtime: Stage4GameState; readonly revision: number }
  | { readonly status: 'rejected'; readonly reason: string };

type Composition =
  | { readonly status: 'candidate'; readonly runtime: Stage4GameState }
  | { readonly status: 'rejected'; readonly reason: string };

function reject(reason: string): Composition { return { status: 'rejected', reason }; }
function bridge(attempt: AttemptState, account: Stage4AccountState): GameState {
  return createGameState({ account: createAccountState(account.inventory), run: attempt.run, runItems: attempt.runItems });
}
function gameCandidate(
  previous: Stage4GameState,
  game: GameState,
  temporaryBenbenCard: AttemptState['temporaryBenbenCard'],
): Stage4GameState {
  const attempt = previous.currentAttempt!;
  return createStage4GameState({
    account: createStage4AccountState({ ...previous.account, inventory: game.account.inventory }),
    currentAttempt: { ...attempt, run: game.run, runItems: game.runItems, temporaryBenbenCard },
  });
}
function mineKeys(attempt: AttemptState): Set<string> {
  const width = attempt.run.board.dimensions.width;
  return new Set(attempt.run.board.cells.flatMap((cell, i) => cell.kind === 'mine'
    ? [`${i % width},${Math.floor(i / width)}`] : []));
}
function sameKeys(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((key) => right.has(key));
}
function uint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < UINT32_RANGE;
}
function validCreation(facts: CreationFacts, oldRunId?: string): boolean {
  try {
    createStableId(facts.runId, 'Run ID');
    createStableId(facts.rngVersion, 'RNG version');
    createStableId(facts.generationVersion, 'Generation version');
  } catch { return false; }
  return uint32(facts.baseSeed) && facts.runId !== oldRunId;
}
function candidates(level: LevelDefinition): readonly Coordinate[] {
  const obstacles = new Set(level.board.obstacleCoordinates.map((point) => `${point.x},${point.y}`));
  const result: Coordinate[] = [];
  for (let y = 0; y < level.board.dimensions.height; y++) {
    for (let x = 0; x < level.board.dimensions.width; x++) {
      if (!obstacles.has(`${x},${y}`)) result.push({ x, y });
    }
  }
  return result;
}
function createNewAttempt(
  level: LevelDefinition,
  creation: CreationFacts,
  previous: AttemptState | null,
): { readonly status: 'created'; readonly attempt: AttemptState } | { readonly status: 'rejected'; readonly reason: string } {
  if (!validCreation(creation, previous?.runId)) return { status: 'rejected', reason: 'invalid-creation-facts' };
  if (previous === null) {
    const provenance: GenerationProvenance = { seed: creation.baseSeed, rngVersion: creation.rngVersion, generationVersion: creation.generationVersion };
    const result = createCompleteAttempt({ level, runId: creation.runId, generationProvenance: provenance });
    return result.status === 'created' ? result : { status: 'rejected', reason: result.status };
  }
  const oldBoard = previous.run.board;
  if (oldBoard.dimensions.width !== level.board.dimensions.width || oldBoard.dimensions.height !== level.board.dimensions.height) {
    return { status: 'rejected', reason: 'generation-configuration-mismatch' };
  }
  const oldMines = mineKeys(previous);
  if (oldMines.size !== level.board.mineCount ||
      oldBoard.cells.filter((cell) => cell.kind === 'obstacle').length !== level.board.obstacleCoordinates.length ||
      level.board.obstacleCoordinates.some(({ x, y }) => oldBoard.cells[y * oldBoard.dimensions.width + x]?.kind !== 'obstacle')) {
    return { status: 'rejected', reason: 'generation-configuration-mismatch' };
  }
  const eligible = candidates(level);
  if (level.board.mineCount === 0 || level.board.mineCount === eligible.length) {
    return { status: 'rejected', reason: 'no-alternative-mine-layout' };
  }
  const start = previous.generationProvenance === null
    ? creation.baseSeed : (previous.generationProvenance.seed + 1) % UINT32_RANGE;
  for (let offset = 0; offset < MAX_SEARCH; offset++) {
    const seed = (start + offset) % UINT32_RANGE;
    const selection = selectMineCoordinates(eligible, level.board.mineCount, createSeededRandomSource(seed));
    if (selection.status !== 'selected') return { status: 'rejected', reason: 'invalid-placement' };
    const selected = new Set(selection.coordinates.map(({ x, y }) => `${x},${y}`));
    if (sameKeys(oldMines, selected)) continue;
    const provenance: GenerationProvenance = {
      seed,
      rngVersion: previous.generationProvenance?.rngVersion ?? creation.rngVersion,
      generationVersion: previous.generationProvenance?.generationVersion ?? creation.generationVersion,
    };
    const result = createCompleteAttempt({ level, runId: creation.runId, generationProvenance: provenance });
    return result.status === 'created' ? result : { status: 'rejected', reason: result.status };
  }
  return { status: 'rejected', reason: 'generation-search-exhausted' };
}

function settleWin(
  old: Stage4GameState,
  nextRun: RunState,
  nextAccount: Stage4AccountState,
  nextRewards: AttemptState['rewards'],
  nextItems: AttemptState['runItems'],
  card: AttemptState['temporaryBenbenCard'],
): Composition {
  const attempt = old.currentAttempt!;
  if (nextRun.phase.kind !== 'won') {
    return { status: 'candidate', runtime: createStage4GameState({
      account: nextAccount, currentAttempt: { ...attempt, run: nextRun, rewards: nextRewards, runItems: nextItems, temporaryBenbenCard: card },
    }) };
  }
  const settled = settleTerminalOutcome({
    levelId: attempt.levelId, nextPhase: nextRun.phase, previousDisposition: attempt.terminalDisposition,
    completedLevelIds: nextAccount.completedLevelIds, benbenByLevel: nextAccount.benbenByLevel,
  });
  if (settled.status !== 'settled') return reject(`terminal-${settled.status}`);
  return { status: 'candidate', runtime: createStage4GameState({
    account: { ...nextAccount, completedLevelIds: settled.nextCompletedLevelIds, benbenByLevel: settled.nextBenbenByLevel },
    currentAttempt: { ...attempt, run: nextRun, rewards: nextRewards, runItems: nextItems, temporaryBenbenCard: null, terminalDisposition: 'settled' },
  }) };
}

function composeExploration(old: Stage4GameState, game: GameState, card: AttemptState['temporaryBenbenCard']): Composition {
  const attempt = old.currentAttempt!;
  const claims = applyRewardClaimsForExploration({
    oldBoard: attempt.run.board, nextBoard: game.run.board, rewards: attempt.rewards,
    assets: { ...old.account, inventory: game.account.inventory },
  });
  if (claims.status === 'rejected') return reject(`reward-${claims.reason}`);
  const account = claims.status === 'claimed'
    ? createStage4AccountState({ ...old.account, inventory: claims.nextInventory, coins: claims.nextCoins, oneTimeClaimIds: claims.nextOneTimeClaimIds })
    : createStage4AccountState({ ...old.account, inventory: game.account.inventory });
  return settleWin(old, game.run, account,
    claims.status === 'claimed' ? claims.nextRewards : attempt.rewards, game.runItems, card);
}

function compose(old: Stage4GameState, intent: DormantMutationIntent, catalog: LevelCatalog): Composition {
  const attempt = old.currentAttempt;
  if (intent.kind === 'start') {
    if (attempt !== null) return reject('attempt-already-exists');
    const access = getLevelAccess(catalog, intent.levelId, old.account.completedLevelIds);
    if (access.status !== 'found') return reject('level-not-found');
    if (!access.unlocked) return reject('level-locked');
    const next = createNewAttempt(access.level, intent.creation, null);
    return next.status === 'created' ? { status: 'candidate', runtime: createStage4GameState({ account: old.account, currentAttempt: next.attempt }) } : reject(next.reason);
  }
  if (attempt === null) return reject('no-attempt');
  const phase = attempt.run.phase.kind;
  if (intent.kind === 'abandon') {
    return phase === 'active' || phase === 'pending-mine-encounter'
      ? { status: 'candidate', runtime: createStage4GameState({ account: old.account, currentAttempt: null }) }
      : reject('invalid-phase');
  }
  if (intent.kind === 'dismiss') {
    return phase === 'won' || phase === 'failed'
      ? { status: 'candidate', runtime: createStage4GameState({ account: old.account, currentAttempt: null }) }
      : reject('invalid-phase');
  }
  if (intent.kind === 'restart' || intent.kind === 'retry' || intent.kind === 'replay' || intent.kind === 'next') {
    if (intent.kind === 'restart' && phase !== 'active' && phase !== 'pending-mine-encounter') return reject('invalid-phase');
    if (intent.kind === 'retry' && phase !== 'failed') return reject('invalid-phase');
    if ((intent.kind === 'replay' || intent.kind === 'next') && phase !== 'won') return reject('invalid-phase');
    if (intent.kind === 'replay' && !old.account.completedLevelIds.includes(attempt.levelId)) return reject('replay-not-entitled');
    const currentAccess = getLevelAccess(catalog, attempt.levelId, old.account.completedLevelIds);
    if (currentAccess.status !== 'found') return reject('level-not-found');
    const targetId = intent.kind === 'next' ? currentAccess.nextLevelId : attempt.levelId;
    if (targetId === null) return reject('next-unavailable');
    const target = getLevelAccess(catalog, targetId, old.account.completedLevelIds);
    if (target.status !== 'found' || !target.unlocked) return reject('level-locked');
    const next = createNewAttempt(target.level, intent.creation, targetId === attempt.levelId ? attempt : null);
    return next.status === 'created' ? { status: 'candidate', runtime: createStage4GameState({ account: old.account, currentAttempt: next.attempt }) } : reject(next.reason);
  }
  if (intent.kind === 'flag') {
    const result = setRunFlagged(attempt.run, intent.coordinate, intent.flagged);
    return result.outcome === 'changed'
      ? { status: 'candidate', runtime: createStage4GameState({ account: old.account, currentAttempt: { ...attempt, run: result.state } }) }
      : reject(result.reason);
  }
  if (intent.kind === 'move') {
    const result = createMovementCandidateWithAutomaticLuckyResource(bridge(attempt, old.account), intent.coordinate, attempt.temporaryBenbenCard);
    if (result.status !== 'candidate') return reject(result.reason);
    return result.resolution === 'moved'
      ? composeExploration(old, result.candidate, result.temporaryBenbenCard)
      : { status: 'candidate', runtime: gameCandidate(old, result.candidate, result.temporaryBenbenCard) };
  }
  if (intent.kind === 'airplane') {
    const result = createAirplaneCandidateWithTemporaryResource(bridge(attempt, old.account), intent.coordinate, attempt.temporaryBenbenCard);
    return result.status === 'candidate' ? composeExploration(old, result.candidate, result.temporaryBenbenCard) : reject(result.reason);
  }
  if (intent.kind === 'detection') {
    const result = createDetectionCandidateWithTemporaryResource(
      bridge(attempt, old.account), () => {
        if (intent.initializeSeed === undefined) throw new Error('Missing stable detection seed.');
        return intent.initializeSeed;
      }, attempt.temporaryBenbenCard,
    );
    return result.status === 'candidate'
      ? { status: 'candidate', runtime: gameCandidate(old, result.candidate, result.temporaryBenbenCard) }
      : reject(result.reason);
  }
  if (intent.kind === 'revive') {
    const result = createReviveCandidateWithTemporaryResource(bridge(attempt, old.account), attempt.temporaryBenbenCard);
    return result.status === 'candidate'
      ? { status: 'candidate', runtime: gameCandidate(old, result.candidate, result.temporaryBenbenCard) }
      : reject(result.reason);
  }
  if (intent.kind === 'claim-benben') {
    if (attempt.run.characterPosition.kind !== 'waiting') return reject('not-waiting');
    const result = claimBenbenAssistance({
      attemptLevelId: attempt.levelId, attemptRunId: attempt.runId, claimLevelId: attempt.levelId,
      hasTakenStep: attempt.run.hasTakenStep, phase: attempt.run.phase,
      benbenByLevel: old.account.benbenByLevel, temporaryBenbenCard: attempt.temporaryBenbenCard,
    });
    return result.status === 'claimed'
      ? { status: 'candidate', runtime: createStage4GameState({
          account: { ...old.account, benbenByLevel: result.nextBenbenByLevel },
          currentAttempt: { ...attempt, temporaryBenbenCard: result.temporaryBenbenCard },
        }) }
      : reject(result.reason);
  }
  const failed = settleMineEncounterAsFailure(attempt.run);
  if (failed.outcome !== 'failed') return reject(failed.reason);
  let settlement = settleTerminalOutcome({
    levelId: attempt.levelId, nextPhase: failed.state.phase,
    previousDisposition: attempt.terminalDisposition,
    completedLevelIds: old.account.completedLevelIds, benbenByLevel: old.account.benbenByLevel,
  });
  if (settlement.status === 'rejected' && settlement.reason === 'eligibility-required') {
    settlement = settleTerminalOutcome({
      levelId: attempt.levelId, nextPhase: failed.state.phase,
      previousDisposition: attempt.terminalDisposition,
      completedLevelIds: old.account.completedLevelIds, benbenByLevel: old.account.benbenByLevel,
      eligibility: deriveBenbenEligibility({ levelId: attempt.levelId, runId: attempt.runId }),
    });
  }
  if (settlement.status !== 'settled') return reject(`terminal-${settlement.status}`);
  return { status: 'candidate', runtime: createStage4GameState({
    account: { ...old.account, benbenByLevel: settlement.nextBenbenByLevel },
    currentAttempt: { ...attempt, run: failed.state, terminalDisposition: 'settled', temporaryBenbenCard: null },
  }) };
}

/** Re-reads Stage 2 committed authority for every intent; only a committed port result publishes. */
export function executeDormantStage4Mutation(
  storage: StringKeyValueStorage,
  intent: DormantMutationIntent,
  commit: DormantCommitBoundary,
  catalog: LevelCatalog = PRODUCTION_LEVEL_CATALOG,
): DormantMutationResult {
  const loaded = loadProductionPersistedSave(storage);
  if (loaded.status !== 'fresh' && loaded.status !== 'loaded') return { status: 'rejected', reason: loaded.status };
  const actualRevision = loaded.status === 'fresh' ? null : loaded.persistence.revision;
  if (intent.expectedRevision !== actualRevision) return { status: 'rejected', reason: 'revision-conflict' };
  if (intent.expectedRunId !== loaded.runtime.currentAttempt?.runId &&
      !(intent.expectedRunId === null && loaded.runtime.currentAttempt === null)) {
    return { status: 'rejected', reason: 'run-id-conflict' };
  }
  let composed: Composition;
  try { composed = compose(loaded.runtime, intent, catalog); }
  catch { return { status: 'rejected', reason: 'invalid-candidate' }; }
  if (composed.status === 'rejected') return composed;
  const revision = actualRevision === null ? 0 : actualRevision + 1;
  if (!Number.isSafeInteger(revision)) return { status: 'rejected', reason: 'revision-overflow' };
  const mapped = mapStage4RuntimeToSaveV3(composed.runtime, revision);
  if (mapped.status !== 'mapped') return { status: 'rejected', reason: mapped.status };
  const result = commit.commit(mapped.document, actualRevision);
  return result.status === 'committed'
    ? { status: 'committed', runtime: composed.runtime, revision }
    : { status: 'rejected', reason: `commit-${result.reason}` };
}
