/** Persistent user preferences and acknowledged tutorial facts, not presentation state. */
export interface SettingsState {
  readonly musicEnabled: boolean;
  readonly soundEffectsEnabled: boolean;
}

export const TUTORIAL_MILESTONE_IDS = [
  'l1-movement-current-number',
  'l2-number-hides-on-leave',
  'l3-flag-misclick-protection',
  'l4-one-time-coin-reward',
  'l5-failure-retry-first-step-safety',
  'first-lucky',
  'first-obstacle',
  'first-items',
  'first-shop',
] as const;

export type TutorialMilestoneId = typeof TUTORIAL_MILESTONE_IDS[number];

export interface TutorialProgressState {
  readonly acknowledgedMilestoneIds: readonly TutorialMilestoneId[];
}

export function isTutorialMilestoneId(value: unknown): value is TutorialMilestoneId {
  return typeof value === 'string' && (TUTORIAL_MILESTONE_IDS as readonly string[]).includes(value);
}

export function createSettingsState(input: SettingsState): SettingsState {
  if (typeof input !== 'object' || input === null ||
      typeof input.musicEnabled !== 'boolean' || typeof input.soundEffectsEnabled !== 'boolean') {
    throw new Error('Invalid Settings state.');
  }
  return Object.freeze({ musicEnabled: input.musicEnabled, soundEffectsEnabled: input.soundEffectsEnabled });
}

export function createTutorialProgressState(input: TutorialProgressState): TutorialProgressState {
  if (typeof input !== 'object' || input === null || !Array.isArray(input.acknowledgedMilestoneIds)) {
    throw new Error('Invalid Tutorial progress.');
  }
  const ids = input.acknowledgedMilestoneIds;
  if (Array.from({ length: ids.length }, (_, index) => index).some((index) =>
    !Object.hasOwn(ids, index) || !isTutorialMilestoneId(ids[index])) ||
      new Set(ids).size !== ids.length) {
    throw new Error('Invalid Tutorial milestone set.');
  }
  return Object.freeze({ acknowledgedMilestoneIds: Object.freeze(TUTORIAL_MILESTONE_IDS.filter((id) => ids.includes(id))) });
}

export function createInitialSettingsState(): SettingsState {
  return createSettingsState({ musicEnabled: true, soundEffectsEnabled: true });
}

export function createInitialTutorialProgressState(): TutorialProgressState {
  return createTutorialProgressState({ acknowledgedMilestoneIds: [] });
}

export type SettingsTransition =
  | { readonly status: 'changed'; readonly settings: SettingsState }
  | { readonly status: 'unchanged' }
  | { readonly status: 'rejected'; readonly reason: 'invalid-request' };

export function setSetting(settings: SettingsState, key: unknown, enabled: unknown): SettingsTransition {
  if ((key !== 'musicEnabled' && key !== 'soundEffectsEnabled') || typeof enabled !== 'boolean') {
    return { status: 'rejected', reason: 'invalid-request' };
  }
  if (settings[key] === enabled) return { status: 'unchanged' };
  return { status: 'changed', settings: createSettingsState({ ...settings, [key]: enabled }) };
}

export type TutorialTransition =
  | { readonly status: 'changed'; readonly tutorialProgress: TutorialProgressState }
  | { readonly status: 'unchanged' }
  | { readonly status: 'rejected'; readonly reason: 'invalid-request' };

export function acknowledgeTutorial(progress: TutorialProgressState, milestoneId: unknown): TutorialTransition {
  if (!isTutorialMilestoneId(milestoneId)) return { status: 'rejected', reason: 'invalid-request' };
  if (progress.acknowledgedMilestoneIds.includes(milestoneId)) return { status: 'unchanged' };
  return { status: 'changed', tutorialProgress: createTutorialProgressState({
    acknowledgedMilestoneIds: [...progress.acknowledgedMilestoneIds, milestoneId],
  }) };
}
