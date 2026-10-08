import { getLevelAccess, type LevelCatalog } from '../../core/level-catalog';
import type { SanitizedPublicFacts } from './public-facts';

export interface PublicLevelEntry {
  readonly levelId: string;
  readonly order: number;
  readonly access: 'locked' | 'available' | 'completed';
  readonly current: boolean;
}

/** Trusted allowlist over the same validated catalog used for execution. */
export function projectLevelList(catalog: LevelCatalog, facts: SanitizedPublicFacts): readonly PublicLevelEntry[] {
  return Object.freeze(catalog.levels.map(({ levelId }, order) => {
    const access = getLevelAccess(catalog, levelId, facts.account.completedLevelIds);
    if (access.status !== 'found') throw new Error('Validated catalog lost an entry');
    return Object.freeze({ levelId, order,
      access: access.replay ? 'completed' as const : access.unlocked ? 'available' as const : 'locked' as const,
      current: facts.attempt?.levelId === levelId });
  }));
}

export function canSelectLevel(catalog: LevelCatalog, facts: SanitizedPublicFacts, levelId: string): boolean {
  const access = getLevelAccess(catalog, levelId, facts.account.completedLevelIds);
  return access.status === 'found' && access.unlocked;
}
