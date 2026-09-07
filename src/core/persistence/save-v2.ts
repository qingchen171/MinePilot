import { createAccountState, type AccountState, type ItemInventoryState } from '../account';
import { createCoordinate, type Coordinate } from '../board';
import { createGameState, type GameState } from '../game-state';
import { createRunItemState, type RunItemState } from '../run-item-state';
import {
  createRevealedMineOccupancyPosition,
  createRunState,
  createWaitingPosition,
  type CharacterPosition,
  type RunState,
} from '../run';
import {
  serializeSaveDocumentV1,
  validateAndLoadSaveDocumentV1,
  type BoardSaveV1,
  type CharacterPositionSaveV1,
  type GenerationProvenanceSaveV1,
  type RunPhaseSaveV1,
  type SaveDocumentV1,
  type SaveV1ValidationIssue,
  type SaveV1ValidationIssueCode,
} from './save-v1';

export interface ItemInventorySaveV2 {
  readonly lucky: number;
  readonly detection: number;
  readonly airplane: number;
  readonly revive: number;
}

export interface AccountSaveV2 {
  readonly inventory: ItemInventorySaveV2;
}

export interface RunItemStateSaveV2 {
  readonly successfulDetectionUses: number;
  readonly successfulAirplaneUses: number;
  readonly successfulReviveUses: number;
  readonly detectionRandomSeed: number | null;
}

export type CharacterPositionSaveV2 =
  | CharacterPositionSaveV1
  | {
      readonly kind: 'revealed-mine-occupancy';
      readonly coordinate: { readonly x: number; readonly y: number };
    };

export interface ActiveRunSaveV2 {
  readonly runId: string;
  readonly levelId: string;
  readonly board: BoardSaveV1;
  readonly characterPosition: CharacterPositionSaveV2;
  readonly hasTakenStep: boolean;
  readonly phase: RunPhaseSaveV1;
  readonly runItems: RunItemStateSaveV2;
  readonly generationProvenance?: GenerationProvenanceSaveV1;
}

export interface SaveDocumentV2 {
  readonly saveVersion: 2;
  readonly revision: number;
  readonly account: AccountSaveV2;
  readonly activeRun: ActiveRunSaveV2 | null;
}

export interface ActiveRunPersistenceInputV2 {
  readonly runId: string;
  readonly levelId: string;
  readonly gameState: GameState;
  readonly generationProvenance?: GenerationProvenanceSaveV1;
}

export type SaveDocumentPersistenceInputV2 =
  | {
      readonly revision: number;
      readonly account: AccountState;
      readonly activeRun: null;
    }
  | {
      readonly revision: number;
      readonly activeRun: ActiveRunPersistenceInputV2;
    };

export interface LoadedActiveRunV2 {
  readonly runId: string;
  readonly levelId: string;
  readonly gameState: GameState;
  readonly generationProvenance?: GenerationProvenanceSaveV1;
}

export type SaveV2ValidationIssueCode =
  | SaveV1ValidationIssueCode
  | 'invalid-account'
  | 'invalid-inventory'
  | 'invalid-run-items';

export interface SaveV2ValidationIssue {
  readonly code: SaveV2ValidationIssueCode;
  readonly path: string;
  readonly detail?: SaveV1ValidationIssue['detail'];
}

export type SerializeSaveDocumentV2Result =
  | { readonly status: 'serialized'; readonly document: SaveDocumentV2 }
  | { readonly status: 'invalid'; readonly issues: readonly SaveV2ValidationIssue[] };

export type ValidateAndLoadSaveDocumentV2Result =
  | {
      readonly status: 'loaded';
      readonly document: SaveDocumentV2;
      readonly account: AccountState;
      readonly activeRun: LoadedActiveRunV2 | null;
    }
  | { readonly status: 'invalid'; readonly issues: readonly SaveV2ValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  code: SaveV2ValidationIssueCode,
  path: string,
  detail?: SaveV2ValidationIssue['detail'],
): SaveV2ValidationIssue {
  return detail === undefined ? { code, path } : { code, path, detail };
}

function validateFields(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  missingCode: SaveV2ValidationIssueCode,
): SaveV2ValidationIssue | undefined {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).find((field) => !allowed.has(field));
  if (unknown !== undefined) return issue('unknown-field', `${path}.${unknown}`);
  const missing = required.find((field) => !Object.hasOwn(value, field));
  return missing === undefined ? undefined : issue(missingCode, `${path}.${missing}`);
}

