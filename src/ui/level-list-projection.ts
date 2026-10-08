/** Independently owned UI input; composition root checks exact structural parity. */
export interface LevelListProjectionInput {
  readonly levelId: string;
  readonly order: number;
  readonly access: 'locked' | 'available' | 'completed';
  readonly current: boolean;
}

export function projectLevelListView(entries: readonly LevelListProjectionInput[]): readonly LevelListProjectionInput[] {
  return Object.freeze(entries.map((entry) => Object.freeze({
    levelId: entry.levelId, order: entry.order, access: entry.access, current: entry.current,
  })));
}
