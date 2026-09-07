import { createAccountState, type AccountState } from '../../src/core/account';
import { createGameState } from '../../src/core/game-state';
import type { ActiveRunPersistenceInputV1 } from '../../src/core/persistence/save-v1';
import {
  type ActiveRunPersistenceInputV2,
  type SaveDocumentPersistenceInputV2,
} from '../../src/core/persistence/save-v2';
import { createInitialRunItemState } from '../../src/core/run-item-state';

export function createTestAccount(): AccountState {
  return createAccountState({ lucky: 0, detection: 0, airplane: 0, revive: 0 });
}

export function activeRunV2FromV1(
  input: ActiveRunPersistenceInputV1,
  account: AccountState = createTestAccount(),
): ActiveRunPersistenceInputV2 {
  return {
    runId: input.runId,
    levelId: input.levelId,
    gameState: createGameState({
      account,
      run: input.run,
      runItems: createInitialRunItemState(input.generationProvenance?.seed ?? null),
    }),
    ...(input.generationProvenance === undefined
      ? {}
      : { generationProvenance: input.generationProvenance }),
  };
}

export function emptySaveCandidateV2(revision: number): SaveDocumentPersistenceInputV2 {
  return { revision, account: createTestAccount(), activeRun: null };
}
