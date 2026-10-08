import { createStage4GameState, type Stage4GameState } from '../stage4-game-state';
import { mapStage4RuntimeToSaveV3, reconstructStage4RuntimeFromValidatedV3 } from './stage4-runtime-mapping';
import { validateSaveDocumentV3 } from './save-v3';
import { validateSaveDocumentV4, type SaveDocumentV4, type ValidateSaveDocumentV4Result } from './save-v4';

export type MapStage4RuntimeV4Result =
  | { readonly status: 'mapped'; readonly document: SaveDocumentV4 }
  | { readonly status: 'not-writable'; readonly reason: 'legacy-excluded-attempt' }
  | { readonly status: 'invalid-runtime' };

/** Historical v3 mapper retains the Account/Attempt interpretation; v4 adds only two root facts. */
export function mapStage4RuntimeToSaveV4(runtime: Stage4GameState, revision: number): MapStage4RuntimeV4Result {
  const old = mapStage4RuntimeToSaveV3(runtime, revision);
  if (old.status !== 'mapped') return old;
  const checked = validateSaveDocumentV4({
    ...old.document, saveVersion: 4, settings: runtime.settings,
    tutorialProgress: runtime.tutorialProgress,
  });
  return checked.status === 'validated'
    ? { status: 'mapped', document: checked.document }
    : { status: 'invalid-runtime' };
}

export function reconstructStage4RuntimeFromValidatedV4(
  validated: Extract<ValidateSaveDocumentV4Result, { readonly status: 'validated' }>,
): Stage4GameState {
  const { document } = validated;
  const old = validateSaveDocumentV3({
    saveVersion: 3, revision: document.revision, account: document.account,
    currentAttempt: document.currentAttempt,
  });
  if (old.status !== 'validated') throw new Error('Validated v4 contains invalid historical facts.');
  const runtime = reconstructStage4RuntimeFromValidatedV3(old);
  return createStage4GameState({ ...runtime, settings: document.settings,
    tutorialProgress: document.tutorialProgress });
}
