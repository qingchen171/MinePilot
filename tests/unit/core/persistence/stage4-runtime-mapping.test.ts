import { describe, expect, it } from 'vitest';
import { createLevelCatalog } from '../../../../src/core/level-catalog';
import { createCompleteAttempt } from '../../../../src/core/stage4-attempt-factory';
import { createStage4AccountState } from '../../../../src/core/stage4-account';
import { createStage4GameState } from '../../../../src/core/stage4-game-state';
import {
  mapStage4RuntimeToSaveV3,
  reconstructStage4RuntimeFromTrustedMigration,
  reconstructStage4RuntimeFromValidatedV3,
} from '../../../../src/core/persistence/stage4-runtime-mapping';
import { migrateOldSaveDocumentToV3, validateSaveDocumentV3 } from '../../../../src/core/persistence/save-v3';
import { createBoard, createCellState } from '../../../../src/core/board';
import { createRunState, createWaitingPosition } from '../../../../src/core/run';
import { createAttemptState } from '../../../../src/core/attempt-state';

function runtime() {
  const catalog = createLevelCatalog([{
    levelId: ' level-001 ', board: { dimensions: { width: 2, height: 2 }, mineCount: 1, obstacleCoordinates: [] },
    rewards: { rewardCount: 1, oneTimeClaimId: null, payloads: [{ weight: 100, payload: { kind: 'coins', amount: 1 } }] },
  }]);
  if (catalog.status !== 'created') throw new Error('fixture');
  const attempt = createCompleteAttempt({ level: catalog.catalog.levels[0]!, runId: ' run-001 ', generationProvenance: { seed: 2, rngVersion: 'rng-v1', generationVersion: 'generation-v1' } });
  if (attempt.status !== 'created') throw new Error('fixture');
  return createStage4GameState({
    account: createStage4AccountState({
      inventory: { lucky: 1, detection: 2, airplane: 3, revive: 4 }, coins: 5,
      completedLevelIds: [' completed-001 '], oneTimeClaimIds: [],
      benbenByLevel: [{ levelId: ' benben-001 ', failureStreak: 2, status: 'unavailable' }],
    }),
    currentAttempt: attempt.attempt,
  });
}

