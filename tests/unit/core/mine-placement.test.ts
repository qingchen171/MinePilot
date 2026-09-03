import { describe, expect, it } from 'vitest';
import { createCoordinate, type Coordinate } from '../../../src/core/board';
import {
  selectMineCoordinates,
  type SelectMineCoordinatesResult,
} from '../../../src/core/mine-placement';
import { createSeededRandomSource } from '../../../src/core/random';

const rowMajorCandidates = (width: number, height: number): readonly Coordinate[] =>
  Array.from({ length: width * height }, (_, index) =>
    createCoordinate(index % width, Math.floor(index / width)),
  );

function selected(result: SelectMineCoordinatesResult): readonly Coordinate[] {
  if (result.status !== 'selected') throw new Error('Expected selected mine coordinates.');
  return result.coordinates;
}

describe('deterministic mine coordinate selection', () => {
  it('replays exactly for the same seed, candidates, order, and mine count', () => {
    const candidates = rowMajorCandidates(4, 3);

    expect(selected(selectMineCoordinates(candidates, 5, createSeededRandomSource(99)))).toEqual(
      selected(selectMineCoordinates(candidates, 5, createSeededRandomSource(99))),
    );
  });

  it('locks the PRNG, candidate-order, and placement compatibility contract with a golden result', () => {
    const result = selectMineCoordinates(
      rowMajorCandidates(3, 3),
      4,
      createSeededRandomSource(123_456_789),
    );

    expect(selected(result)).toEqual([
      { x: 2, y: 2 },
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ]);
  });

  it('selects exactly the requested count without duplicate coordinates', () => {
    const coordinates = selected(
      selectMineCoordinates(rowMajorCandidates(5, 4), 12, createSeededRandomSource(7)),
    );
    const keys = coordinates.map(({ x, y }) => `${x},${y}`);

    expect(coordinates).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
  });

  it('returns only coordinates supplied by the caller', () => {
    const candidates = rowMajorCandidates(4, 2);
    const coordinates = selected(
      selectMineCoordinates(candidates, 6, createSeededRandomSource(123)),
    );

    expect(coordinates.every((coordinate) => candidates.some(
      (candidate) => candidate.x === coordinate.x && candidate.y === coordinate.y,
    ))).toBe(true);
  });

  it('allows zero mines with no candidates and does not consume randomness', () => {
    const random = {
      nextInt(): number {
        throw new Error('Randomness must not be consumed for an empty selection.');
      },
    };

    expect(selectMineCoordinates([], 0, random)).toEqual({
      status: 'selected',
      coordinates: [],
    });
  });

  it('allows mineCount equal to candidate count and returns each candidate once', () => {
    const candidates = rowMajorCandidates(3, 2);
    const coordinates = selected(
      selectMineCoordinates(candidates, candidates.length, createSeededRandomSource(5)),
    );

    expect(coordinates).toHaveLength(candidates.length);
    expect(coordinates).toEqual(expect.arrayContaining([...candidates]));
  });

  it('rejects mineCount greater than candidate count without clamping', () => {
    expect(selectMineCoordinates(rowMajorCandidates(2, 2), 5, createSeededRandomSource(1))).toEqual({
      status: 'invalid',
      reason: 'mine-count-exceeds-candidates',
    });
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid mineCount: %s',
    (mineCount) => {
      expect(selectMineCoordinates([], mineCount, createSeededRandomSource(1))).toEqual({
        status: 'invalid',
        reason: 'invalid-mine-count',
      });
    },
  );

  it.each([
    ['negative x', [{ x: -1, y: 0 }]],
    ['fractional y', [{ x: 0, y: 0.5 }]],
    ['unsafe x', [{ x: Number.MAX_SAFE_INTEGER + 1, y: 0 }]],
  ])('rejects an invalid candidate coordinate: %s', (_description, candidates) => {
    expect(selectMineCoordinates(candidates, 0, createSeededRandomSource(1))).toEqual({
      status: 'invalid',
      reason: 'invalid-candidate',
      candidateIndex: 0,
    });
  });

  it('rejects duplicate candidate coordinates', () => {
    const coordinate = createCoordinate(2, 3);

    expect(selectMineCoordinates([coordinate, coordinate], 1, createSeededRandomSource(1))).toEqual({
      status: 'invalid',
      reason: 'duplicate-candidate',
      candidateIndex: 1,
    });
  });

  it('does not mutate candidates or their coordinate objects', () => {
    const candidates = rowMajorCandidates(4, 2);
    const snapshot = structuredClone(candidates);

    const coordinates = selected(
      selectMineCoordinates(candidates, 4, createSeededRandomSource(44)),
    );

    expect(candidates).toEqual(snapshot);
    expect(coordinates).not.toBe(candidates);
    expect(Object.isFrozen(coordinates)).toBe(true);
    expect(coordinates.every(Object.isFrozen)).toBe(true);
  });

  it('treats candidate order as part of the replay contract', () => {
    const ordered = rowMajorCandidates(3, 3);
    const reversed = [...ordered].reverse();

    expect(selected(selectMineCoordinates(ordered, 4, createSeededRandomSource(8)))).not.toEqual(
      selected(selectMineCoordinates(reversed, 4, createSeededRandomSource(8))),
    );
  });
});