function parseAccount(input: unknown):
  | { readonly account: AccountState }
  | { readonly validationIssue: SaveV2ValidationIssue } {
  if (!isRecord(input)) return { validationIssue: issue('invalid-account', 'account') };
  const accountFields = validateFields(input, ['inventory'], [], 'account', 'invalid-account');
  if (accountFields !== undefined) return { validationIssue: accountFields };
  if (!isRecord(input.inventory)) {
    return { validationIssue: issue('invalid-inventory', 'account.inventory') };
  }
  const inventoryFields = validateFields(
    input.inventory,
    ['lucky', 'detection', 'airplane', 'revive'],
    [],
    'account.inventory',
    'invalid-inventory',
  );
  if (inventoryFields !== undefined) return { validationIssue: inventoryFields };
  try {
    return {
      account: createAccountState({
        lucky: input.inventory.lucky as number,
        detection: input.inventory.detection as number,
        airplane: input.inventory.airplane as number,
        revive: input.inventory.revive as number,
      }),
    };
  } catch {
    return { validationIssue: issue('invalid-inventory', 'account.inventory') };
  }
}

function parseRunItems(input: unknown):
  | { readonly runItems: RunItemState }
  | { readonly validationIssue: SaveV2ValidationIssue } {
  const path = 'activeRun.runItems';
  if (!isRecord(input)) return { validationIssue: issue('invalid-run-items', path) };
  const fields = validateFields(
    input,
    [
      'successfulDetectionUses',
      'successfulAirplaneUses',
      'successfulReviveUses',
      'detectionRandomSeed',
    ],
    [],
    path,
    'invalid-run-items',
  );
  if (fields !== undefined) return { validationIssue: fields };
  try {
    return {
      runItems: createRunItemState({
        successfulDetectionUses: input.successfulDetectionUses as number,
        successfulAirplaneUses: input.successfulAirplaneUses as number,
        successfulReviveUses: input.successfulReviveUses as number,
        detectionRandomSeed: input.detectionRandomSeed as number | null,
      }),
    };
  } catch {
    return { validationIssue: issue('invalid-run-items', path) };
  }
}

function parseOccupancyCoordinate(input: unknown):
  | { readonly coordinate: Coordinate }
  | { readonly validationIssue: SaveV2ValidationIssue } {
  const path = 'activeRun.characterPosition.coordinate';
  if (!isRecord(input)) return { validationIssue: issue('invalid-coordinate', path) };
  const fields = validateFields(input, ['x', 'y'], [], path, 'invalid-coordinate');
  if (fields !== undefined) return { validationIssue: fields };
  if (typeof input.x !== 'number' || typeof input.y !== 'number') {
    return { validationIssue: issue('invalid-coordinate', path) };
  }
  try {
    return { coordinate: createCoordinate(input.x, input.y) };
  } catch {
    return { validationIssue: issue('invalid-coordinate', path) };
  }
}

function parseV2Position(
  input: unknown,
  v1Position: CharacterPosition,
): { readonly position: CharacterPosition } | { readonly validationIssue: SaveV2ValidationIssue } {
  if (!isRecord(input) || input.kind !== 'revealed-mine-occupancy') {
    return { position: v1Position };
  }
  const path = 'activeRun.characterPosition';
  const fields = validateFields(input, ['kind', 'coordinate'], [], path, 'invalid-character-position');
  if (fields !== undefined) return { validationIssue: fields };
  const coordinate = parseOccupancyCoordinate(input.coordinate);
  return 'validationIssue' in coordinate
    ? coordinate
    : { position: createRevealedMineOccupancyPosition(coordinate.coordinate) };
}

function inventoryToDto(inventory: ItemInventoryState): ItemInventorySaveV2 {
  return {
    lucky: inventory.lucky,
    detection: inventory.detection,
    airplane: inventory.airplane,
    revive: inventory.revive,
  };
}

function runItemsToDto(runItems: RunItemState): RunItemStateSaveV2 {
  return {
    successfulDetectionUses: runItems.successfulDetectionUses,
    successfulAirplaneUses: runItems.successfulAirplaneUses,
    successfulReviveUses: runItems.successfulReviveUses,
    detectionRandomSeed: runItems.detectionRandomSeed,
  };
}

function positionToDto(position: CharacterPosition): CharacterPositionSaveV2 {
  if (position.kind === 'waiting') return { kind: 'waiting' };
  return {
    kind: position.kind,
    coordinate: { x: position.coordinate.x, y: position.coordinate.y },
  };
}

function copyProvenance(
  provenance: GenerationProvenanceSaveV1 | undefined,
): GenerationProvenanceSaveV1 | undefined {
  return provenance === undefined
    ? undefined
    : {
        seed: provenance.seed,
        rngVersion: provenance.rngVersion,
        generationVersion: provenance.generationVersion,
      };
}

function sharedRunForV1(run: RunState): RunState {
  return run.characterPosition.kind === 'revealed-mine-occupancy'
    ? createRunState(run.board, createWaitingPosition(), {
        hasTakenStep: run.hasTakenStep,
        phase: run.phase,
      })
    : run;
}

