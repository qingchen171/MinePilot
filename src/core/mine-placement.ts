import { createCoordinate, type Coordinate } from './board';
import type { RandomSource } from './random';

export type MinePlacementInvalidReason =
  | 'invalid-mine-count'
  | 'mine-count-exceeds-candidates'
  | 'invalid-candidate'
  | 'duplicate-candidate';

export type SelectMineCoordinatesResult =
  | { readonly status: 'selected'; readonly coordinates: readonly Coordinate[] }
  | {
      readonly status: 'invalid';
      readonly reason: MinePlacementInvalidReason;
      readonly candidateIndex?: number;
    };

function copyCandidate(candidate: Coordinate, candidateIndex: number): Coordinate | SelectMineCoordinatesResult {
  try {
    return createCoordinate(candidate.x, candidate.y);
  } catch {
    return { status: 'invalid', reason: 'invalid-candidate', candidateIndex };
  }
}

export function selectMineCoordinates(
  candidates: readonly Coordinate[],
  mineCount: number,
  random: RandomSource,
): SelectMineCoordinatesResult {
  if (!Number.isSafeInteger(mineCount) || mineCount < 0) {
    return { status: 'invalid', reason: 'invalid-mine-count' };
  }
  if (mineCount > candidates.length) {
    return { status: 'invalid', reason: 'mine-count-exceeds-candidates' };
  }

  const working: Coordinate[] = [];
  const coordinateKeys = new Set<string>();
  for (const [candidateIndex, candidate] of candidates.entries()) {
    const copied = copyCandidate(candidate, candidateIndex);
    if ('status' in copied) return copied;

    const key = `${copied.x},${copied.y}`;
    if (coordinateKeys.has(key)) {
      return { status: 'invalid', reason: 'duplicate-candidate', candidateIndex };
    }
    coordinateKeys.add(key);
    working.push(copied);
  }

  for (let selectedIndex = 0; selectedIndex < mineCount; selectedIndex += 1) {
    const swapIndex = selectedIndex + random.nextInt(working.length - selectedIndex);
    [working[selectedIndex], working[swapIndex]] = [working[swapIndex], working[selectedIndex]];
  }

  return {
    status: 'selected',
    coordinates: Object.freeze(working.slice(0, mineCount)),
  };
}
