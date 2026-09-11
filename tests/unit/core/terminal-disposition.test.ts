import { describe, expect, it } from 'vitest';
import type { RunPhase } from '../../../src/core/run';
import {
  createGameplayTerminalDisposition,
  isTerminalDispositionLegalForRunPhase,
  type TerminalDisposition,
} from '../../../src/core/terminal-disposition';

const phases: readonly [RunPhase, boolean][] = [
  [{ kind: 'active' }, false],
  [{ kind: 'pending-mine-encounter', encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true } }, false],
  [{ kind: 'failed', encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true } }, true],
  [{ kind: 'won' }, true],
];

describe('Terminal disposition runtime foundation', () => {
  it.each(phases)('recognizes legal disposition combinations for $phase.kind', (phase, terminal) => {
    const dispositions: readonly TerminalDisposition[] = ['not-applicable', 'settled', 'legacy-excluded'];
    for (const disposition of dispositions) {
      expect(isTerminalDispositionLegalForRunPhase(phase, disposition)).toBe(
        terminal ? disposition !== 'not-applicable' : disposition === 'not-applicable',
      );
    }
  });

  it('constructs only normal gameplay dispositions that match the Run phase', () => {
    expect(createGameplayTerminalDisposition({ kind: 'active' }, 'not-applicable')).toBe('not-applicable');
    expect(createGameplayTerminalDisposition({ kind: 'won' }, 'settled')).toBe('settled');
    expect(() => createGameplayTerminalDisposition({ kind: 'active' }, 'settled')).toThrow('incompatible');
    expect(() => createGameplayTerminalDisposition({ kind: 'won' }, 'not-applicable')).toThrow('incompatible');
  });

  it('does not expose legacy-excluded as a normal gameplay construction path', () => {
    expect(() => createGameplayTerminalDisposition({ kind: 'failed', encounter: {
      target: { x: 0, y: 0 }, occurredOnFirstStep: true,
    } }, 'legacy-excluded')).toThrow('must not be legacy-excluded');
  });
});
