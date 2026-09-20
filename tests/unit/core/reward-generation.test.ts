import { describe, expect, it, vi } from 'vitest';
import { deriveBenbenCard, deriveBenbenEligibility } from '../../../src/core/benben-random';
import { createBoard, createCellState } from '../../../src/core/board';
import { createDetectionCandidate } from '../../../src/core/detection';
import { PRODUCTION_LEVEL_CATALOG } from '../../../src/core/level-catalog';
import { createSeededRandomSource } from '../../../src/core/random';
import {
  createRewardGenerationConfig,
  deriveRewardRandomSeed,
  generateRewards,
  REWARD_RANDOM_DOMAIN,
  selectRewardPayload,
  type RewardGenerationConfig,
  type RewardGenerationConfigInput,
} from '../../../src/core/reward-generation';
import { detectionGame } from '../../helpers/detection';

function productionConfig(): RewardGenerationConfig {
  return PRODUCTION_LEVEL_CATALOG.levels[0]!.rewards;
}

function board(symbols = 'SSMSOSSSS') {
  return createBoard({ width: 3, height: 3 }, [...symbols].map((symbol) => createCellState({
    terrain: symbol === 'O' ? 'obstacle' : 'playable',
    containsMine: symbol === 'M', explored: false, mineRevealed: false, flagged: false,
  })));
}

function config(changes: Partial<RewardGenerationConfigInput> = {}) {
  return {
    rewardCount: 2, oneTimeClaimId: null,
    payloads: [
      { weight: 50, payload: { kind: 'coins' as const, amount: 1 } },
      { weight: 20, payload: { kind: 'item' as const, item: 'detection', quantity: 1 } },
      { weight: 15, payload: { kind: 'item' as const, item: 'revive', quantity: 1 } },
      { weight: 10, payload: { kind: 'item' as const, item: 'lucky', quantity: 1 } },
      { weight: 5, payload: { kind: 'item' as const, item: 'airplane', quantity: 1 } },
    ],
    ...changes,
  } satisfies RewardGenerationConfigInput;
}

describe('Reward configuration authority', () => {
  it('creates the approved immutable ordinary-only configuration', () => {
    const result = createRewardGenerationConfig(config());
    expect(result).toEqual({ status: 'created', config: productionConfig() });
    if (result.status !== 'created') throw new Error('Expected config.');
    expect(Object.isFrozen(result.config)).toBe(true);
    expect(Object.isFrozen(result.config.payloads)).toBe(true);
    expect(result.config.payloads.every((entry) => Object.isFrozen(entry) && Object.isFrozen(entry.payload))).toBe(true);
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid rewardCount %s', (rewardCount) => {
    expect(createRewardGenerationConfig(config({ rewardCount }))).toMatchObject({
      status: 'invalid', reason: 'invalid-reward-count',
    });
  });

  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid weight %s', (weight) => {
    const input = config({ payloads: config().payloads.map((entry, index) =>
      index === 0 ? { ...entry, weight } : entry) });
    expect(createRewardGenerationConfig(input)).toMatchObject({ status: 'invalid', reason: 'invalid-weight' });
  });

  it('rejects empty, wrong-total, malformed payload, and one-time policies', () => {
    expect(createRewardGenerationConfig(config({ payloads: [] }))).toMatchObject({ reason: 'empty-payload-distribution' });
    const wrongTotal = config({ payloads: config().payloads.map((entry, index) =>
      index === 0 ? { ...entry, weight: 49 } : entry) });
    expect(createRewardGenerationConfig(wrongTotal)).toMatchObject({ reason: 'invalid-weight-total' });
    const badItem = config({ payloads: config().payloads.map((entry, index) =>
      index === 1 ? { ...entry, payload: { kind: 'item', item: 'future', quantity: 1 } } : entry) });
    expect(createRewardGenerationConfig(badItem)).toMatchObject({ reason: 'invalid-payload' });
    const badQuantity = config({ payloads: config().payloads.map((entry, index) =>
      index === 1 ? { ...entry, payload: { kind: 'item', item: 'lucky', quantity: 0 } } : entry) });
    expect(createRewardGenerationConfig(badQuantity)).toMatchObject({ reason: 'invalid-payload' });
    expect(createRewardGenerationConfig({ ...config(), oneTimeClaimId: 'claim' as never }))
      .toMatchObject({ reason: 'invalid-one-time-policy' });
  });

  it('copies mutable configuration input', () => {
    const input = {
      rewardCount: 2,
      oneTimeClaimId: null,
      payloads: [{ weight: 100, payload: { kind: 'coins' as const, amount: 1 } }],
    };
    const result = createRewardGenerationConfig(input);
    if (result.status !== 'created') throw new Error('Expected config.');
    input.payloads[0]!.weight = 1;
    input.payloads[0]!.payload.amount = 99;
    expect(result.config.payloads[0]).toEqual({ weight: 100, payload: { kind: 'coins', amount: 1 } });
  });
});

