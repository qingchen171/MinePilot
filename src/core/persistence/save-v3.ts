import { getCellAt, type Coordinate } from '../board';
import type { BoardSaveV1, GenerationProvenanceSaveV1, RunPhaseSaveV1 } from './save-v1';
import { loadSaveDocument } from './save-dispatcher';
import {
  validateAndLoadSaveDocumentV2,
  type CharacterPositionSaveV2,
  type ItemInventorySaveV2,
  type RunItemStateSaveV2,
  type SaveV2ValidationIssue,
} from './save-v2';

export interface BenbenLevelSaveV3 {
  readonly levelId: string;
  readonly failureStreak: number;
  readonly status: 'unavailable' | 'available' | 'used';
}
export interface AccountSaveV3 {
  readonly inventory: ItemInventorySaveV2;
  readonly coins: number;
  readonly completedLevelIds: readonly string[];
  readonly oneTimeClaimIds: readonly string[];
  readonly benbenByLevel: readonly BenbenLevelSaveV3[];
}
export interface RewardSaveV3 {
  readonly coordinate: Coordinate;
  readonly payload:
    | { readonly kind: 'coins'; readonly amount: number }
    | { readonly kind: 'item'; readonly item: keyof ItemInventorySaveV2; readonly quantity: number };
  readonly claimed: boolean;
  readonly oneTimeClaimId: string | null;
}
export interface AttemptSaveV3 {
  readonly runId: string;
  readonly levelId: string;
  readonly generationProvenance: GenerationProvenanceSaveV1 | null;
  readonly run: {
    readonly board: BoardSaveV1;
    readonly characterPosition: CharacterPositionSaveV2;
    readonly hasTakenStep: boolean;
    readonly phase: RunPhaseSaveV1;
  };
  readonly runItems: RunItemStateSaveV2;
  readonly rewards: readonly RewardSaveV3[];
  readonly terminalDisposition: 'not-applicable' | 'settled' | 'legacy-excluded';
}
/** DTO only. This is not the current Runtime aggregate or a writable save version. */
export interface SaveDocumentV3 {
  readonly saveVersion: 3;
  readonly revision: number;
  readonly account: AccountSaveV3;
  readonly currentAttempt: AttemptSaveV3 | null;
}
export interface SaveV3ValidationIssue {
  readonly code: SaveV2ValidationIssue['code'] | 'invalid-id' | 'invalid-number'
    | 'invalid-array' | 'duplicate-id' | 'invalid-benben' | 'invalid-reward'
    | 'invalid-terminal-disposition' | 'legacy-migration-required' | 'inconsistent-settlement';
  readonly path: string;
  readonly detail?: SaveV2ValidationIssue['detail'];
}
export type ValidateSaveDocumentV3Result =
  | { readonly status: 'validated'; readonly document: SaveDocumentV3 }
  | { readonly status: 'invalid'; readonly issues: readonly SaveV3ValidationIssue[] };

