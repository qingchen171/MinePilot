import {
  validateAndLoadSaveDocumentV1,
  type LoadedActiveRunV1,
  type SaveDocumentV1,
  type SaveV1ValidationIssue,
} from './save-v1';

export const CURRENT_SAVE_VERSION = 1;

export type SaveVersionInvalidReason = 'invalid-type' | 'invalid-number';

export type LoadSaveDocumentResult =
  | {
      readonly status: 'loaded';
      readonly saveVersion: typeof CURRENT_SAVE_VERSION;
      readonly document: SaveDocumentV1;
      readonly activeRun: LoadedActiveRunV1 | null;
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
      readonly issues: readonly SaveV1ValidationIssue[];
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
  if (saveVersion < CURRENT_SAVE_VERSION) {
    return { status: 'unsupported-old-version', saveVersion };
  }

  // Future supported versions migrate as pure DTO-to-DTO steps before reaching
  // the current loader. With v1 as the only real schema, direct delegation is
  // the complete migration boundary today.
  const loaded = validateAndLoadSaveDocumentV1(input);
  return loaded.status === 'loaded'
    ? {
        status: 'loaded',
        saveVersion: CURRENT_SAVE_VERSION,
        document: loaded.document,
        activeRun: loaded.activeRun,
      }
    : {
        status: 'invalid-current-version-document',
        saveVersion: CURRENT_SAVE_VERSION,
        issues: loaded.issues,
      };
}
