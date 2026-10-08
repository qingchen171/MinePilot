import { describe, expect, it } from 'vitest';
import { createInitialStage4GameState, createStage4GameState } from '../../../../src/core/stage4-game-state';
import { createTutorialProgressState, TUTORIAL_MILESTONE_IDS } from '../../../../src/core/settings-tutorial';
import { mapStage4RuntimeToSaveV3 } from '../../../../src/core/persistence/stage4-runtime-mapping';
import { mapStage4RuntimeToSaveV4, reconstructStage4RuntimeFromValidatedV4 } from '../../../../src/core/persistence/stage4-runtime-mapping-v4';
import { CURRENT_SAVE_VERSION, loadSaveDocument } from '../../../../src/core/persistence/save-dispatcher';
import { validateSaveDocumentV3 } from '../../../../src/core/persistence/save-v3';
import { validateSaveDocumentV4 } from '../../../../src/core/persistence/save-v4';

function document() {
  const mapped = mapStage4RuntimeToSaveV4(createInitialStage4GameState(), 2);
  if (mapped.status !== 'mapped') throw new Error('v4 fixture');
  return mapped.document;
}

describe('S5-04 strict Save v4 and Runtime boundary', () => {
  it('requires both root facts instead of inserting constructor convenience defaults', () => {
    const runtime = createInitialStage4GameState();
    expect(() => createStage4GameState({ account: runtime.account, currentAttempt: null } as typeof runtime)).toThrow();
    expect(() => createStage4GameState({ ...runtime, settings: { musicEnabled: 1, soundEffectsEnabled: true } } as unknown as typeof runtime)).toThrow();
    expect(() => createStage4GameState({ ...runtime, tutorialProgress: {
      acknowledgedMilestoneIds: ['fake'],
    } } as unknown as typeof runtime)).toThrow();
  });
  it('activates only v4 and round-trips detached settings/tutorial facts', () => {
    expect(CURRENT_SAVE_VERSION).toBe(4);
    const input = document();
    const validated = validateSaveDocumentV4(input);
    expect(validated.status).toBe('validated');
    if (validated.status !== 'validated') return;
    const runtime = reconstructStage4RuntimeFromValidatedV4(validated);
    expect(runtime).toMatchObject({ settings: { musicEnabled: true, soundEffectsEnabled: true },
      tutorialProgress: { acknowledgedMilestoneIds: [] }, currentAttempt: null });
    expect(runtime.settings).not.toBe(input.settings);
    expect(runtime.tutorialProgress).not.toBe(input.tutorialProgress);
    expect(loadSaveDocument(input)).toMatchObject({ status: 'loaded', sourceSaveVersion: 4 });
  });

  it.each([
    ['missing root', (dto: Record<string, unknown>) => { delete dto.settings; }],
    ['extra root', (dto: Record<string, unknown>) => { dto.surprise = 1; }],
    ['wrong setting', (dto: Record<string, unknown>) => { dto.settings = { musicEnabled: 'true', soundEffectsEnabled: true }; }],
    ['extra setting', (dto: Record<string, unknown>) => { dto.settings = { musicEnabled: true, soundEffectsEnabled: true, volume: 1 }; }],
    ['duplicate milestone', (dto: Record<string, unknown>) => { dto.tutorialProgress = { acknowledgedMilestoneIds: ['first-shop', 'first-shop'] }; }],
    ['unknown milestone', (dto: Record<string, unknown>) => { dto.tutorialProgress = { acknowledgedMilestoneIds: ['fake'] }; }],
    ['extra progress', (dto: Record<string, unknown>) => { dto.tutorialProgress = { acknowledgedMilestoneIds: [], reset: true }; }],
    ['legacy forge', (dto: Record<string, unknown>) => { dto.currentAttempt = { terminalDisposition: 'legacy-excluded' }; }],
  ])('rejects %s non-destructively', (_name, change) => {
    const input: Record<string, unknown> = { ...structuredClone(document()) };
    change(input);
    const before = structuredClone(input);
    expect(validateSaveDocumentV4(input).status).toBe('invalid');
    expect(input).toEqual(before);
  });

  it('accepts set order, detaches it, and writes canonical order', () => {
    const input = { ...document(), tutorialProgress: { acknowledgedMilestoneIds: ['first-shop', 'first-lucky'] } };
    const checked = validateSaveDocumentV4(input);
    expect(checked).toMatchObject({ status: 'validated', document: {
      tutorialProgress: { acknowledgedMilestoneIds: ['first-lucky', 'first-shop'] },
    } });
    if (checked.status === 'validated') {
      expect(checked.document.tutorialProgress.acknowledgedMilestoneIds).not.toBe(input.tutorialProgress.acknowledgedMilestoneIds);
    }
    expect(TUTORIAL_MILESTONE_IDS).toHaveLength(9);
    expect(createTutorialProgressState({ acknowledgedMilestoneIds: ['first-shop', 'first-lucky'] }))
      .toEqual({ acknowledgedMilestoneIds: ['first-lucky', 'first-shop'] });
  });

  it('validates v3 before pure v4 default migration and preserves original revision', () => {
    const old = mapStage4RuntimeToSaveV3(createInitialStage4GameState(), 9);
    if (old.status !== 'mapped') throw new Error('v3 fixture');
    const before = structuredClone(old.document);
    expect(validateSaveDocumentV3(old.document).status).toBe('validated');
    expect(loadSaveDocument(old.document)).toMatchObject({ status: 'loaded', sourceSaveVersion: 3,
      document: { saveVersion: 4, revision: 9,
        settings: { musicEnabled: true, soundEffectsEnabled: true },
        tutorialProgress: { acknowledgedMilestoneIds: [] } } });
    expect(old.document).toEqual(before);
  });
});
