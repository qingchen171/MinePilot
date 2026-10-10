import { describe, expect, it } from 'vitest';
import { createInitialStage4GameState, type Stage4GameState } from '../../../../src/core/stage4-game-state';
import { createCompleteAttempt } from '../../../../src/core/stage4-attempt-factory';
import { PRODUCTION_LEVEL_CATALOG } from '../../../../src/core/level-catalog';
import { proveCommittedRewardReceipt } from '../../../../src/systems/presentation/reward-receipt';

function scenario() {
  const created = createCompleteAttempt({ level: PRODUCTION_LEVEL_CATALOG.levels[0]!, runId: 'receipt-run',
    generationProvenance: { seed: 19, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
  if (created.status !== 'created' || created.attempt.rewards.length === 0) throw new Error('fixture');
  const pre: Stage4GameState = { ...createInitialStage4GameState(), currentAttempt: created.attempt };
  const reward = created.attempt.rewards[0]!;
  const width = created.attempt.run.board.dimensions.width;
  const index = reward.coordinate.y * width + reward.coordinate.x;
  const cells = [...created.attempt.run.board.cells];
  const cell = cells[index];
  if (cell?.kind !== 'safe') throw new Error('Reward fixture must be on Safe');
  cells[index] = { kind: 'safe', exploration: 'explored', flagged: false };
  const post: Stage4GameState = { ...pre, currentAttempt: { ...created.attempt,
    run: { ...created.attempt.run, board: { ...created.attempt.run.board, cells } },
    rewards: created.attempt.rewards.map((entry, at) => at === 0 ? { ...entry, claimed: true } : entry),
  }, account: { ...pre.account, coins: pre.account.coins +
    (reward.payload.kind === 'coins' ? reward.payload.amount : 0),
    inventory: reward.payload.kind === 'item' ? {
      ...pre.account.inventory, [reward.payload.item]: pre.account.inventory[reward.payload.item] + reward.payload.quantity,
    } : pre.account.inventory,
  } };
  return { pre, post, reward };
}

describe('same-operation Reward receipt proof', () => {
  it('returns detached one-shot evidence for a committed Safe claim, not a later read', () => {
    const { pre, post, reward } = scenario();
    const proof = proveCommittedRewardReceipt(pre, post, 'move', 'receipt-run', 4, 5);
    expect(proof).toMatchObject({ status: 'proven', entries: [{ coordinate: reward.coordinate,
      payload: reward.payload, oneTime: false }] });
    if (proof.status !== 'proven') return;
    expect(proof.entries[0]).not.toBe(reward);
    expect(Object.isFrozen(proof.entries[0]?.payload)).toBe(true);
    expect(proveCommittedRewardReceipt(pre, post, 'flag', 'receipt-run', 4, 5))
      .toEqual({ status: 'proven', entries: [] });
  });

  it('rejects revision, run, payload, exploration and claim inconsistencies without inventing a receipt', () => {
    const { pre, post } = scenario();
    expect(proveCommittedRewardReceipt(pre, post, 'airplane', 'receipt-run', 4, 7).status).toBe('insufficient-proof');
    expect(proveCommittedRewardReceipt(pre, post, 'move', 'another-run', 4, 5).status).toBe('insufficient-proof');
    const changed = post.currentAttempt!;
    const brokenPayload = { ...post, currentAttempt: { ...changed,
      rewards: changed.rewards.map((entry, index) => index === 0
        ? { ...entry, payload: { kind: 'coins' as const, amount: 999 } } : entry),
    } };
    expect(proveCommittedRewardReceipt(pre, brokenPayload, 'move', 'receipt-run', 4, 5).status).toBe('insufficient-proof');
    expect(proveCommittedRewardReceipt(pre, { ...post, currentAttempt: { ...changed,
      run: pre.currentAttempt!.run } }, 'move', 'receipt-run', 4, 5).status).toBe('insufficient-proof');
    expect(proveCommittedRewardReceipt(pre, { ...post, account: { ...post.account,
      oneTimeClaimIds: ['unexpected'] } }, 'move', 'receipt-run', 4, 5).status).toBe('insufficient-proof');
  });

  it('proves one-time Account synchronization and rejects duplicate or missing claim IDs', () => {
    const { pre, post } = scenario();
    const prior = pre.currentAttempt!;
    const after = post.currentAttempt!;
    const withIdBefore: Stage4GameState = { ...pre, currentAttempt: { ...prior,
      rewards: prior.rewards.map((entry, index) => index === 0
        ? { ...entry, oneTimeClaimId: 'one-time-proof' } : entry),
    } };
    const withIdAfter: Stage4GameState = { ...post, account: { ...post.account,
      oneTimeClaimIds: ['one-time-proof'] }, currentAttempt: { ...after,
        rewards: after.rewards.map((entry, index) => index === 0
          ? { ...entry, oneTimeClaimId: 'one-time-proof' } : entry),
      } };
    expect(proveCommittedRewardReceipt(withIdBefore, withIdAfter, 'airplane', 'receipt-run', 4, 5))
      .toMatchObject({ status: 'proven', entries: [{ oneTime: true }] });
    expect(proveCommittedRewardReceipt(withIdBefore, { ...withIdAfter, account: {
      ...withIdAfter.account, oneTimeClaimIds: [],
    } }, 'airplane', 'receipt-run', 4, 5).status).toBe('insufficient-proof');
    expect(proveCommittedRewardReceipt(withIdBefore, { ...withIdAfter, account: {
      ...withIdAfter.account, oneTimeClaimIds: ['one-time-proof', 'one-time-proof'],
    } }, 'airplane', 'receipt-run', 4, 5).status).toBe('insufficient-proof');
  });
});