function buildActiveRunDocument(
  revision: number,
  activeRun: ActiveRunPersistenceInputV2,
): { readonly activeRun: ActiveRunSaveV2 } | { readonly issues: readonly SaveV2ValidationIssue[] } {
  let gameState: GameState;
  try {
    gameState = createGameState(activeRun.gameState);
  } catch {
    return { issues: [issue('inconsistent-run', 'activeRun')] };
  }
  const shared = serializeSaveDocumentV1({
    revision,
    activeRun: {
      runId: activeRun.runId,
      levelId: activeRun.levelId,
      run: sharedRunForV1(gameState.run),
      ...(activeRun.generationProvenance === undefined
        ? {}
        : { generationProvenance: activeRun.generationProvenance }),
    },
  });
  if (shared.status === 'invalid') return { issues: shared.issues };
  const sharedActiveRun = shared.document.activeRun;
  if (sharedActiveRun === null) {
    return { issues: [issue('invalid-active-run', 'activeRun')] };
  }
  return {
    activeRun: {
      ...sharedActiveRun,
      characterPosition: positionToDto(gameState.run.characterPosition),
      runItems: runItemsToDto(gameState.runItems),
    },
  };
}

function buildDocumentFromRuntime(
  revision: number,
  account: AccountState,
  activeRun: ActiveRunPersistenceInputV2 | null,
): { readonly document: SaveDocumentV2 } | { readonly issues: readonly SaveV2ValidationIssue[] } {
  if (activeRun === null) {
    const shared = serializeSaveDocumentV1({ revision, activeRun: null });
    if (shared.status === 'invalid') return { issues: shared.issues };
    return {
      document: {
        saveVersion: 2,
        revision: shared.document.revision,
        account: { inventory: inventoryToDto(createAccountState(account.inventory).inventory) },
        activeRun: null,
      },
    };
  }
  const built = buildActiveRunDocument(revision, activeRun);
  if ('issues' in built) return built;
  return {
    document: {
      saveVersion: 2,
      revision,
      account: { inventory: inventoryToDto(activeRun.gameState.account.inventory) },
      activeRun: built.activeRun,
    },
  };
}

function v1ShapeForSharedValidation(input: Record<string, unknown>, revision: number): unknown {
  const position = isRecord(input.characterPosition) &&
    input.characterPosition.kind === 'revealed-mine-occupancy'
    ? { kind: 'waiting' as const }
    : input.characterPosition;
  return {
    saveVersion: 1,
    revision,
    activeRun: {
      runId: input.runId,
      levelId: input.levelId,
      board: input.board,
      characterPosition: position,
      hasTakenStep: input.hasTakenStep,
      phase: input.phase,
      ...(Object.hasOwn(input, 'generationProvenance')
        ? { generationProvenance: input.generationProvenance }
        : {}),
    },
  };
}

function parseActiveRun(
  input: unknown,
  revision: number,
  account: AccountState,
): { readonly activeRun: LoadedActiveRunV2 } | { readonly issues: readonly SaveV2ValidationIssue[] } {
  const path = 'activeRun';
  if (!isRecord(input)) return { issues: [issue('invalid-active-run', path)] };
  const fields = validateFields(
    input,
    ['runId', 'levelId', 'board', 'characterPosition', 'hasTakenStep', 'phase', 'runItems'],
    ['generationProvenance'],
    path,
    'invalid-active-run',
  );
  if (fields !== undefined) return { issues: [fields] };

  const runItems = parseRunItems(input.runItems);
  if ('validationIssue' in runItems) return { issues: [runItems.validationIssue] };
  const shared = validateAndLoadSaveDocumentV1(v1ShapeForSharedValidation(input, revision));
  if (shared.status === 'invalid') return { issues: shared.issues };
  if (shared.activeRun === null) return { issues: [issue('invalid-active-run', path)] };

  const parsedPosition = parseV2Position(
    input.characterPosition,
    shared.activeRun.run.characterPosition,
  );
  if ('validationIssue' in parsedPosition) return { issues: [parsedPosition.validationIssue] };

  let run: RunState;
  let gameState: GameState;
  try {
    run = createRunState(shared.activeRun.run.board, parsedPosition.position, {
      hasTakenStep: shared.activeRun.run.hasTakenStep,
      phase: shared.activeRun.run.phase,
    });
    gameState = createGameState({ account, run, runItems: runItems.runItems });
  } catch {
    return { issues: [issue('inconsistent-run', path)] };
  }
  const provenance = copyProvenance(shared.activeRun.generationProvenance);
  const activeRun: LoadedActiveRunV2 = {
    runId: shared.activeRun.runId,
    levelId: shared.activeRun.levelId,
    gameState,
  };
  return provenance === undefined
    ? { activeRun }
    : { activeRun: { ...activeRun, generationProvenance: provenance } };
}

