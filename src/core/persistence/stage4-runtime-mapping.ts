import { type BoardState, type CellState } from '../board';
import { validateBoardInput } from '../board-validator';
import {
  createAttemptState,
  type AttemptState,
} from '../attempt-state';
import {
  createOnBoardPosition,
  createRevealedMineOccupancyPosition,
  createRunState,
  createWaitingPosition,
  type CharacterPosition,
  type RunPhase,
} from '../run';
import { createRunItemState } from '../run-item-state';
import { createRewardState } from '../reward';
import { createStage4AccountState } from '../stage4-account';
import {
  createStage4GameState,
  type Stage4GameState,
} from '../stage4-game-state';
import { createTemporaryBenbenCard } from '../temporary-benben-card';
import {
  validateSaveDocumentV3,
  getAuthenticTrustedMigrationDocument,
  isAuthenticTrustedMigrationResult,
  type AttemptSaveV3,
  type SaveDocumentV3,
  type TrustedMigratedSaveDocumentV3Result,
  type ValidateSaveDocumentV3Result,
} from './save-v3';

export type MapStage4RuntimeResult =
  | { readonly status: 'mapped'; readonly document: SaveDocumentV3 }
  | { readonly status: 'not-writable'; readonly reason: 'legacy-excluded-attempt' }
  | { readonly status: 'invalid-runtime' };

function cellToDto(cell: CellState) {
  if (cell.kind === 'obstacle') return { terrain: 'obstacle' as const, containsMine: false, explored: false, mineRevealed: false, flagged: false };
  if (cell.kind === 'safe') return { terrain: 'playable' as const, containsMine: false, explored: cell.exploration === 'explored', mineRevealed: false, flagged: cell.flagged };
  return { terrain: 'playable' as const, containsMine: true, explored: false, mineRevealed: cell.revelation === 'revealed', flagged: cell.flagged };
}

function attemptToDto(attempt: AttemptState): AttemptSaveV3 {
  const position = attempt.run.characterPosition;
  const phase = attempt.run.phase;
  return {
    runId: attempt.runId,
    levelId: attempt.levelId,
    generationProvenance: attempt.generationProvenance === null ? null : { ...attempt.generationProvenance },
    run: {
      board: {
        dimensions: { ...attempt.run.board.dimensions },
        cells: attempt.run.board.cells.map(cellToDto),
      },
      characterPosition: position.kind === 'waiting'
        ? { kind: 'waiting' }
        : { kind: position.kind, coordinate: { ...position.coordinate } },
      hasTakenStep: attempt.run.hasTakenStep,
      phase: phase.kind === 'active' || phase.kind === 'won'
        ? { kind: phase.kind }
        : { kind: phase.kind, encounter: { target: { ...phase.encounter.target }, occurredOnFirstStep: phase.encounter.occurredOnFirstStep } },
    },
    runItems: { ...attempt.runItems },
    rewards: attempt.rewards.map((reward) => ({
      coordinate: { ...reward.coordinate },
      payload: reward.payload.kind === 'coins' ? { ...reward.payload } : { ...reward.payload },
      claimed: reward.claimed,
      oneTimeClaimId: reward.oneTimeClaimId,
    })),
    temporaryBenbenCard: attempt.temporaryBenbenCard === null ? null : { ...attempt.temporaryBenbenCard },
    terminalDisposition: attempt.terminalDisposition,
  };
}

