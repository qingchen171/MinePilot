/** Working-language semantic resources. Stage 6 owns full bilingual delivery. */
export const PRESENTATION_COPY = Object.freeze({
  'status.loading': 'Loading your game…',
  'status.unavailable': 'We could not safely open this game. Your saved progress has not been changed.',
  'status.committed': 'Saved.',
  'error.domain': 'That action is not available right now.',
  'error.stale': 'Your game changed elsewhere. Reload before choosing again.',
  'error.retry': 'The action was not saved. Reload and try again if your game is unchanged.',
  'error.technical': 'That action could not be completed.',
  'error.uncertain': 'The save result is uncertain. Reload before making another choice.',
  'error.recovery': 'Your saved game needs attention. No data was reset.',
  'error.unknown': 'We could not confirm the result. Reload before continuing.',
  'error.entropy': 'Secure randomness is unavailable. Your game has not changed.',
  'action.reload': 'Reload game',
  'action.retry': 'Try again',
  'action.dismiss': 'Dismiss',
} as const);

export type PresentationCopyKey = keyof typeof PRESENTATION_COPY;

export function presentationCopy(key: PresentationCopyKey): string {
  return PRESENTATION_COPY[key];
}
