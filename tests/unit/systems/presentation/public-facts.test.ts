import { describe, expect, it } from 'vitest';
import { createInitialBoard } from '../../../../src/core/initial-board';
import { createStage4GameState } from '../../../../src/core/stage4-game-state';
import { createInitialStage4AccountState } from '../../../../src/core/stage4-account';
import { createCompleteAttempt } from '../../../../src/core/stage4-attempt-factory';
import { PRODUCTION_LEVEL_CATALOG } from '../../../../src/core/level-catalog';
import { sanitizeStage4Runtime } from '../../../../src/systems/presentation/public-facts';
import { projectPublicFacts } from '../../../../src/ui/presentation-projection';
import { createWaitingRunState, createOnBoardPosition, createRunState } from '../../../../src/core/run';
import { createInitialRunItemState } from '../../../../src/core/run-item-state';
import { createStage4AccountState } from '../../../../src/core/stage4-account';

describe('S5-02 public facts and pure projection', () => {
  it('makes unknown Safe/Mine identical and excludes hidden Reward, seed, provenance and aliases', () => {
    const made = createCompleteAttempt({
      level: PRODUCTION_LEVEL_CATALOG.levels[0]!, runId: 'private-run-id',
      generationProvenance: { seed: 123456789, rngVersion: 'private-rng', generationVersion: 'private-generation' },
    });
    if (made.status !== 'created') throw new Error('fixture');
    const runtime = createStage4GameState({ account: createInitialStage4AccountState(), currentAttempt: made.attempt });
    const facts = sanitizeStage4Runtime(runtime);
    const cells = made.attempt.run.board.cells;
    const safe = cells.findIndex((cell) => cell.kind === 'safe');
    const mine = cells.findIndex((cell) => cell.kind === 'mine');
    expect(facts.attempt?.board.cells[safe]).toBe('unknown');
    expect(facts.attempt?.board.cells[mine]).toBe('unknown');
    expect(Object.keys(facts)).toEqual(['account', 'attempt']);
    expect(Object.keys(facts.attempt ?? {})).toEqual(['levelId', 'phase', 'hasTakenStep', 'position', 'board', 'currentMineCount', 'itemUses']);
    const exposed = JSON.stringify(facts);
    for (const secret of ['private-run-id', 'private-rng', 'private-generation', '123456789', 'rewards', 'oneTimeClaimId', 'generationProvenance']) {
      expect(exposed).not.toContain(secret);
    }
    expect(facts.attempt?.board.cells).not.toBe(made.attempt.run.board.cells);
    const view = projectPublicFacts(facts);
    expect(view).not.toBe(facts);
    expect(view.attempt?.board.cells).not.toBe(facts.attempt?.board.cells);
    expect(Object.isFrozen(view.attempt?.board.cells)).toBe(true);
    expect(projectPublicFacts(facts)).toEqual(view);
  });

  it('uses the current-cell core query and reserves zero for safety feedback', () => {
    const created = createInitialBoard({ dimensions: { width: 1, height: 1 }, obstacleCoordinates: [], mineCoordinates: [] });
    if (created.status !== 'created') throw new Error('fixture');
    const waiting = createWaitingRunState(created.board);
    const run = createRunState({ ...created.board, cells: [{ kind: 'safe', exploration: 'explored', flagged: false }] },
      createOnBoardPosition({ x: 0, y: 0 }), { hasTakenStep: true, phase: { kind: 'won' } });
    const runtime = createStage4GameState({
      account: createStage4AccountState({ ...createInitialStage4AccountState(), completedLevelIds: ['level-1'] }),
      currentAttempt: {
        runId: 'run-1', levelId: 'level-1', generationProvenance: null, run,
        runItems: createInitialRunItemState(null), rewards: [], temporaryBenbenCard: null,
        terminalDisposition: 'settled',
      },
    });
    expect(waiting.characterPosition.kind).toBe('waiting');
    const facts = sanitizeStage4Runtime(runtime);
    expect(facts.attempt?.currentMineCount).toBe(0);
    expect(projectPublicFacts(facts).currentNumberDisplay).toEqual({ kind: 'zero-feedback', value: null });
  });
});
