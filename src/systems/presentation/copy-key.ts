import type { PresentationCopyKey } from '../../config/presentation-copy';
import type { ResultCategory } from './result-policy';

const RESULT_KEYS: Record<ResultCategory, PresentationCopyKey> = {
  domain: 'error.domain', stale: 'error.stale',
  'pre-commit-retainable': 'error.retry', 'pre-commit-discard': 'error.technical',
  uncertain: 'error.uncertain', recovery: 'error.recovery',
  technical: 'error.technical', unknown: 'error.unknown',
};

export function copyKeyForResult(category: ResultCategory): PresentationCopyKey {
  return RESULT_KEYS[category];
}