describe('Reward payload buckets and deterministic generation', () => {
  it.each([
    [0, { kind: 'coins', amount: 1 }], [49, { kind: 'coins', amount: 1 }],
    [50, { kind: 'item', item: 'detection', quantity: 1 }], [69, { kind: 'item', item: 'detection', quantity: 1 }],
    [70, { kind: 'item', item: 'revive', quantity: 1 }], [84, { kind: 'item', item: 'revive', quantity: 1 }],
    [85, { kind: 'item', item: 'lucky', quantity: 1 }], [94, { kind: 'item', item: 'lucky', quantity: 1 }],
    [95, { kind: 'item', item: 'airplane', quantity: 1 }], [99, { kind: 'item', item: 'airplane', quantity: 1 }],
  ] as const)('maps roll %s to its frozen payload bucket', (roll, payload) => {
    expect(selectRewardPayload(productionConfig(), roll)).toEqual(payload);
  });

  it('selects only unique row-major Safe candidates and leaves Mine/Obstacle outside', () => {
    const result = generateRewards({ board: board(), generationSeed: 123, config: productionConfig() });
    expect(result.status).toBe('generated');
    if (result.status !== 'generated') return;
    const keys = result.rewards.map(({ coordinate }) => `${coordinate.x},${coordinate.y}`);
    expect(new Set(keys).size).toBe(2);
    expect(keys).not.toContain('2,0');
    expect(keys).not.toContain('1,1');
    expect(result.rewards.every((reward) => reward.claimed === false && reward.oneTimeClaimId === null)).toBe(true);
  });

  it('rejects insufficient Safe cells without clamping and allows exact/zero generic counts', () => {
    const tooMany = createRewardGenerationConfig(config({ rewardCount: 2 }));
    const exact = createRewardGenerationConfig(config({ rewardCount: 1 }));
    const zero = createRewardGenerationConfig(config({ rewardCount: 0 }));
    if (tooMany.status !== 'created' || exact.status !== 'created' || zero.status !== 'created') throw new Error('config');
    const oneSafe = board('MOMOMOMOS');
    expect(generateRewards({ board: oneSafe, generationSeed: 1, config: tooMany.config }))
      .toEqual({ status: 'insufficient-safe-cells' });
    expect(generateRewards({ board: oneSafe, generationSeed: 1, config: exact.config })).toMatchObject({
      status: 'generated', rewards: [{ coordinate: { x: 2, y: 2 } }],
    });
    expect(generateRewards({ board: oneSafe, generationSeed: 1, config: zero.config })).toMatchObject({
      status: 'generated', rewards: [],
    });
  });

  it('rejects invalid uint32 generation seeds', () => {
    for (const generationSeed of [-1, 0.5, 0x1_0000_0000, Number.NaN]) {
      expect(generateRewards({ board: board(), generationSeed, config: productionConfig() }))
        .toEqual({ status: 'invalid-generation-seed' });
    }
  });

  it('locks the versioned domain and exact seed derivation/generation goldens', () => {
    expect(REWARD_RANDOM_DOMAIN).toBe('reward-generation-v1');
    const expected = [
      { generationSeed: 0, randomSeed: 4229908903, rolls: [52, 76], rewards: [
        { coordinate: { x: 0, y: 2 }, payload: { kind: 'item', item: 'detection', quantity: 1 } },
        { coordinate: { x: 0, y: 1 }, payload: { kind: 'item', item: 'revive', quantity: 1 } },
      ] },
      { generationSeed: 123456789, randomSeed: 4015527379, rolls: [63, 10], rewards: [
        { coordinate: { x: 0, y: 2 }, payload: { kind: 'item', item: 'detection', quantity: 1 } },
        { coordinate: { x: 2, y: 2 }, payload: { kind: 'coins', amount: 1 } },
      ] },
      { generationSeed: 0xffff_ffff, randomSeed: 1624359747, rolls: [90, 24], rewards: [
        { coordinate: { x: 0, y: 0 }, payload: { kind: 'item', item: 'lucky', quantity: 1 } },
        { coordinate: { x: 0, y: 1 }, payload: { kind: 'coins', amount: 1 } },
      ] },
    ];
    for (const vector of expected) {
      const result = generateRewards({ board: board(), generationSeed: vector.generationSeed, config: productionConfig() });
      expect(deriveRewardRandomSeed(vector.generationSeed)).toBe(vector.randomSeed);
      const replay = createSeededRandomSource(vector.randomSeed);
      replay.nextInt(7);
      replay.nextInt(6);
      expect([replay.nextInt(100), replay.nextInt(100)]).toEqual(vector.rolls);
      expect(result).toMatchObject({
        status: 'generated', randomSeed: vector.randomSeed,
        rewards: vector.rewards.map((reward) => ({ ...reward, claimed: false, oneTimeClaimId: null })),
      });
    }
  });

  it('replays exactly 100 times without aliasing returned values', () => {
    const first = generateRewards({ board: board(), generationSeed: 77, config: productionConfig() });
    for (let retry = 0; retry < 100; retry += 1) {
      expect(generateRewards({ board: board(), generationSeed: 77, config: productionConfig() })).toEqual(first);
    }
    if (first.status !== 'generated') throw new Error('Expected generation.');
    expect(Object.isFrozen(first.rewards)).toBe(true);
    expect(first.rewards.every((reward) => Object.isFrozen(reward) && Object.isFrozen(reward.coordinate))).toBe(true);
  });

  it('does not use Math.random or advance Mine, Detection, or Benben random lifecycles', () => {
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    try {
      const mineControl = createSeededRandomSource(44);
      const mineCompared = createSeededRandomSource(44);
      const detectionBefore = createDetectionCandidate(detectionGame(undefined, { seed: 91 }), () => 0);
      const eligibilityBefore = deriveBenbenEligibility({ levelId: 'level', runId: 'run' });
      const cardBefore = deriveBenbenCard({ levelId: 'level', runId: 'run' });
      expect(mineControl.nextInt(100)).toBe(mineCompared.nextInt(100));
      generateRewards({ board: board(), generationSeed: 99, config: productionConfig() });
      expect(mineControl.nextInt(100)).toBe(mineCompared.nextInt(100));
      expect(createDetectionCandidate(detectionGame(undefined, { seed: 91 }), () => 0)).toEqual(detectionBefore);
      expect(deriveBenbenEligibility({ levelId: 'level', runId: 'run' })).toEqual(eligibilityBefore);
      expect(deriveBenbenCard({ levelId: 'level', runId: 'run' })).toEqual(cardBefore);
      expect(mathRandom).not.toHaveBeenCalled();
    } finally {
      mathRandom.mockRestore();
    }
  });
});