// Local parsing control flow only; no shared validation framework or runtime authority.
class InvalidV3 extends Error {
  constructor(readonly issues: readonly SaveV3ValidationIssue[]) { super('Invalid Save v3 DTO'); }
}
function reject(code: SaveV3ValidationIssue['code'], path: string): never {
  throw new InvalidV3([{ code, path }]);
}
function record(input: unknown, fields: readonly string[], path: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) reject('invalid-input', path);
  const value = input as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) reject('unknown-field', `${path}.${key}`);
  }
  for (const key of fields) {
    if (!Object.hasOwn(value, key)) reject('invalid-input', `${path}.${key}`);
  }
  return value;
}
function natural(input: unknown, path: string, positive = false): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < (positive ? 1 : 0)) {
    reject('invalid-number', path);
  }
  return input;
}
function stableId(input: unknown, path: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) reject('invalid-id', path);
  return input;
}
function array(input: unknown, path: string): unknown[] {
  if (!Array.isArray(input)) reject('invalid-array', path);
  for (let i = 0; i < input.length; i += 1) {
    if (!Object.hasOwn(input, i)) reject('invalid-array', `${path}[${i}]`);
  }
  return input;
}
function ids(input: unknown, path: string): string[] {
  const result = array(input, path).map((value, i) => stableId(value, `${path}[${i}]`));
  if (new Set(result).size !== result.length) reject('duplicate-id', path);
  return result;
}
function benben(input: unknown): BenbenLevelSaveV3[] {
  const result = array(input, '$.account.benbenByLevel').map((entry, i): BenbenLevelSaveV3 => {
    const path = `$.account.benbenByLevel[${i}]`;
    const value = record(entry, ['levelId', 'failureStreak', 'status'], path);
    const levelId = stableId(value.levelId, `${path}.levelId`);
    const failureStreak = natural(value.failureStreak, `${path}.failureStreak`);
    const status = value.status;
    if (status !== 'unavailable' && status !== 'available' && status !== 'used') reject('invalid-benben', path);
    if (status !== 'unavailable' && failureStreak !== 0) reject('invalid-benben', path);
    return { levelId, failureStreak, status };
  });
  if (new Set(result.map((entry) => entry.levelId)).size !== result.length) {
    reject('duplicate-id', '$.account.benbenByLevel');
  }
  return result;
}
function reward(input: unknown, i: number): RewardSaveV3 {
  const path = `$.currentAttempt.rewards[${i}]`;
  const value = record(input, ['coordinate', 'payload', 'claimed', 'oneTimeClaimId'], path);
  const coordinate = record(value.coordinate, ['x', 'y'], `${path}.coordinate`);
  const x = natural(coordinate.x, `${path}.coordinate.x`);
  const y = natural(coordinate.y, `${path}.coordinate.y`);
  if (typeof value.claimed !== 'boolean') reject('invalid-reward', `${path}.claimed`);
  const oneTimeClaimId = value.oneTimeClaimId === null ? null : stableId(value.oneTimeClaimId, `${path}.oneTimeClaimId`);
  const raw = value.payload;
  if (typeof raw !== 'object' || raw === null || !('kind' in raw)) reject('invalid-reward', `${path}.payload`);
  let payload: RewardSaveV3['payload'];
  if (raw.kind === 'coins') {
    const parsed = record(raw, ['kind', 'amount'], `${path}.payload`);
    payload = { kind: 'coins', amount: natural(parsed.amount, `${path}.payload.amount`, true) };
  } else if (raw.kind === 'item') {
    const parsed = record(raw, ['kind', 'item', 'quantity'], `${path}.payload`);
    const item = parsed.item;
    if (item !== 'lucky' && item !== 'detection' && item !== 'airplane' && item !== 'revive') {
      reject('invalid-reward', `${path}.payload.item`);
    }
    payload = { kind: 'item', item, quantity: natural(parsed.quantity, `${path}.payload.quantity`, true) };
  } else reject('invalid-reward', `${path}.payload.kind`);
  return { coordinate: { x, y }, payload, claimed: value.claimed, oneTimeClaimId };
}

