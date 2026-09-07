import { describe, expect, it, vi } from 'vitest';
import { createAccountState } from '../../src/core/account';
import { createCoordinate } from '../../src/core/board';
import { resolvePendingMineEncounterAsSurvived } from '../../src/core/encounter';
import { createGameState } from '../../src/core/game-state';
import { createInitialBoard } from '../../src/core/initial-board';
import { createPendingMineEncounterRunState, createWaitingRunState } from '../../src/core/run';
import { createInitialRunItemState } from '../../src/core/run-item-state';
import { serializeSaveDocumentV2, validateAndLoadSaveDocumentV2 } from '../../src/core/persistence/save-v2';

describe('encounter primitive GameState and Save v2 composition', () => {
  it('creates a pure composition result and round-trips through the existing explicit v2 mapper', () => {
    const storageAccess = vi.fn(() => { throw new Error('Primitive must not access browser storage'); });
    vi.stubGlobal('localStorage', { getItem: storageAccess, setItem: storageAccess, removeItem: storageAccess });
    try {
      const assembled = createInitialBoard({ dimensions: { width: 2, height: 1 }, obstacleCoordinates: [], mineCoordinates: [createCoordinate(1, 0)] });
      if (assembled.status !== 'created') throw new Error('Expected Board');
      const before = createGameState({
        account: createAccountState({ lucky: 2, detection: 3, airplane: 1, revive: 1 }),
        run: createPendingMineEncounterRunState(createWaitingRunState(assembled.board), createCoordinate(1, 0)),
        runItems: createInitialRunItemState(null),
      });
      const result = resolvePendingMineEncounterAsSurvived(before.run);
      if (result.outcome !== 'resolved') throw new Error('Expected resolved');
      const candidate = createGameState({ ...before, run: result.state });
      expect(candidate.account).toEqual(before.account);
      expect(candidate.runItems).toEqual(before.runItems);
      expect(before.run.phase.kind).toBe('pending-mine-encounter');
      expect(storageAccess).not.toHaveBeenCalled();
      const serialized = serializeSaveDocumentV2({ revision: 12, activeRun: { runId: 'same-run', levelId: 'same-level', gameState: candidate } });
      if (serialized.status !== 'serialized') throw new Error('Expected serialized');
      const loaded = validateAndLoadSaveDocumentV2(JSON.parse(JSON.stringify(serialized.document)));
      if (loaded.status !== 'loaded' || loaded.activeRun === null) throw new Error('Expected loaded');
      expect(loaded.document.revision).toBe(12);
      expect(loaded.activeRun.gameState).toEqual(candidate);
      expect(loaded.activeRun.gameState).not.toBe(candidate);
      expect(loaded.activeRun.gameState.run.board).not.toBe(candidate.run.board);
      expect(loaded.activeRun.gameState.run.characterPosition).toEqual({ kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 } });
      expect(storageAccess).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
