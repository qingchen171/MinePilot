import type { RunPhase } from './run';

export type TerminalDisposition = 'not-applicable' | 'settled' | 'legacy-excluded';
export type GameplayTerminalDisposition = Exclude<TerminalDisposition, 'legacy-excluded'>;

export function isTerminalDisposition(value: unknown): value is TerminalDisposition {
  return value === 'not-applicable' || value === 'settled' || value === 'legacy-excluded';
}

export function isTerminalDispositionLegalForRunPhase(
  phase: RunPhase,
  disposition: TerminalDisposition,
): boolean {
  const terminal = phase.kind === 'won' || phase.kind === 'failed';
  return terminal ? disposition !== 'not-applicable' : disposition === 'not-applicable';
}

/** Normal gameplay cannot create the migration-only legacy exclusion. */
export function createGameplayTerminalDisposition(
  phase: RunPhase,
  disposition: unknown,
): GameplayTerminalDisposition {
  if (disposition !== 'not-applicable' && disposition !== 'settled') {
    throw new Error('Gameplay terminal disposition must not be legacy-excluded.');
  }
  if (!isTerminalDispositionLegalForRunPhase(phase, disposition)) {
    throw new Error('Terminal disposition is incompatible with the Run phase.');
  }
  return disposition;
}