function validate(input: unknown, migratedLegacy: boolean): ValidateSaveDocumentV3Result {
  try {
    const root = record(input, ['saveVersion', 'revision', 'account', 'currentAttempt'], '$');
    if (root.saveVersion !== 3) reject('invalid-save-version', '$.saveVersion');
    const revision = natural(root.revision, '$.revision');
    const rawAccount = record(root.account, ['inventory', 'coins', 'completedLevelIds', 'oneTimeClaimIds', 'benbenByLevel'], '$.account');
    const coins = natural(rawAccount.coins, '$.account.coins');
    const completedLevelIds = ids(rawAccount.completedLevelIds, '$.account.completedLevelIds');
    const oneTimeClaimIds = ids(rawAccount.oneTimeClaimIds, '$.account.oneTimeClaimIds');
    const benbenByLevel = benben(rawAccount.benbenByLevel);
    let rawAttempt: Record<string, unknown> | null = null;
    let rawRun: Record<string, unknown> | null = null;
    if (root.currentAttempt !== null) {
      rawAttempt = record(root.currentAttempt, ['runId', 'levelId', 'generationProvenance', 'run', 'runItems', 'rewards', 'terminalDisposition'], '$.currentAttempt');
      rawRun = record(rawAttempt.run, ['board', 'characterPosition', 'hasTakenStep', 'phase'], '$.currentAttempt.run');
    }
    // Delegate unchanged Board/Run/Item/inventory/provenance legality and reconstruction.
    // The temporary old Runtime is validation evidence only, never the returned v3 authority.
    const shared = validateAndLoadSaveDocumentV2({
      saveVersion: 2, revision, account: { inventory: rawAccount.inventory },
      activeRun: rawAttempt === null || rawRun === null ? null : {
        runId: rawAttempt.runId, levelId: rawAttempt.levelId,
        board: rawRun.board, characterPosition: rawRun.characterPosition,
        hasTakenStep: rawRun.hasTakenStep, phase: rawRun.phase, runItems: rawAttempt.runItems,
        ...(rawAttempt.generationProvenance === null ? {} : { generationProvenance: rawAttempt.generationProvenance }),
      },
    });
    if (shared.status === 'invalid') return shared;
    const account: AccountSaveV3 = {
      inventory: shared.document.account.inventory, coins, completedLevelIds, oneTimeClaimIds, benbenByLevel,
    };
    let currentAttempt: AttemptSaveV3 | null = null;
    const copied = shared.document.activeRun;
    if (rawAttempt !== null && copied !== null && shared.activeRun !== null) {
      const rewards = array(rawAttempt.rewards, '$.currentAttempt.rewards').map(reward);
      const coordinates = new Set<string>();
      const claims = new Set<string>();
      for (const [i, entry] of rewards.entries()) {
        const path = `$.currentAttempt.rewards[${i}]`;
        const key = `${entry.coordinate.x},${entry.coordinate.y}`;
        if (coordinates.has(key)) reject('invalid-reward', `${path}.coordinate`);
        coordinates.add(key);
        const cell = getCellAt(shared.activeRun.gameState.run.board, entry.coordinate);
        if (cell?.kind !== 'safe') reject('invalid-reward', `${path}.coordinate`);
        if (entry.claimed !== (cell.exploration === 'explored')) reject('invalid-reward', `${path}.claimed`);
        if (entry.oneTimeClaimId !== null) {
          if (claims.has(entry.oneTimeClaimId)) reject('duplicate-id', `${path}.oneTimeClaimId`);
          claims.add(entry.oneTimeClaimId);
          if (entry.claimed !== oneTimeClaimIds.includes(entry.oneTimeClaimId)) reject('invalid-reward', `${path}.oneTimeClaimId`);
        }
      }
      const terminalDisposition = rawAttempt.terminalDisposition;
      const terminal = copied.phase.kind === 'won' || copied.phase.kind === 'failed';
      if (terminalDisposition !== 'not-applicable' && terminalDisposition !== 'settled' && terminalDisposition !== 'legacy-excluded') {
        reject('invalid-terminal-disposition', '$.currentAttempt.terminalDisposition');
      }
      if (terminal === (terminalDisposition === 'not-applicable')) reject('invalid-terminal-disposition', '$.currentAttempt.terminalDisposition');
      if (terminalDisposition === 'legacy-excluded' && !migratedLegacy) reject('legacy-migration-required', '$.currentAttempt.terminalDisposition');
      if (copied.phase.kind === 'won' && terminalDisposition === 'settled') {
        if (!completedLevelIds.includes(copied.levelId) ||
          benbenByLevel.some((entry) => entry.levelId === copied.levelId && entry.failureStreak !== 0) ||
          rewards.some((entry) => !entry.claimed)) reject('inconsistent-settlement', '$.currentAttempt');
      }
      currentAttempt = {
        runId: copied.runId, levelId: copied.levelId,
        generationProvenance: copied.generationProvenance ?? null,
        run: { board: copied.board, characterPosition: copied.characterPosition, hasTakenStep: copied.hasTakenStep, phase: copied.phase },
        runItems: copied.runItems, rewards, terminalDisposition,
      };
    }
    return { status: 'validated', document: { saveVersion: 3, revision, account, currentAttempt } };
  } catch (error) {
    if (error instanceof InvalidV3) return { status: 'invalid', issues: error.issues };
    throw error;
  }
}

/** Normal external v3 input cannot opt itself into historical settlement exclusion. */
export function validateSaveDocumentV3(input: unknown): ValidateSaveDocumentV3Result {
  return validate(input, false);
}

/** Read-only target-v3 seam. Existing dispatcher supplies strict v1 -> v2 -> reconstruction.
 * No current version/writer switch. Legacy permission is private and accepts only old input.
 * Future authoritative v3 restore of persisted legacy terminals needs an explicit trusted
 * integration boundary; accepting a caller-supplied boolean here would defeat that boundary.
 */
export function migrateOldSaveDocumentToV3(input: unknown): ValidateSaveDocumentV3Result {
  const old = loadSaveDocument(input);
  if (old.status !== 'loaded') {
    return { status: 'invalid', issues: 'issues' in old ? old.issues : [{ code: 'invalid-save-version', path: '$.saveVersion' }] };
  }
  const document = old.document;
  const attempt = document.activeRun;
  return validate({
    saveVersion: 3, revision: document.revision,
    account: { inventory: document.account.inventory, coins: 0, completedLevelIds: [], oneTimeClaimIds: [], benbenByLevel: [] },
    currentAttempt: attempt === null ? null : {
      runId: attempt.runId, levelId: attempt.levelId,
      generationProvenance: attempt.generationProvenance ?? null,
      run: { board: attempt.board, characterPosition: attempt.characterPosition, hasTakenStep: attempt.hasTakenStep, phase: attempt.phase },
      runItems: attempt.runItems, rewards: [],
      terminalDisposition: attempt.phase.kind === 'won' || attempt.phase.kind === 'failed' ? 'legacy-excluded' : 'not-applicable',
    },
  }, true);
}
