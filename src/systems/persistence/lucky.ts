import { createLuckyCandidate, type LuckyCandidateResult } from '../../core/lucky';
import { createGameState, type GameState } from '../../core/game-state';
import { moveCharacter, type MoveCharacterResult } from '../../core/movement';
import type { Coordinate } from '../../core/board';
import type { ActiveRunPersistenceInputV2 } from '../../core/persistence/save-v2';
import { commitCandidateWithWriterLease, type GuardedCommitResult } from './guarded-persistence';
import type { StringKeyValueStorage } from './key-value-storage';
import type { Clock, WriterIdentity } from './writer-lease';

export interface LuckyRequest {
  readonly currentAttempt: ActiveRunPersistenceInputV2;
  readonly currentRevision: number;
}
type CommitResult =
  | (Extract<GuardedCommitResult, { status: 'committed' }> & { readonly resolution: 'lucky' | 'pending' | 'moved' })
  | { readonly status: 'commit-rejected'; readonly failure: Exclude<GuardedCommitResult, { status: 'committed' }> };
export type AutomaticLuckyResult = CommitResult | Exclude<LuckyCandidateResult, { status: 'candidate' }>;
export type AutomaticMovementResult = CommitResult
  | Extract<LuckyCandidateResult, { status: 'rejected' }>
  | { readonly status: 'movement-rejected'; readonly reason: Extract<MoveCharacterResult, { outcome: 'rejected' }>['reason'] }
  | { readonly status: 'unchanged'; readonly reason: 'already-at-target' };

function commitGame(storage: StringKeyValueStorage, identity: WriterIdentity, clock: Clock,
  request: LuckyRequest, gameState: GameState, resolution: 'lucky' | 'pending' | 'moved'): CommitResult {
  const result = commitCandidateWithWriterLease(storage, identity, clock, request.currentRevision, {
    revision: request.currentRevision + 1,
    activeRun: { ...request.currentAttempt, gameState },
  });
  return result.status === 'committed' ? { ...result, resolution } : { status: 'commit-rejected', failure: result };
}

/** Explicit gameplay continuation for an existing pending encounter, never called by load. */
export function resolveAutomaticLucky(storage: StringKeyValueStorage, identity: WriterIdentity,
  clock: Clock, request: LuckyRequest): AutomaticLuckyResult {
  const lucky = createLuckyCandidate(request.currentAttempt.gameState);
  if (lucky.status !== 'candidate') return lucky;
  return commitGame(storage, identity, clock, request, lucky.candidate, 'lucky');
}

/** Movement's narrow automatic rescue boundary: no UI choice, Revive or Failure fallback. */
export function moveCharacterWithAutomaticLucky(storage: StringKeyValueStorage, identity: WriterIdentity,
  clock: Clock, request: LuckyRequest & { readonly target: Coordinate }): AutomaticMovementResult {
  let game: GameState;
  try { game = createGameState(request.currentAttempt.gameState); }
  catch { return { status: 'rejected', reason: 'invalid-game-state' }; }
  const movement = moveCharacter(game.run, request.target);
  if (movement.outcome === 'rejected') return { status: 'movement-rejected', reason: movement.reason };
  if (movement.outcome === 'unchanged') return { status: 'unchanged', reason: movement.reason };
  const movedGame = createGameState({ ...game, run: movement.state });
  if (movement.outcome === 'moved') return commitGame(storage, identity, clock, request, movedGame, 'moved');
  const lucky = createLuckyCandidate(movedGame);
  if (lucky.status === 'rejected') return lucky;
  return lucky.status === 'candidate'
    ? commitGame(storage, identity, clock, request, lucky.candidate, 'lucky')
    : commitGame(storage, identity, clock, request, movedGame, 'pending');
}