export function validateAndLoadSaveDocumentV2(
  input: unknown,
): ValidateAndLoadSaveDocumentV2Result {
  if (!isRecord(input)) return { status: 'invalid', issues: [issue('invalid-input', '$')] };
  const fields = validateFields(
    input,
    ['saveVersion', 'revision', 'account', 'activeRun'],
    [],
    '$',
    'invalid-input',
  );
  if (fields !== undefined) return { status: 'invalid', issues: [fields] };
  if (input.saveVersion !== 2) {
    return { status: 'invalid', issues: [issue('invalid-save-version', '$.saveVersion')] };
  }
  if (
    typeof input.revision !== 'number' ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0
  ) {
    return { status: 'invalid', issues: [issue('invalid-revision', '$.revision')] };
  }
  const account = parseAccount(input.account);
  if ('validationIssue' in account) {
    return { status: 'invalid', issues: [account.validationIssue] };
  }
  if (input.activeRun === null) {
    const built = buildDocumentFromRuntime(input.revision, account.account, null);
    return 'issues' in built
      ? { status: 'invalid', issues: built.issues }
      : { status: 'loaded', document: built.document, account: account.account, activeRun: null };
  }
  const activeRun = parseActiveRun(input.activeRun, input.revision, account.account);
  if ('issues' in activeRun) return { status: 'invalid', issues: activeRun.issues };
  const built = buildDocumentFromRuntime(input.revision, account.account, {
    runId: activeRun.activeRun.runId,
    levelId: activeRun.activeRun.levelId,
    gameState: activeRun.activeRun.gameState,
    ...(activeRun.activeRun.generationProvenance === undefined
      ? {}
      : { generationProvenance: activeRun.activeRun.generationProvenance }),
  });
  return 'issues' in built
    ? { status: 'invalid', issues: built.issues }
    : {
        status: 'loaded',
        document: built.document,
        account: account.account,
        activeRun: activeRun.activeRun,
      };
}

export function serializeSaveDocumentV2(
  input: SaveDocumentPersistenceInputV2,
): SerializeSaveDocumentV2Result {
  const account = input.activeRun === null ? input.account : input.activeRun.gameState.account;
  const built = buildDocumentFromRuntime(input.revision, account, input.activeRun);
  if ('issues' in built) return { status: 'invalid', issues: built.issues };
  const loaded = validateAndLoadSaveDocumentV2(built.document);
  return loaded.status === 'invalid'
    ? loaded
    : { status: 'serialized', document: loaded.document };
}

export function migrateValidatedSaveDocumentV1ToV2(document: SaveDocumentV1): SaveDocumentV2 {
  const activeRun = document.activeRun;
  return {
    saveVersion: 2,
    revision: document.revision,
    account: {
      inventory: { lucky: 0, detection: 0, airplane: 0, revive: 0 },
    },
    activeRun: activeRun === null
      ? null
      : {
          runId: activeRun.runId,
          levelId: activeRun.levelId,
          board: {
            dimensions: {
              width: activeRun.board.dimensions.width,
              height: activeRun.board.dimensions.height,
            },
            cells: activeRun.board.cells.map((cell) => ({
              terrain: cell.terrain,
              containsMine: cell.containsMine,
              explored: cell.explored,
              mineRevealed: cell.mineRevealed,
              flagged: cell.flagged,
            })),
          },
          characterPosition: activeRun.characterPosition.kind === 'waiting'
            ? { kind: 'waiting' }
            : {
                kind: 'on-board',
                coordinate: {
                  x: activeRun.characterPosition.coordinate.x,
                  y: activeRun.characterPosition.coordinate.y,
                },
              },
          hasTakenStep: activeRun.hasTakenStep,
          phase: activeRun.phase.kind === 'active' || activeRun.phase.kind === 'won'
            ? { kind: activeRun.phase.kind }
            : {
                kind: activeRun.phase.kind,
                encounter: {
                  target: {
                    x: activeRun.phase.encounter.target.x,
                    y: activeRun.phase.encounter.target.y,
                  },
                  occurredOnFirstStep: activeRun.phase.encounter.occurredOnFirstStep,
                },
              },
          runItems: {
            successfulDetectionUses: 0,
            successfulAirplaneUses: 0,
            successfulReviveUses: 0,
            detectionRandomSeed: activeRun.generationProvenance?.seed ?? null,
          },
          ...(activeRun.generationProvenance === undefined
            ? {}
            : { generationProvenance: copyProvenance(activeRun.generationProvenance) }),
        },
  };
}
