import { type SaveVersionInvalidReason } from './save-legacy-dispatcher';
import {
  migrateOldSaveDocumentToV3,
  validateSaveDocumentV3,
  type SaveV3ValidationIssue,
  type TrustedMigratedSaveDocumentV3Result,
} from './save-v3';
import { migrateValidatedV3ToV4, validateSaveDocumentV4,
  type SaveDocumentV4, type SaveV4ValidationIssue, type ValidateSaveDocumentV4Result } from './save-v4';

export const CURRENT_SAVE_VERSION = 4;

export type LoadSaveDocumentResult =
  | { readonly status: 'loaded'; readonly saveVersion: 4; readonly sourceSaveVersion: 4;
      readonly document: SaveDocumentV4;
      readonly validation: Extract<ValidateSaveDocumentV4Result, { readonly status: 'validated' }> }
  | { readonly status: 'loaded'; readonly saveVersion: 4; readonly sourceSaveVersion: 3;
      readonly document: SaveDocumentV4;
      readonly validation: Extract<ValidateSaveDocumentV4Result, { readonly status: 'validated' }> }
  | { readonly status: 'loaded'; readonly saveVersion: 4; readonly sourceSaveVersion: 1 | 2;
      readonly document: SaveDocumentV4;
      readonly migration: Extract<TrustedMigratedSaveDocumentV3Result, { readonly status: 'validated' }> }
  | { readonly status: 'missing-version' }
  | { readonly status: 'invalid-version'; readonly reason: SaveVersionInvalidReason }
  | { readonly status: 'unsupported-future-version' | 'unsupported-old-version'; readonly saveVersion: number }
  | { readonly status: 'invalid-current-version-document'; readonly saveVersion: 4; readonly issues: readonly SaveV4ValidationIssue[] }
  | { readonly status: 'invalid-old-version-document'; readonly saveVersion: 3; readonly issues: readonly SaveV3ValidationIssue[] }
  | { readonly status: 'invalid-old-version-document'; readonly saveVersion: 1 | 2; readonly issues: readonly SaveV3ValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Activated v4 dispatch. Historical interpretation remains in its own validator. */
export function loadSaveDocument(input: unknown): LoadSaveDocumentResult {
  if (!isRecord(input) || !Object.hasOwn(input, 'saveVersion')) return { status: 'missing-version' };
  const version = input.saveVersion;
  if (typeof version !== 'number') return { status: 'invalid-version', reason: 'invalid-type' };
  if (!Number.isSafeInteger(version) || version < 0) return { status: 'invalid-version', reason: 'invalid-number' };
  if (version > CURRENT_SAVE_VERSION) return { status: 'unsupported-future-version', saveVersion: version };
  if (version < 1) return { status: 'unsupported-old-version', saveVersion: version };
  if (version === 4) {
    const validated = validateSaveDocumentV4(input);
    return validated.status === 'validated'
      ? { status: 'loaded', saveVersion: 4, sourceSaveVersion: 4, document: validated.document, validation: validated }
      : { status: 'invalid-current-version-document', saveVersion: 4, issues: validated.issues };
  }
  if (version === 3) {
    const validated = validateSaveDocumentV3(input);
    if (validated.status === 'invalid') return { status: 'invalid-old-version-document', saveVersion: 3, issues: validated.issues };
    const current = validateSaveDocumentV4(migrateValidatedV3ToV4(validated.document));
    if (current.status !== 'validated') throw new Error('Validated v3 migration produced invalid v4.');
    return { status: 'loaded', saveVersion: 4, sourceSaveVersion: 3, document: current.document, validation: current };
  }
  if (version !== 1 && version !== 2) return { status: 'unsupported-old-version', saveVersion: version };
  const migrated = migrateOldSaveDocumentToV3(input);
  return migrated.status === 'validated'
    ? { status: 'loaded', saveVersion: 4, sourceSaveVersion: version, document: migrateValidatedV3ToV4(migrated.document), migration: migrated }
    : { status: 'invalid-old-version-document', saveVersion: version, issues: migrated.issues };
}
