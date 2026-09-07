import { type AccountState } from '../account';
import {
  validateAndLoadSaveDocumentV1,
  type SaveV1ValidationIssue,
} from './save-v1';
import {
  migrateValidatedSaveDocumentV1ToV2,
  validateAndLoadSaveDocumentV2,
  type LoadedActiveRunV2,
  type SaveDocumentV2,
  type SaveV2ValidationIssue,
} from './save-v2';

export const CURRENT_SAVE_VERSION = 2;

export type SaveVersionInvalidReason = 'invalid-type' | 'invalid-number';

export type LoadSaveDocumentResult =
  | {
      readonly status: 'loaded';
      readonly saveVersion: typeof CURRENT_SAVE_VERSION;
      readonly sourceSaveVersion: 1 | typeof CURRENT_SAVE_VERSION;
      readonly document: SaveDocumentV2;
      readonly account: AccountState;
      readonly activeRun: LoadedActiveRunV2 | null;
    }
  | { readonly status: 'missing-version' }
  | {
      readonly status: 'invalid-version';
      readonly reason: SaveVersionInvalidReason;
    }
  | {
      readonly status: 'unsupported-future-version';
      readonly saveVersion: number;
    }
  | {
      readonly status: 'unsupported-old-version';
      readonly saveVersion: number;
    }
  | {
      readonly status: 'invalid-current-version-document';
      readonly saveVersion: typeof CURRENT_SAVE_VERSION;
      readonly issues: readonly SaveV2ValidationIssue[];
    }
  | {
      readonly status: 'invalid-old-version-document';
      readonly saveVersion: 1;
      readonly issues: readonly SaveV1ValidationIssue[];
    }
  | {
      readonly status: 'migration-failure';
      readonly sourceSaveVersion: 1;
      readonly targetSaveVersion: typeof CURRENT_SAVE_VERSION;
      readonly issues: readonly SaveV2ValidationIssue[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadSaveDocument(input: unknown): LoadSaveDocumentResult {
  if (!isRecord(input) || !Object.hasOwn(input, 'saveVersion')) {
    return { status: 'missing-version' };
  }

  const saveVersion = input.saveVersion;
  if (typeof saveVersion !== 'number') {
    return { status: 'invalid-version', reason: 'invalid-type' };
  }
  if (!Number.isSafeInteger(saveVersion) || saveVersion < 0) {
    return { status: 'invalid-version', reason: 'invalid-number' };
  }
  if (saveVersion > CURRENT_SAVE_VERSION) {
    return { status: 'unsupported-future-version', saveVersion };
  }
  if (saveVersion < 1) {
    return { status: 'unsupported-old-version', saveVersion };
  }

  if (saveVersion === 1) {
    const loadedV1 = validateAndLoadSaveDocumentV1(input);
    if (loadedV1.status === 'invalid') {
      return {
        status: 'invalid-old-version-document',
        saveVersion: 1,
        issues: loadedV1.issues,
      };
    }
    const migratedDocument = migrateValidatedSaveDocumentV1ToV2(loadedV1.document);
    const loadedV2 = validateAndLoadSaveDocumentV2(migratedDocument);
    return loadedV2.status === 'invalid'
      ? {
          status: 'migration-failure',
          sourceSaveVersion: 1,
          targetSaveVersion: CURRENT_SAVE_VERSION,
          issues: loadedV2.issues,
        }
      : {
          status: 'loaded',
          saveVersion: CURRENT_SAVE_VERSION,
          sourceSaveVersion: 1,
          document: loadedV2.document,
          account: loadedV2.account,
          activeRun: loadedV2.activeRun,
        };
  }

  const loaded = validateAndLoadSaveDocumentV2(input);
  return loaded.status === 'loaded'
    ? {
        status: 'loaded',
        saveVersion: CURRENT_SAVE_VERSION,
        sourceSaveVersion: CURRENT_SAVE_VERSION,
        document: loaded.document,
        account: loaded.account,
        activeRun: loaded.activeRun,
      }
    : {
        status: 'invalid-current-version-document',
        saveVersion: CURRENT_SAVE_VERSION,
        issues: loaded.issues,
      };
}