describe('dormant Stage4 Runtime and Save v3 mapping', () => {
  it('round-trips every durable fact with explicit revision and no aliases', () => {
    const source = runtime();
    const mapped = mapStage4RuntimeToSaveV3(source, 12);
    expect(mapped.status).toBe('mapped');
    if (mapped.status !== 'mapped') return;
    expect(mapped.document.revision).toBe(12);
    expect(mapped.document.account.coins).toBe(5);
    expect(mapped.document.account.benbenByLevel[0]?.levelId).toBe(' benben-001 ');
    expect(mapped.document.currentAttempt?.runId).toBe(' run-001 ');
    expect(mapped.document.currentAttempt?.rewards).toHaveLength(1);
    const validated = validateSaveDocumentV3(mapped.document);
    expect(validated.status).toBe('validated');
    if (validated.status !== 'validated') return;
    const restored = reconstructStage4RuntimeFromValidatedV3(validated);
    expect(restored).toEqual(source);
    expect(restored).not.toBe(source);
    expect(restored.account).not.toBe(source.account);
    expect(restored.currentAttempt?.run.board).not.toBe(source.currentAttempt?.run.board);
  });

  it('isolates nested Runtime facts from subsequent mapped DTO mutation', () => {
    const source = runtime();
    const sourceAttempt = source.currentAttempt;
    if (sourceAttempt === null) throw new Error('fixture');
    const mapped = mapStage4RuntimeToSaveV3(source, 12);
    if (mapped.status !== 'mapped' || mapped.document.currentAttempt === null) throw new Error('fixture');
    const mutable = mapped.document as unknown as {
      account: { inventory: { lucky: number }; completedLevelIds: string[]; benbenByLevel: Array<{ levelId: string }> };
      currentAttempt: { generationProvenance: { seed: number } | null; rewards: Array<{ claimed: boolean; coordinate: { x: number } }> };
    };
    mutable.account.inventory.lucky = 99;
    mutable.account.completedLevelIds[0] = 'changed';
    mutable.account.benbenByLevel[0] = { levelId: 'changed' };
    if (mutable.currentAttempt.generationProvenance !== null) mutable.currentAttempt.generationProvenance.seed = 99;
    mutable.currentAttempt.rewards[0] = { ...mutable.currentAttempt.rewards[0]!, claimed: true, coordinate: { x: 99 } };
    expect(source.account.inventory.lucky).toBe(1);
    expect(source.account.completedLevelIds).toEqual([' completed-001 ']);
    expect(source.account.benbenByLevel[0]?.levelId).toBe(' benben-001 ');
    expect(sourceAttempt.generationProvenance?.seed).toBe(2);
    expect(sourceAttempt.rewards[0]?.claimed).toBe(false);
  });

  it('isolates reconstructed Runtime from subsequent validated DTO mutation', () => {
    const mapped = mapStage4RuntimeToSaveV3(runtime(), 12);
    if (mapped.status !== 'mapped') throw new Error('fixture');
    const validated = validateSaveDocumentV3(mapped.document);
    if (validated.status !== 'validated' || validated.document.currentAttempt === null) throw new Error('fixture');
    const restored = reconstructStage4RuntimeFromValidatedV3(validated);
    const mutable = validated.document as unknown as {
      account: { inventory: { lucky: number }; completedLevelIds: string[]; benbenByLevel: Array<{ levelId: string }> };
      currentAttempt: { generationProvenance: { seed: number } | null; rewards: Array<{ coordinate: { x: number } }> };
    };
    mutable.account.inventory.lucky = 99;
    mutable.account.completedLevelIds[0] = 'changed';
    mutable.account.benbenByLevel[0] = { levelId: 'changed' };
    if (mutable.currentAttempt.generationProvenance !== null) mutable.currentAttempt.generationProvenance.seed = 99;
    mutable.currentAttempt.rewards[0] = { coordinate: { x: 99 } };
    expect(restored.account.inventory.lucky).toBe(1);
    expect(restored.account.completedLevelIds).toEqual([' completed-001 ']);
    expect(restored.account.benbenByLevel[0]?.levelId).toBe(' benben-001 ');
    expect(restored.currentAttempt?.generationProvenance?.seed).toBe(2);
    expect(restored.currentAttempt?.rewards[0]?.coordinate.x).not.toBe(99);
  });

  it('supports account-only without manufacturing an Attempt', () => {
    const source = createStage4GameState({ account: runtime().account, currentAttempt: null });
    const mapped = mapStage4RuntimeToSaveV3(source, 0);
    expect(mapped).toMatchObject({ status: 'mapped', document: { revision: 0, currentAttempt: null } });
  });

  it('preserves exact padded IDs without normalization', () => {
    const mapped = mapStage4RuntimeToSaveV3(runtime(), 1);
    expect(mapped.status === 'mapped' && mapped.document.account.completedLevelIds).toEqual([' completed-001 ']);
  });

  it.each([false, true])('maps a temporary card consumed=%s rather than dropping it', (consumed) => {
    const source = runtime();
    if (source.currentAttempt === null) throw new Error('fixture');
    const account = createStage4AccountState({
      ...source.account,
      benbenByLevel: [{ levelId: source.currentAttempt.levelId, failureStreak: 0, status: 'used' }],
    });
    const currentAttempt = createAttemptState({ ...source.currentAttempt, temporaryBenbenCard: { item: 'revive', consumed } });
    const mapped = mapStage4RuntimeToSaveV3(createStage4GameState({ account, currentAttempt }), 2);
    expect(mapped.status === 'mapped' && mapped.document.currentAttempt?.temporaryBenbenCard).toEqual({ item: 'revive', consumed });
  });

  it.each(['pending-mine-encounter', 'failed'] as const)('round-trips %s lifecycle facts', (kind) => {
    const source = runtime();
    if (source.currentAttempt === null) throw new Error('fixture');
    const board = source.currentAttempt.run.board;
    const mineIndex = board.cells.findIndex((cell) => cell.kind === 'mine');
    const target = { x: mineIndex % board.dimensions.width, y: Math.floor(mineIndex / board.dimensions.width) };
    const run = createRunState(board, createWaitingPosition(), {
      hasTakenStep: true,
      phase: { kind, encounter: { target, occurredOnFirstStep: true } },
    });
    const currentAttempt = createAttemptState({
      ...source.currentAttempt,
      run,
      terminalDisposition: kind === 'failed' ? 'settled' : 'not-applicable',
    });
    const aggregate = createStage4GameState({ account: source.account, currentAttempt });
    const mapped = mapStage4RuntimeToSaveV3(aggregate, 10);
    expect(mapped.status).toBe('mapped');
    if (mapped.status !== 'mapped') return;
    const validated = validateSaveDocumentV3(mapped.document);
    if (validated.status !== 'validated') throw new Error('fixture');
    expect(reconstructStage4RuntimeFromValidatedV3(validated)).toEqual(aggregate);
  });

  it('maps settled terminal disposition and complete Account facts', () => {
    const source = runtime();
    if (source.currentAttempt === null) throw new Error('fixture');
    const cells = source.currentAttempt.run.board.cells.map((cell) => cell.kind === 'safe'
      ? createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false })
      : cell);
    const board = createBoard(source.currentAttempt.run.board.dimensions, cells);
    const run = createRunState(board, createWaitingPosition(), { hasTakenStep: true, phase: { kind: 'won' } });
    const rewards = source.currentAttempt.rewards.map((reward) => ({ ...reward, claimed: true }));
    const currentAttempt = createAttemptState({ ...source.currentAttempt, run, rewards, terminalDisposition: 'settled' });
    const account = createStage4AccountState({ ...source.account, completedLevelIds: [source.currentAttempt.levelId] });
    const mapped = mapStage4RuntimeToSaveV3(createStage4GameState({ account, currentAttempt }), 8);
    expect(mapped.status === 'mapped' && mapped.document.currentAttempt?.terminalDisposition).toBe('settled');
  });

  it('rejects migration-only legacy Runtime from the writable mapper', () => {
    const migrated = migrateOldSaveDocumentToV3({
      saveVersion: 1, revision: 4, activeRun: {
        runId: 'old-run', levelId: 'old-level',
        board: { dimensions: { width: 1, height: 1 }, cells: [{ terrain: 'playable', containsMine: true, explored: false, mineRevealed: false, flagged: false }] },
        characterPosition: { kind: 'waiting' }, hasTakenStep: true,
        phase: { kind: 'failed', encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true } },
      },
    });
    expect(migrated.status).toBe('validated');
    if (migrated.status !== 'validated') return;
    const restored = reconstructStage4RuntimeFromTrustedMigration(migrated);
    expect(mapStage4RuntimeToSaveV3(restored, 5)).toEqual({ status: 'not-writable', reason: 'legacy-excluded-attempt' });
  });

  it('ordinary direct v3 rejects legacy-excluded even when it looks committed', () => {
    const mapped = mapStage4RuntimeToSaveV3(runtime(), 7);
    if (mapped.status !== 'mapped' || mapped.document.currentAttempt === null) throw new Error('fixture');
    const direct = { ...mapped.document, currentAttempt: { ...mapped.document.currentAttempt, terminalDisposition: 'legacy-excluded' } };
    expect(validateSaveDocumentV3(direct)).toMatchObject({ status: 'invalid', issues: [{ code: 'invalid-terminal-disposition' }] });
  });

  it('rejects direct won v3 legacy-excluded', () => {
    const source = runtime();
    if (source.currentAttempt === null) throw new Error('fixture');
    const cells = source.currentAttempt.run.board.cells.map((cell) => cell.kind === 'safe'
      ? createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false })
      : cell);
    const run = createRunState(createBoard(source.currentAttempt.run.board.dimensions, cells), createWaitingPosition(), {
      hasTakenStep: true, phase: { kind: 'won' },
    });
    const rewards = source.currentAttempt.rewards.map((reward) => ({ ...reward, claimed: true }));
    const currentAttempt = createAttemptState({ ...source.currentAttempt, run, rewards, terminalDisposition: 'settled' });
    const account = createStage4AccountState({ ...source.account, completedLevelIds: [source.currentAttempt.levelId] });
    const mapped = mapStage4RuntimeToSaveV3(createStage4GameState({ account, currentAttempt }), 3);
    if (mapped.status !== 'mapped' || mapped.document.currentAttempt === null) throw new Error('fixture');
    const direct = { ...mapped.document, currentAttempt: { ...mapped.document.currentAttempt, terminalDisposition: 'legacy-excluded' } };
    expect(validateSaveDocumentV3(direct)).toMatchObject({ status: 'invalid', issues: [{ code: 'legacy-migration-required' }] });
  });

  it('rejects forged structural migration authority at runtime', () => {
    expect(() => reconstructStage4RuntimeFromTrustedMigration(
      { status: 'validated', document: {} } as never,
    )).toThrow();
  });

  it('uses a private trusted snapshot despite post-validation output mutation', () => {
    const migrated = migrateOldSaveDocumentToV3({ saveVersion: 1, revision: 0, activeRun: null });
    expect(migrated.status).toBe('validated');
    if (migrated.status !== 'validated') return;
    (migrated.document.account.inventory as { lucky: number }).lucky = 99;
    expect(reconstructStage4RuntimeFromTrustedMigration(migrated).account.inventory.lucky).toBe(0);
  });
});