export function mapStage4RuntimeToSaveV3(
  runtime: Stage4GameState,
  revision: number,
): MapStage4RuntimeResult {
  if (!Number.isSafeInteger(revision) || revision < 0) return { status: 'invalid-runtime' };
  if (runtime.currentAttempt?.terminalDisposition === 'legacy-excluded') {
    return { status: 'not-writable', reason: 'legacy-excluded-attempt' };
  }
  let document: SaveDocumentV3;
  try {
    const validated = createStage4GameState(runtime);
    document = {
      saveVersion: 3,
      revision,
      account: {
        inventory: { ...validated.account.inventory },
        coins: validated.account.coins,
        completedLevelIds: [...validated.account.completedLevelIds],
        oneTimeClaimIds: [...validated.account.oneTimeClaimIds],
        benbenByLevel: validated.account.benbenByLevel.map((entry) => ({ ...entry })),
      },
      currentAttempt: validated.currentAttempt === null ? null : attemptToDto(validated.currentAttempt),
    };
  } catch {
    return { status: 'invalid-runtime' };
  }
  const checked = validateSaveDocumentV3(document);
  return checked.status === 'validated'
    ? { status: 'mapped', document: checked.document }
    : { status: 'invalid-runtime' };
}

function boardFromDto(dto: AttemptSaveV3['run']['board']): BoardState {
  const parsed = validateBoardInput(dto);
  if (parsed.status !== 'valid') throw new Error('Validated v3 Board reconstruction failed.');
  return parsed.board;
}

function positionFromDto(dto: AttemptSaveV3['run']['characterPosition']): CharacterPosition {
  if (dto.kind === 'waiting') return createWaitingPosition();
  if (dto.kind === 'on-board') return createOnBoardPosition(dto.coordinate);
  return createRevealedMineOccupancyPosition(dto.coordinate);
}

function phaseFromDto(dto: AttemptSaveV3['run']['phase']): RunPhase {
  if (dto.kind === 'active' || dto.kind === 'won') return Object.freeze({ kind: dto.kind });
  return Object.freeze({ kind: dto.kind, encounter: Object.freeze({ target: { ...dto.encounter.target }, occurredOnFirstStep: dto.encounter.occurredOnFirstStep }) });
}

function reconstruct(
  document: SaveDocumentV3,
  trusted?: Extract<TrustedMigratedSaveDocumentV3Result, { readonly status: 'validated' }>,
): Stage4GameState {
  const account = createStage4AccountState(document.account);
  if (document.currentAttempt === null) return createStage4GameState({ account, currentAttempt: null });
  const dto = document.currentAttempt;
  const run = createRunState(boardFromDto(dto.run.board), positionFromDto(dto.run.characterPosition), {
    hasTakenStep: dto.run.hasTakenStep,
    phase: phaseFromDto(dto.run.phase),
  });
  const input: AttemptState = {
    runId: dto.runId,
    levelId: dto.levelId,
    generationProvenance: dto.generationProvenance === null ? null : Object.freeze({ ...dto.generationProvenance }),
    run,
    runItems: createRunItemState(dto.runItems),
    rewards: Object.freeze(dto.rewards.map(createRewardState)),
    temporaryBenbenCard: dto.temporaryBenbenCard === null ? null : createTemporaryBenbenCard(dto.temporaryBenbenCard),
    terminalDisposition: dto.terminalDisposition,
  };
  if (trusted === undefined) {
    return createStage4GameState({ account, currentAttempt: createAttemptState(input) });
  }
  if (!isAuthenticTrustedMigrationResult(trusted)) {
    throw new Error('Legacy Runtime reconstruction requires authentic migration authority.');
  }
  const attempt = Object.freeze(input);
  return Object.freeze({ account, currentAttempt: attempt });
}

export function reconstructStage4RuntimeFromValidatedV3(
  result: Extract<ValidateSaveDocumentV3Result, { readonly status: 'validated' }>,
): Stage4GameState {
  return reconstruct(result.document);
}

export function reconstructStage4RuntimeFromTrustedMigration(
  result: Extract<TrustedMigratedSaveDocumentV3Result, { readonly status: 'validated' }>,
): Stage4GameState {
  if (!isAuthenticTrustedMigrationResult(result)) {
    throw new Error('Legacy Runtime reconstruction requires authentic migration authority.');
  }
  const trustedDocument = getAuthenticTrustedMigrationDocument(result);
  if (trustedDocument === undefined) {
    throw new Error('Trusted migration snapshot is unavailable.');
  }
  return reconstruct(trustedDocument, result);
}
