import { describe, expect, it } from 'vitest';
import { SHOP_PRICES } from '../../src/config/shop-prices';
import { validateShopCatalog } from '../../src/core/shop';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';
import { MemoryStorage } from '../helpers/memory-storage';

const checked = validateShopCatalog(SHOP_PRICES);
if (checked.status !== 'valid') throw new Error('approved Shop catalog');
const catalog = checked.catalog;
const owner = { sessionId: 's5-09-owner', leaseToken: 's5-09-token' };
const clock = { nowMs: () => 100 };
const creation = { runId: 's5-09-new-attempt', baseSeed: 987654321,
  rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' };

function fixture() {
  const original = boardBrowserSave('coin-reward');
  if (original.rewardTarget === null) throw new Error('coin Reward target');
  const storage = new MemoryStorage();
  for (const [key, value] of original.entries) storage.data.set(key, value);
  const session = createProductionStage4Session(storage, owner, clock, catalog);
  const before = session.read();
  if (before.status !== 'loaded' || before.runtime.currentAttempt === null) throw new Error('strict v4 fixture');
  expect(before.persistence.revision).toBe(4);
  expect(before.runtime.currentAttempt.rewards.find((reward) =>
    reward.coordinate.x === original.rewardTarget!.x && reward.coordinate.y === original.rewardTarget!.y))
    .toMatchObject({ payload: { kind: 'coins' }, claimed: false, oneTimeClaimId: null });
  return { storage, session, target: original.rewardTarget, before };
}

function reopen(storage: MemoryStorage) {
  const result = createProductionStage4Session(storage, owner, clock, catalog).read();
  if (result.status !== 'loaded') throw new Error('v4 reopen');
  expect(result.persistence.sourceSaveVersion).toBe(4);
  return result;
}

describe('S5-09 G2 guarded four-commit integration, production L1 coin Reward fixture', () => {
  it('claims Reward, legally leaves, purchases at trusted price, then starts and reopens a new Attempt', () => {
    const f = fixture();
    const oldRunId = f.before.runtime.currentAttempt!.runId;
    const initialAccount = f.before.runtime.account;
    const claimed = f.session.execute({ kind: 'move', coordinate: f.target,
      expectedRevision: 4, expectedRunId: oldRunId });
    expect(claimed).toMatchObject({ status: 'committed', revision: 5 });
    if (claimed.status !== 'committed') throw new Error('Reward commit');
    expect(claimed.runtime.account.coins).toBe(initialAccount.coins + 1);
    expect(claimed.runtime.currentAttempt?.rewards.filter((reward) => reward.claimed)).toHaveLength(1);
    expect(reopen(f.storage).runtime).toEqual(claimed.runtime);

    const left = f.session.execute({ kind: 'abandon', expectedRevision: 5, expectedRunId: oldRunId });
    expect(left).toMatchObject({ status: 'committed', revision: 6, runtime: { currentAttempt: null } });
    if (left.status !== 'committed') throw new Error('leave commit');
    expect(left.runtime.account).toEqual(claimed.runtime.account);
    expect(reopen(f.storage).runtime).toEqual(left.runtime);

    const bought = f.session.execute({ kind: 'purchase', item: 'lucky', expectedRevision: 6, expectedRunId: null });
    expect(bought).toMatchObject({ status: 'committed', revision: 7, runtime: { currentAttempt: null } });
    if (bought.status !== 'committed') throw new Error('purchase commit');
    expect(bought.runtime.account).toEqual({ ...left.runtime.account,
      coins: left.runtime.account.coins - 1,
      inventory: { ...left.runtime.account.inventory, lucky: left.runtime.account.inventory.lucky + 1 } });
    expect(reopen(f.storage).runtime).toEqual(bought.runtime);

    const started = f.session.execute({ kind: 'start', levelId: 'level-001', creation,
      expectedRevision: 7, expectedRunId: null });
    expect(started).toMatchObject({ status: 'committed', revision: 8,
      runtime: { account: bought.runtime.account, currentAttempt: { runId: creation.runId } } });
    if (started.status !== 'committed') throw new Error('Start commit');
    expect(started.runtime.currentAttempt?.runId).not.toBe(oldRunId);
    expect(reopen(f.storage).runtime).toEqual(started.runtime);
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 8 });
  });

  it('never treats rejected or uncertain leave as permission to purchase', () => {
    const f = fixture();
    const oldRunId = f.before.runtime.currentAttempt!.runId;
    expect(f.session.execute({ kind: 'abandon', expectedRevision: 3, expectedRunId: oldRunId }))
      .toEqual({ status: 'rejected', reason: 'revision-conflict' });
    expect(f.session.execute({ kind: 'purchase', item: 'lucky', expectedRevision: 4, expectedRunId: null }))
      .toEqual({ status: 'rejected', reason: 'run-id-conflict' });
    f.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    expect(f.session.execute({ kind: 'abandon', expectedRevision: 4, expectedRunId: oldRunId }))
      .toEqual({ status: 'rejected', reason: 'commit-commit-outcome-uncertain' });
    expect(f.session.read()).toEqual(f.before);
    const actual = reopen(f.storage);
    expect(actual.runtime.currentAttempt?.runId).toBe(oldRunId);
    expect(actual.runtime.account).toEqual(f.before.runtime.account);
  });

  it('does not roll back a committed leave or purchase when the later independent commit fails', () => {
    const f = fixture();
    const oldRunId = f.before.runtime.currentAttempt!.runId;
    expect(f.session.execute({ kind: 'move', coordinate: f.target,
      expectedRevision: 4, expectedRunId: oldRunId })).toMatchObject({ status: 'committed', revision: 5 });
    expect(f.session.execute({ kind: 'abandon', expectedRevision: 5, expectedRunId: oldRunId }))
      .toMatchObject({ status: 'committed', revision: 6 });
    const accountOnly = reopen(f.storage);
    const inactive = () => {
      const snapshot = loadCommittedSnapshot(f.storage);
      if (snapshot.status !== 'loaded') throw new Error('committed snapshot');
      return snapshot.slot === 'A' ? SNAPSHOT_STORAGE_KEYS.slotB : SNAPSHOT_STORAGE_KEYS.slotA;
    };
    f.storage.failNext('write', inactive());
    expect(f.session.execute({ kind: 'purchase', item: 'lucky', expectedRevision: 6, expectedRunId: null }))
      .toEqual({ status: 'rejected', reason: 'commit-persistence-commit-failure' });
    expect(reopen(f.storage)).toEqual(accountOnly);
    expect(f.session.execute({ kind: 'purchase', item: 'lucky', expectedRevision: 6, expectedRunId: null }))
      .toMatchObject({ status: 'committed', revision: 7 });
    const purchased = reopen(f.storage);
    f.storage.failNext('write', inactive());
    expect(f.session.execute({ kind: 'start', levelId: 'level-001', creation,
      expectedRevision: 7, expectedRunId: null }))
      .toEqual({ status: 'rejected', reason: 'commit-persistence-commit-failure' });
    expect(reopen(f.storage)).toEqual(purchased);
    expect(purchased.runtime.currentAttempt).toBeNull();
    expect(purchased.runtime.account.coins).toBe(accountOnly.runtime.account.coins - 1);
  });
});
