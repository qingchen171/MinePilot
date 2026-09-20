import { createStableId } from './stable-id';
import { createRunItemState, type RunItemState } from './run-item-state';
import { createRunState, type RunState } from './run';
import { createRewardState, getRewardBoardCompatibilityIssue, type RewardState } from './reward';
import { createTemporaryBenbenCard, type TemporaryBenbenCard } from './temporary-benben-card';
import { createGameplayTerminalDisposition, type TerminalDisposition } from './terminal-disposition';

export interface GenerationProvenance {
  readonly seed: number;
  readonly rngVersion: string;
  readonly generationVersion: string;
}

export interface AttemptState {
  readonly runId: string;
  readonly levelId: string;
  readonly generationProvenance: GenerationProvenance | null;
  readonly run: RunState;
  readonly runItems: RunItemState;
  readonly rewards: readonly RewardState[];
  readonly temporaryBenbenCard: TemporaryBenbenCard | null;
  readonly terminalDisposition: TerminalDisposition;
}

export interface AttemptStateInput extends AttemptState {}

function provenance(value: GenerationProvenance | null): GenerationProvenance | null {
  if (value === null) return null;
  if (!Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffff_ffff) {
    throw new RangeError('Generation seed must be a uint32 integer.');
  }
  return Object.freeze({
    seed: value.seed,
    rngVersion: createStableId(value.rngVersion, 'RNG version'),
    generationVersion: createStableId(value.generationVersion, 'Generation version'),
  });
}

function construct(input: AttemptStateInput, trustedLegacy: boolean): AttemptState {
  const run = createRunState(input.run.board, input.run.characterPosition, {
    hasTakenStep: input.run.hasTakenStep,
    phase: input.run.phase,
  });
  const rewards = input.rewards.map(createRewardState);
  const coordinates = new Set<string>();
  const claims = new Set<string>();
  for (const reward of rewards) {
    const key = `${reward.coordinate.x},${reward.coordinate.y}`;
    if (coordinates.has(key)) throw new Error('Reward coordinates must be unique.');
    coordinates.add(key);
    if (getRewardBoardCompatibilityIssue(reward, run.board) !== null) {
      throw new Error('Reward must be compatible with the authoritative Board.');
    }
    if (reward.oneTimeClaimId !== null) {
      if (claims.has(reward.oneTimeClaimId)) throw new Error('Attempt one-time claim IDs must be unique.');
      claims.add(reward.oneTimeClaimId);
    }
  }
  const terminalDisposition = input.terminalDisposition === 'legacy-excluded'
    ? (trustedLegacy ? 'legacy-excluded' : (() => { throw new Error('Legacy-excluded Attempt requires trusted migration.'); })())
    : createGameplayTerminalDisposition(run.phase, input.terminalDisposition);
  const temporaryBenbenCard = input.temporaryBenbenCard === null
    ? null
    : createTemporaryBenbenCard(input.temporaryBenbenCard);
  if (temporaryBenbenCard !== null && (run.phase.kind === 'won' || run.phase.kind === 'failed')) {
    throw new Error('A terminal Attempt cannot retain a temporary Benben card.');
  }
  return Object.freeze({
    runId: createStableId(input.runId, 'Run ID'),
    levelId: createStableId(input.levelId, 'Level ID'),
    generationProvenance: provenance(input.generationProvenance),
    run,
    runItems: createRunItemState(input.runItems),
    rewards: Object.freeze(rewards),
    temporaryBenbenCard,
    terminalDisposition,
  });
}

export function createAttemptState(input: AttemptStateInput): AttemptState {
  return construct(input, false);
}

/** Only the Save-v3 reconstruction module may use this after a branded old-save migration. */
