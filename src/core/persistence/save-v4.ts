import { createSettingsState, createTutorialProgressState, isTutorialMilestoneId,
  type SettingsState, type TutorialProgressState } from '../settings-tutorial';
import { validateSaveDocumentV3, type AccountSaveV3, type AttemptSaveV3, type SaveDocumentV3, type SaveV3ValidationIssue } from './save-v3';

/** Detached serialized facts. A DTO never becomes authoritative Runtime. */
export interface SaveDocumentV4 {
  readonly saveVersion: 4;
  readonly revision: number;
  readonly account: AccountSaveV3;
  readonly currentAttempt: AttemptSaveV3 | null;
  readonly settings: SettingsState;
  readonly tutorialProgress: TutorialProgressState;
}
export interface SaveV4ValidationIssue {
  readonly code: SaveV3ValidationIssue['code'] | 'invalid-settings' | 'invalid-tutorial';
  readonly path: string;
}
export type ValidateSaveDocumentV4Result =
  | { readonly status: 'validated'; readonly document: SaveDocumentV4 }
  | { readonly status: 'invalid'; readonly issues: readonly SaveV4ValidationIssue[] };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field));
}

/** Strict external v4 validation. Historical trust is never inferred from a DTO field. */
export function validateSaveDocumentV4(input: unknown): ValidateSaveDocumentV4Result {
  if (!record(input) || !exactFields(input,
    ['saveVersion', 'revision', 'account', 'currentAttempt', 'settings', 'tutorialProgress']) || input.saveVersion !== 4) {
    return { status: 'invalid', issues: [{ code: 'invalid-input', path: '$' }] };
  }
  if (!record(input.settings) || !exactFields(input.settings, ['musicEnabled', 'soundEffectsEnabled']) ||
      typeof input.settings.musicEnabled !== 'boolean' || typeof input.settings.soundEffectsEnabled !== 'boolean') {
    return { status: 'invalid', issues: [{ code: 'invalid-settings', path: '$.settings' }] };
  }
  if (!record(input.tutorialProgress) || !exactFields(input.tutorialProgress, ['acknowledgedMilestoneIds'])) {
    return { status: 'invalid', issues: [{ code: 'invalid-tutorial', path: '$.tutorialProgress' }] };
  }
  let settings: SettingsState;
  let tutorialProgress: TutorialProgressState;
  try {
    settings = createSettingsState({ musicEnabled: input.settings.musicEnabled,
      soundEffectsEnabled: input.settings.soundEffectsEnabled });
    const ids = input.tutorialProgress.acknowledgedMilestoneIds;
    if (!Array.isArray(ids) || !Array.from({ length: ids.length }, (_, i) => i).every((i) =>
      Object.hasOwn(ids, i) && isTutorialMilestoneId(ids[i]))) {
      return { status: 'invalid', issues: [{ code: 'invalid-tutorial', path: '$.tutorialProgress.acknowledgedMilestoneIds' }] };
    }
    tutorialProgress = createTutorialProgressState({ acknowledgedMilestoneIds: ids });
  } catch {
    return { status: 'invalid', issues: [{ code: 'invalid-tutorial', path: '$.tutorialProgress.acknowledgedMilestoneIds' }] };
  }
  const old = validateSaveDocumentV3({
    saveVersion: 3, revision: input.revision, account: input.account, currentAttempt: input.currentAttempt,
  });
  if (old.status === 'invalid') return old;
  return { status: 'validated', document: {
    saveVersion: 4, revision: old.document.revision, account: old.document.account,
    currentAttempt: old.document.currentAttempt, settings, tutorialProgress,
  } };
}

/** Pure v3-to-v4 DTO migration; no storage write, revision change or invented completion. */
export function migrateValidatedV3ToV4(document: SaveDocumentV3): SaveDocumentV4 {
  return {
    saveVersion: 4, revision: document.revision, account: document.account,
    currentAttempt: document.currentAttempt,
    settings: createSettingsState({ musicEnabled: true, soundEffectsEnabled: true }),
    tutorialProgress: createTutorialProgressState({ acknowledgedMilestoneIds: [] }),
  };
}
