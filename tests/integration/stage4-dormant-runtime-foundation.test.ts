import { describe, expect, it } from 'vitest';
import { createInitialBoard } from '../../src/core/initial-board';
import { createAccountState } from '../../src/core/account';
import { createGameState } from '../../src/core/game-state';
import { serializeSaveDocumentV2 } from '../../src/core/persistence/save-v2';
import { createInitialRunItemState } from '../../src/core/run-item-state';
import { createWaitingRunState } from '../../src/core/run';
import { readDormantStage4Runtime } from '../../src/systems/persistence/dormant-stage4-reader';
import { mapStage4RuntimeToSaveV3 } from '../../src/core/persistence/stage4-runtime-mapping';

function selected(serializedPayload: string, revision: number, source: 'head' | 'head-backup' = 'head') {
  return source === 'head'
    ? { status: 'loaded' as const, source, slot: 'A' as const, revision, serializedPayload }
    : { status: 'recovered-from-backup' as const, source, slot: 'B' as const, revision, serializedPayload };
}

describe('dormant selected-snapshot Stage4 reader', () => {
  it('distinguishes no-save fresh bootstrap from committed revision zero', () => {
    const fresh = readDormantStage4Runtime({ status: 'no-save' });
    expect(fresh).toMatchObject({ status: 'fresh', persistence: { kind: 'no-save' }, runtime: { currentAttempt: null } });
    if (fresh.status !== 'fresh') return;
    expect(fresh.runtime.account.inventory).toEqual({ lucky: 1, detection: 2, airplane: 1, revive: 1 });
    const mapped = mapStage4RuntimeToSaveV3(fresh.runtime, 0);
    if (mapped.status !== 'mapped') throw new Error('fixture');
    const loaded = readDormantStage4Runtime(selected(JSON.stringify(mapped.document), 0));
    expect(loaded).toMatchObject({ status: 'loaded', persistence: { kind: 'committed', revision: 0 } });
  });

  it('migrates selected v2 read-only and preserves historical inventory without fresh bonuses', () => {
    const board = createInitialBoard({ dimensions: { width: 1, height: 1 }, mineCoordinates: [], obstacleCoordinates: [] });
    if (board.status !== 'created') throw new Error('fixture');
    const v2 = serializeSaveDocumentV2({
      revision: 3,
      activeRun: {
        runId: 'historical-run', levelId: 'unknown-historical-level',
        gameState: createGameState({
          account: createAccountState({ lucky: 9, detection: 8, airplane: 7, revive: 6 }),
          run: createWaitingRunState(board.board),
          runItems: createInitialRunItemState(null),
        }),
      },
    });
    if (v2.status !== 'serialized') throw new Error('fixture');
    const loaded = readDormantStage4Runtime(selected(JSON.stringify(v2.document), 3, 'head-backup'));
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.runtime.account.inventory).toEqual({ lucky: 9, detection: 8, airplane: 7, revive: 6 });
    expect(loaded.runtime.account.completedLevelIds).toEqual([]);
    expect(loaded.runtime.currentAttempt?.levelId).toBe('unknown-historical-level');
    expect(loaded.runtime.currentAttempt?.rewards).toEqual([]);
    expect(loaded.persistence.source).toBe('head-backup');
  });

  it('migrates selected v1 through v2 to v3 without fresh bonuses or writes', () => {
    const loaded = readDormantStage4Runtime(selected(JSON.stringify({
      saveVersion: 1, revision: 6, activeRun: null,
    }), 6));
    expect(loaded).toMatchObject({
      status: 'loaded',
      persistence: { kind: 'committed', revision: 6 },
      runtime: {
        account: { inventory: { lucky: 0, detection: 0, airplane: 0, revive: 0 } },
        currentAttempt: null,
      },
    });
  });

  it.each([
    ['invalid json', selected('{', 0), 'invalid-json'],
    ['revision mismatch', selected(JSON.stringify({ saveVersion: 3 }), 9), 'invalid-save'],
    ['corrupt authority', { status: 'corrupt' as const, reason: 'no-provable-committed-snapshot' as const }, 'unavailable-snapshot'],
  ])('rejects %s without inventing authority', (_name, input, status) => {
    expect(readDormantStage4Runtime(input as never).status).toBe(status);
  });

  it.each(['head', 'head-backup'] as const)('never treats direct committed v3 legacy as trusted from %s', (source) => {
    const legacy = {
      saveVersion: 3, revision: 5,
      account: { inventory: { lucky: 0, detection: 0, airplane: 0, revive: 0 }, coins: 0, completedLevelIds: [], oneTimeClaimIds: [], benbenByLevel: [] },
      currentAttempt: {
        runId: 'run-old', levelId: 'level-old', generationProvenance: null,
        run: {
          board: { dimensions: { width: 1, height: 1 }, cells: [{ terrain: 'playable', containsMine: true, explored: false, mineRevealed: false, flagged: false }] },
          characterPosition: { kind: 'waiting' }, hasTakenStep: true,
          phase: { kind: 'failed', encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true } },
        },
        runItems: { successfulDetectionUses: 0, successfulAirplaneUses: 0, successfulReviveUses: 0, detectionRandomSeed: null },
        rewards: [], temporaryBenbenCard: null, terminalDisposition: 'legacy-excluded',
      },
    };
    expect(readDormantStage4Runtime(selected(JSON.stringify(legacy), 5, source))).toMatchObject({
      status: 'invalid-save', issues: [{ code: 'legacy-migration-required' }],
    });
  });
});
