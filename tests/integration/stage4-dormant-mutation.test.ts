import { describe, expect, it } from 'vitest';
import { createLevelCatalog, PRODUCTION_LEVEL_CATALOG, type LevelCatalog } from '../../src/core/level-catalog';
import { createStage4GameState, type Stage4GameState } from '../../src/core/stage4-game-state';
import { mapStage4RuntimeToSaveV3 } from '../../src/core/persistence/stage4-runtime-mapping';
import { loadCommittedSnapshot, commitSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { readDormantStage4Runtime } from '../../src/systems/persistence/dormant-stage4-reader';
import {
  executeDormantStage4Mutation,
  type DormantCommitBoundary,
  type DormantMutationIntent,
} from '../../src/systems/persistence/dormant-stage4-mutation';
import { MemoryStorage } from '../helpers/memory-storage';
import { createGameState } from '../../src/core/game-state';
import { createAccountState } from '../../src/core/account';
import { createStage4AccountState } from '../../src/core/stage4-account';
import { serializeSaveDocumentV2 } from '../../src/core/persistence/save-v2';
import { moveCharacter } from '../../src/core/movement';
import { settleMineEncounterAsFailure } from '../../src/core/encounter';
import { createTemporaryBenbenCard } from '../../src/core/temporary-benben-card';
import type { RewardItem } from '../../src/core/reward';
import { deriveBenbenEligibility } from '../../src/core/benben-random';
import { selectMineCoordinates } from '../../src/core/mine-placement';
import { createSeededRandomSource } from '../../src/core/random';
import { acquireWriterLease, inspectWriterLease, WRITER_LEASE_STORAGE_KEY } from '../../src/systems/persistence/writer-lease';

const creation = (runId: string, baseSeed = 123456789) => ({
  runId, baseSeed, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1',
});

function smallCatalog(rewardCount = 0): LevelCatalog {
  const result = createLevelCatalog([
    { levelId: 'level-001', board: { dimensions: { width: 2, height: 1 }, mineCount: 1, obstacleCoordinates: [] }, rewards: { rewardCount, oneTimeClaimId: null, payloads: [{ weight: 100, payload: { kind: 'coins', amount: 1 } }] } },
    { levelId: 'level-002', board: { dimensions: { width: 2, height: 1 }, mineCount: 1, obstacleCoordinates: [] }, rewards: { rewardCount: 0, oneTimeClaimId: null, payloads: [{ weight: 100, payload: { kind: 'coins', amount: 1 } }] } },
  ]);
  if (result.status !== 'created') throw new Error('catalog fixture');
  return result.catalog;
}

function fixture(catalog: LevelCatalog = PRODUCTION_LEVEL_CATALOG) {
  const storage = new MemoryStorage();
  let commits = 0;
  let failCommit = false;
  let loseOwnershipOnCommit = false;
  const owner = { sessionId: 'original-session', leaseToken: 'original-token' };
  const clock = { nowMs: () => 100 };
  if (acquireWriterLease(storage, owner, clock).status !== 'acquired') throw new Error('lease fixture');
  const attempts: string[] = [];
  const seam: DormantCommitBoundary = {
    commit(document, expectedRevision) {
      commits++;
      attempts.push(JSON.stringify(document));
      if (failCommit) return { status: 'rejected', reason: 'injected-failure' };
      if (loseOwnershipOnCommit) {
        // Deterministic takeover after candidate composition, before the test commit boundary.
        storage.write(WRITER_LEASE_STORAGE_KEY, JSON.stringify({ formatVersion: 1, sessionId: 'racer', leaseToken: 'racer-token', expiresAtMs: 30_100 }));
        loseOwnershipOnCommit = false;
      }
      const lease = inspectWriterLease(storage, clock);
      if (lease.status !== 'active' || lease.lease.sessionId !== owner.sessionId || lease.lease.leaseToken !== owner.leaseToken) {
        return { status: 'rejected', reason: 'lost-ownership' };
      }
      const current = loadCommittedSnapshot(storage);
      if (current.status !== 'no-save' && current.status !== 'loaded' && current.status !== 'recovered-from-backup') {
        return { status: 'rejected', reason: 'unavailable' };
      }
      const actual = current.status === 'no-save' ? null : current.revision;
      if (actual !== expectedRevision || document.revision !== (actual === null ? 0 : actual + 1)) {
        return { status: 'rejected', reason: 'revision-conflict' };
      }
      const committed = commitSnapshot(storage, JSON.stringify(document), document.revision);
      return committed.status === 'committed'
        ? { status: 'committed' } : { status: 'rejected', reason: committed.status };
    },
  };
  function run(intent: DormantMutationIntent) { return executeDormantStage4Mutation(storage, intent, seam, catalog); }
  function current() {
    const loaded = readDormantStage4Runtime(loadCommittedSnapshot(storage));
    if (loaded.status !== 'fresh' && loaded.status !== 'loaded') throw new Error(`restore: ${loaded.status}`);
    return { runtime: loaded.runtime, revision: loaded.status === 'fresh' ? null : loaded.persistence.revision };
  }
  function start(runId = 'run-1', seed = 123456789) {
    const result = run({ kind: 'start', expectedRevision: null, expectedRunId: null, levelId: 'level-001', creation: creation(runId, seed) });
    expect(result.status).toBe('committed');
    return current();
  }
  function persist(runtime: Stage4GameState, revision: number) {
    const mapped = mapStage4RuntimeToSaveV3(runtime, revision);
    if (mapped.status !== 'mapped') throw new Error(`mapping fixture: ${mapped.status}`);
    const result = commitSnapshot(storage, JSON.stringify(mapped.document), revision);
    if (result.status !== 'committed') throw new Error(`persistence fixture: ${result.status}`);
  }
  return { storage, run, current, start, persist, attempts, get commits() { return commits; }, setFailure(value: boolean) { failCommit = value; }, loseOwnership() { loseOwnershipOnCommit = true; }, restoreOwnership() { storage.write(WRITER_LEASE_STORAGE_KEY, JSON.stringify({ formatVersion: 1, ...owner, expiresAtMs: 30_100 })); } };
}

function coordinates(runtime: Stage4GameState, kind: 'mine' | 'safe') {
  const board = runtime.currentAttempt!.run.board;
  return board.cells.flatMap((cell, index) => cell.kind === kind
    ? [{ x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) }] : []);
}

function firstSafe(f: ReturnType<typeof fixture>) { return coordinates(f.current().runtime, 'safe')[0]!; }
function firstMine(f: ReturnType<typeof fixture>) { return coordinates(f.current().runtime, 'mine')[0]!; }
function moveToSafe(f: ReturnType<typeof fixture>, runId = 'run-1') {
  const revision = f.current().revision!;
  expect(f.run({ kind: 'move', expectedRevision: revision, expectedRunId: runId, coordinate: firstSafe(f) }).status).toBe('committed');
}
function enterPending(f: ReturnType<typeof fixture>) {
  moveToSafe(f);
  const revision = f.current().revision!;
  expect(f.run({ kind: 'move', expectedRevision: revision, expectedRunId: 'run-1', coordinate: firstMine(f) }).status).toBe('committed');
}
function injectTemporaryCard(f: ReturnType<typeof fixture>, item: RewardItem) {
  const old = f.current();
  const runtime = createStage4GameState({
    account: createStage4AccountState({ ...old.runtime.account, benbenByLevel: [{ levelId: 'level-001', status: 'used', failureStreak: 0 }] }),
    currentAttempt: { ...old.runtime.currentAttempt!, temporaryBenbenCard: createTemporaryBenbenCard({ item, consumed: false }) },
  });
  const revision = old.revision! + 1;
  f.persist(runtime, revision);
  return revision;
}

type Prepared = { readonly f: ReturnType<typeof fixture>; readonly intent: DormantMutationIntent };
function prepareWritingCommand(kind: string): Prepared {
  const f = fixture(kind === 'next' || kind === 'replay' || kind === 'dismiss' ? smallCatalog() : PRODUCTION_LEVEL_CATALOG);
  if (kind === 'start') return { f, intent: { kind: 'start', expectedRevision: null, expectedRunId: null, levelId: 'level-001', creation: creation('run-1') } };
  f.start();
  if (kind === 'abandon') return { f, intent: { kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-1' } };
  if (kind === 'restart') return { f, intent: { kind: 'restart', expectedRevision: 0, expectedRunId: 'run-1', creation: creation('run-2', 44) } };
  if (kind === 'flag') return { f, intent: { kind: 'flag', expectedRevision: 0, expectedRunId: 'run-1', coordinate: firstSafe(f), flagged: true } };
  if (kind === 'safe-movement') return { f, intent: { kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: firstSafe(f) } };
  if (kind === 'lucky-survival') return { f, intent: { kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: firstMine(f) } };
  if (kind === 'airplane') return { f, intent: { kind: 'airplane', expectedRevision: 0, expectedRunId: 'run-1', coordinate: firstSafe(f) } };
  if (kind === 'claim') {
    const old = f.current().runtime;
    f.persist(createStage4GameState({ account: createStage4AccountState({ ...old.account, benbenByLevel: [{ levelId: 'level-001', status: 'available', failureStreak: 0 }] }), currentAttempt: old.currentAttempt }), 1);
    return { f, intent: { kind: 'claim-benben', expectedRevision: 1, expectedRunId: 'run-1' } };
  }
  if (kind === 'next' || kind === 'replay' || kind === 'dismiss') {
    expect(f.run({ kind: 'airplane', expectedRevision: 0, expectedRunId: 'run-1', coordinate: firstSafe(f) }).status).toBe('committed');
    if (kind === 'next') return { f, intent: { kind: 'next', expectedRevision: 1, expectedRunId: 'run-1', creation: creation('run-2', 44) } };
    if (kind === 'replay') return { f, intent: { kind: 'replay', expectedRevision: 1, expectedRunId: 'run-1', creation: creation('run-2', 44) } };
    return { f, intent: { kind: 'dismiss', expectedRevision: 1, expectedRunId: 'run-1' } };
  }
  if (kind === 'retry') {
    enterPending(f);
    expect(f.run({ kind: 'failure', expectedRevision: 2, expectedRunId: 'run-1' }).status).toBe('committed');
    return { f, intent: { kind: 'retry', expectedRevision: 3, expectedRunId: 'run-1', creation: creation('run-2', 44) } };
  }
  if (kind === 'detection') {
    const mine = firstMine(f);
    const neighbor = coordinates(f.current().runtime, 'safe').find(({ x, y }) => Math.abs(x - mine.x) <= 1 && Math.abs(y - mine.y) <= 1)!;
    expect(f.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: neighbor }).status).toBe('committed');
    return { f, intent: { kind: 'detection', expectedRevision: 1, expectedRunId: 'run-1', initializeSeed: 33 } };
  }
  if (kind === 'mine-movement') {
    moveToSafe(f);
    return { f, intent: { kind: 'move', expectedRevision: 1, expectedRunId: 'run-1', coordinate: firstMine(f) } };
  }
  enterPending(f);
  if (kind === 'failure') return { f, intent: { kind: 'failure', expectedRevision: 2, expectedRunId: 'run-1' } };
  if (kind === 'revive') return { f, intent: { kind: 'revive', expectedRevision: 2, expectedRunId: 'run-1' } };
  throw new Error(`unknown writing command: ${kind}`);
}

describe('S4-08.3 dormant committed-read mutation chain', () => {
  for (const kind of ['start', 'abandon', 'dismiss', 'restart', 'retry', 'replay', 'next', 'flag', 'safe-movement', 'mine-movement', 'lucky-survival', 'failure', 'detection', 'airplane', 'revive', 'claim']) {
    it(`${kind} commit rejection preserves old persisted authority and retry uses the same candidate`, () => {
      const { f, intent } = prepareWritingCommand(kind);
      const before = f.current();
      f.setFailure(true);
      const rejected = f.run(intent);
      expect(rejected).toEqual({ status: 'rejected', reason: 'commit-injected-failure' });
      expect('runtime' in rejected).toBe(false);
      expect(f.current()).toEqual(before);
      const firstCandidate = f.attempts.at(-1);
      expect(firstCandidate).toBeDefined();
      f.setFailure(false);
      expect(f.run(intent).status).toBe('committed');
      expect(f.attempts.at(-1)).toBe(firstCandidate);
    });
  }

  it('lease loss after composition rejects commit without publish, then retry rereads authority', () => {
    const { f, intent } = prepareWritingCommand('airplane');
    const before = f.current();
    f.loseOwnership();
    expect(f.run(intent)).toEqual({ status: 'rejected', reason: 'commit-lost-ownership' });
    expect(f.current()).toEqual(before);
    f.restoreOwnership();
    expect(f.run(intent).status).toBe('committed');
  });

  it('temporary Lucky is consumed before permanent inventory and terminal clears the card', () => {
    const f = fixture();
    f.start();
    const revision = injectTemporaryCard(f, 'lucky');
    const originalLucky = f.current().runtime.account.inventory.lucky;
    expect(f.run({ kind: 'move', expectedRevision: revision, expectedRunId: 'run-1', coordinate: firstMine(f) }).status).toBe('committed');
    const survived = f.current();
    expect(survived.runtime.account.inventory.lucky).toBe(originalLucky);
    expect(survived.runtime.currentAttempt?.temporaryBenbenCard).toEqual({ item: 'lucky', consumed: true });
    const safe = firstSafe(f);
    expect(f.run({ kind: 'move', expectedRevision: survived.revision, expectedRunId: 'run-1', coordinate: safe }).status).toBe('committed');
    // The consumed card remains an attempt fact until its terminal transition.
    expect(f.current().runtime.currentAttempt?.temporaryBenbenCard?.consumed).toBe(true);
  });

  it('temporary Airplane wins without permanent consumption and expires at terminal', () => {
    const f = fixture(smallCatalog());
    f.start();
    const revision = injectTemporaryCard(f, 'airplane');
    const permanent = f.current().runtime.account.inventory.airplane;
    expect(f.run({ kind: 'airplane', expectedRevision: revision, expectedRunId: 'run-1', coordinate: firstSafe(f) }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.account.inventory.airplane).toBe(permanent);
    expect(after.currentAttempt?.runItems.successfulAirplaneUses).toBe(1);
    expect(after.currentAttempt?.run.phase.kind).toBe('won');
    expect(after.currentAttempt?.temporaryBenbenCard).toBeNull();
  });

  it('mismatched temporary card falls back to permanent inventory without consuming card', () => {
    const f = fixture();
    f.start();
    const revision = injectTemporaryCard(f, 'detection');
    const before = f.current().runtime.account.inventory.airplane;
    expect(f.run({ kind: 'airplane', expectedRevision: revision, expectedRunId: 'run-1', coordinate: firstSafe(f) }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.account.inventory.airplane).toBe(before - 1);
    expect(after.currentAttempt?.temporaryBenbenCard).toEqual({ item: 'detection', consumed: false });
  });

  it('temporary Detection and Revive each consume card before permanent inventory', () => {
    const detection = fixture();
    detection.start();
    const mine = firstMine(detection);
    const neighbor = coordinates(detection.current().runtime, 'safe').find(({ x, y }) => Math.abs(x - mine.x) <= 1 && Math.abs(y - mine.y) <= 1)!;
    expect(detection.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: neighbor }).status).toBe('committed');
    const detectionRevision = injectTemporaryCard(detection, 'detection');
    const detectionInventory = detection.current().runtime.account.inventory.detection;
    expect(detection.run({ kind: 'detection', expectedRevision: detectionRevision, expectedRunId: 'run-1', initializeSeed: 4 }).status).toBe('committed');
    expect(detection.current().runtime.account.inventory.detection).toBe(detectionInventory);
    expect(detection.current().runtime.currentAttempt?.temporaryBenbenCard).toEqual({ item: 'detection', consumed: true });

    const revive = fixture();
    revive.start();
    enterPending(revive);
    const reviveRevision = injectTemporaryCard(revive, 'revive');
    const reviveInventory = revive.current().runtime.account.inventory.revive;
    expect(revive.run({ kind: 'revive', expectedRevision: reviveRevision, expectedRunId: 'run-1' }).status).toBe('committed');
    expect(revive.current().runtime.account.inventory.revive).toBe(reviveInventory);
    expect(revive.current().runtime.currentAttempt?.temporaryBenbenCard).toEqual({ item: 'revive', consumed: true });
  });

  it('third settled failure derives Benben eligibility once; same failed intent retries deterministically', () => {
    const f = fixture();
    f.start();
    for (let cycle = 1; cycle <= 3; cycle++) {
      const runId = `run-${cycle}`;
      moveToSafe(f, runId);
      const mineIntent = { kind: 'move' as const, expectedRevision: f.current().revision, expectedRunId: runId, coordinate: firstMine(f) };
      expect(f.run(mineIntent).status).toBe('committed');
      const failureIntent = { kind: 'failure' as const, expectedRevision: f.current().revision, expectedRunId: runId };
      const before = f.current();
      f.setFailure(true);
      expect(f.run(failureIntent).status).toBe('rejected');
      const firstCandidate = f.attempts.at(-1);
      expect(f.current()).toEqual(before);
      f.setFailure(false);
      expect(f.run(failureIntent).status).toBe('committed');
      expect(f.attempts.at(-1)).toBe(firstCandidate);
      const record = f.current().runtime.account.benbenByLevel[0];
      if (cycle < 3) expect(record).toMatchObject({ status: 'unavailable', failureStreak: cycle });
      else {
        const derivation = deriveBenbenEligibility({ levelId: 'level-001', runId });
        if (derivation.status !== 'derived') throw new Error('eligibility fixture');
        expect(record).toMatchObject({ status: derivation.success ? 'available' : 'unavailable', failureStreak: 0 });
      }
      if (cycle < 3) {
        expect(f.run({ kind: 'retry', expectedRevision: f.current().revision, expectedRunId: runId, creation: creation(`run-${cycle + 1}`, 100 + cycle) }).status).toBe('committed');
      }
    }
  });

  for (const status of ['available', 'used'] as const) {
    it(`Benben ${status} entitlement does not reroll on Failure`, () => {
      const f = fixture();
      f.start();
      const old = f.current().runtime;
      f.persist(createStage4GameState({ account: createStage4AccountState({ ...old.account, benbenByLevel: [{ levelId: 'level-001', status, failureStreak: 0 }] }), currentAttempt: old.currentAttempt }), 1);
      moveToSafe(f);
      expect(f.run({ kind: 'move', expectedRevision: 2, expectedRunId: 'run-1', coordinate: firstMine(f) }).status).toBe('committed');
      expect(f.run({ kind: 'failure', expectedRevision: 3, expectedRunId: 'run-1' }).status).toBe('committed');
      expect(f.current().runtime.account.benbenByLevel).toEqual([{ levelId: 'level-001', status, failureStreak: 0 }]);
      expect(f.current().runtime.currentAttempt?.terminalDisposition).toBe('settled');
    });
  }

  it('Claim and first movement race on the same revision; only one may commit', () => {
    const f = fixture();
    f.start();
    const before = f.current().runtime;
    f.persist(createStage4GameState({ account: createStage4AccountState({ ...before.account, benbenByLevel: [{ levelId: 'level-001', status: 'available', failureStreak: 0 }] }), currentAttempt: before.currentAttempt }), 1);
    const move = { kind: 'move' as const, expectedRevision: 1, expectedRunId: 'run-1', coordinate: firstSafe(f) };
    const claim = { kind: 'claim-benben' as const, expectedRevision: 1, expectedRunId: 'run-1' };
    expect(f.run(claim).status).toBe('committed');
    expect(f.run(move)).toEqual({ status: 'rejected', reason: 'revision-conflict' });
    expect(f.current().runtime.currentAttempt?.temporaryBenbenCard).not.toBeNull();
  });

  it('Airplane claims multiple Safe Rewards before one terminal settlement', () => {
    const catalog = createLevelCatalog([{ levelId: 'level-001', board: { dimensions: { width: 3, height: 1 }, mineCount: 0, obstacleCoordinates: [] }, rewards: { rewardCount: 2, oneTimeClaimId: null, payloads: [{ weight: 100, payload: { kind: 'coins', amount: 1 } }] } }]);
    if (catalog.status !== 'created') throw new Error('multi reward catalog');
    const f = fixture(catalog.catalog);
    f.start();
    expect(f.run({ kind: 'airplane', expectedRevision: 0, expectedRunId: 'run-1', coordinate: { x: 1, y: 0 } }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.currentAttempt?.rewards).toHaveLength(2);
    expect(after.currentAttempt?.rewards.every((reward) => reward.claimed)).toBe(true);
    expect(after.account.coins).toBe(2);
    expect(after.currentAttempt?.terminalDisposition).toBe('settled');
    expect(after.currentAttempt?.run.phase.kind).toBe('won');
  });

  it('Reward coin overflow rejects whole Airplane transition before commit', () => {
    const f = fixture(smallCatalog(1));
    f.start();
    const old = f.current().runtime;
    f.persist(createStage4GameState({ account: createStage4AccountState({ ...old.account, coins: Number.MAX_SAFE_INTEGER }), currentAttempt: old.currentAttempt }), 1);
    const before = f.current();
    const commits = f.commits;
    expect(f.run({ kind: 'airplane', expectedRevision: 1, expectedRunId: 'run-1', coordinate: firstSafe(f) })).toEqual({ status: 'rejected', reason: 'reward-asset-overflow' });
    expect(f.commits).toBe(commits);
    expect(f.current()).toEqual(before);
  });

  it('Reward Item overflow rejects whole Airplane transition before commit', () => {
    const catalog = createLevelCatalog([{ levelId: 'level-001', board: { dimensions: { width: 2, height: 1 }, mineCount: 1, obstacleCoordinates: [] }, rewards: { rewardCount: 1, oneTimeClaimId: null, payloads: [{ weight: 100, payload: { kind: 'item', item: 'detection', quantity: 1 } }] } }]);
    if (catalog.status !== 'created') throw new Error('item reward catalog');
    const f = fixture(catalog.catalog);
    f.start();
    const old = f.current().runtime;
    f.persist(createStage4GameState({ account: createStage4AccountState({ ...old.account, inventory: { ...old.account.inventory, detection: Number.MAX_SAFE_INTEGER } }), currentAttempt: old.currentAttempt }), 1);
    const before = f.current();
    const commits = f.commits;
    expect(f.run({ kind: 'airplane', expectedRevision: 1, expectedRunId: 'run-1', coordinate: firstSafe(f) })).toEqual({ status: 'rejected', reason: 'reward-asset-overflow' });
    expect(f.commits).toBe(commits);
    expect(f.current()).toEqual(before);
  });

  it('direct v3 one-time Reward is claimed through existing compatibility rule', () => {
    const f = fixture(smallCatalog(1));
    f.start();
    const old = f.current().runtime;
    const attempt = old.currentAttempt!;
    f.persist(createStage4GameState({
      account: old.account,
      currentAttempt: { ...attempt, rewards: [{ ...attempt.rewards[0]!, oneTimeClaimId: 'one-time-1' }] },
    }), 1);
    expect(f.run({ kind: 'airplane', expectedRevision: 1, expectedRunId: 'run-1', coordinate: firstSafe(f) }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.account.oneTimeClaimIds).toEqual(['one-time-1']);
    expect(after.currentAttempt?.rewards[0]).toMatchObject({ claimed: true, oneTimeClaimId: 'one-time-1' });
    expect(after.account.coins).toBe(1);
  });
  it('distinguishes no-save from revision zero; waiting Flag, Abandon and stale run gate', () => {
    const f = fixture();
    const started = f.start();
    expect(started.revision).toBe(0);
    expect(started.runtime.currentAttempt?.run.characterPosition.kind).toBe('waiting');
    const safe = coordinates(started.runtime, 'safe')[0]!;
    const flag = f.run({ kind: 'flag', expectedRevision: 0, expectedRunId: 'run-1', coordinate: safe, flagged: true });
    expect(flag.status).toBe('committed');
    const commitsAfterFlag = f.commits;
    const unchanged = f.run({ kind: 'flag', expectedRevision: 1, expectedRunId: 'run-1', coordinate: safe, flagged: true });
    expect(unchanged).toEqual({ status: 'rejected', reason: 'already-flagged' });
    expect(f.commits).toBe(commitsAfterFlag);
    expect(f.current().revision).toBe(1);
    expect(f.run({ kind: 'abandon', expectedRevision: 1, expectedRunId: 'wrong' })).toEqual({ status: 'rejected', reason: 'run-id-conflict' });
    expect(f.run({ kind: 'abandon', expectedRevision: 1, expectedRunId: 'run-1' }).status).toBe('committed');
    expect(f.current().runtime.currentAttempt).toBeNull();
    expect(f.run({ kind: 'start', expectedRevision: 1, expectedRunId: null, levelId: 'level-001', creation: creation('run-2') })).toEqual({ status: 'rejected', reason: 'revision-conflict' });
  });

  it('account-only replay is not a separate authority path; Start is the only new-attempt entry', () => {
    const f = fixture();
    f.start();
    expect(f.run({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-1' }).status).toBe('committed');
    const before = f.current();
    const count = f.commits;
    expect(f.run({ kind: 'replay', expectedRevision: 1, expectedRunId: null, creation: creation('run-2') })).toEqual({ status: 'rejected', reason: 'no-attempt' });
    expect(f.commits).toBe(count);
    expect(f.current()).toEqual(before);
    expect(f.run({ kind: 'start', expectedRevision: 1, expectedRunId: null, levelId: 'level-001', creation: creation('run-2') }).status).toBe('committed');
  });

  it('active Attempt rejects terminal replacement and Claim without entitlement without writing', () => {
    const f = fixture(smallCatalog());
    f.start();
    const before = f.current();
    const commits = f.commits;
    expect(f.run({ kind: 'replay', expectedRevision: 0, expectedRunId: 'run-1', creation: creation('run-2') })).toEqual({ status: 'rejected', reason: 'invalid-phase' });
    expect(f.run({ kind: 'next', expectedRevision: 0, expectedRunId: 'run-1', creation: creation('run-2') })).toEqual({ status: 'rejected', reason: 'invalid-phase' });
    expect(f.run({ kind: 'dismiss', expectedRevision: 0, expectedRunId: 'run-1' })).toEqual({ status: 'rejected', reason: 'invalid-phase' });
    expect(f.run({ kind: 'claim-benben', expectedRevision: 0, expectedRunId: 'run-1' })).toEqual({ status: 'rejected', reason: 'no-matching-entitlement' });
    expect(f.commits).toBe(commits);
    expect(f.current()).toEqual(before);
  });

  it('refresh reads the same persisted Reward facts without commit or generation', () => {
    const f = fixture();
    const first = f.start();
    const commits = f.commits;
    const second = f.current();
    const third = f.current();
    expect(second.runtime.currentAttempt?.rewards).toEqual(first.runtime.currentAttempt?.rewards);
    expect(third.runtime.currentAttempt?.rewards).toEqual(first.runtime.currentAttempt?.rewards);
    expect(second.runtime.currentAttempt?.rewards).not.toBe(third.runtime.currentAttempt?.rewards);
    expect(f.commits).toBe(commits);
    expect(third.revision).toBe(first.revision);
  });

  it('first Mine atomically Lucky-survives; later Mine stays pending and explicit failure settles', () => {
    const f = fixture();
    let state = f.start();
    const mine = coordinates(state.runtime, 'mine')[0]!;
    expect(f.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: mine }).status).toBe('committed');
    state = f.current();
    expect(state.runtime.currentAttempt?.run.phase.kind).toBe('active');
    expect(state.runtime.currentAttempt?.run.characterPosition.kind).toBe('revealed-mine-occupancy');
    expect(state.runtime.account.inventory.lucky).toBe(0);
    const safe = coordinates(state.runtime, 'safe')[0]!;
    expect(f.run({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-1', coordinate: safe }).status).toBe('committed');
    state = f.current();
    const otherMine = coordinates(state.runtime, 'mine').find(({ x, y }) => x !== mine.x || y !== mine.y)!;
    expect(f.run({ kind: 'move', expectedRevision: 2, expectedRunId: 'run-1', coordinate: otherMine }).status).toBe('committed');
    state = f.current();
    expect(state.runtime.currentAttempt?.run.phase.kind).toBe('pending-mine-encounter');
    expect(f.run({ kind: 'failure', expectedRevision: 3, expectedRunId: 'run-1' }).status).toBe('committed');
    state = f.current();
    expect(state.runtime.currentAttempt?.run.phase.kind).toBe('failed');
    expect(state.runtime.currentAttempt?.terminalDisposition).toBe('settled');
    expect(state.runtime.account.benbenByLevel[0]?.failureStreak).toBe(1);
  });

  it('waiting Airplane preserves step and can win; terminal Next and Replay follow committed Account', () => {
    const f = fixture(smallCatalog());
    let state = f.start();
    const safe = coordinates(state.runtime, 'safe')[0]!;
    const airplane = f.run({ kind: 'airplane', expectedRevision: 0, expectedRunId: 'run-1', coordinate: safe });
    expect(airplane.status).toBe('committed');
    state = f.current();
    expect(state.runtime.currentAttempt?.run.phase.kind).toBe('won');
    expect(state.runtime.currentAttempt?.run.characterPosition.kind).toBe('waiting');
    expect(state.runtime.currentAttempt?.run.hasTakenStep).toBe(false);
    expect(state.runtime.account.completedLevelIds).toEqual(['level-001']);
    expect(f.run({ kind: 'next', expectedRevision: 1, expectedRunId: 'run-1', creation: creation('run-2', 7) }).status).toBe('committed');
    state = f.current();
    expect(state.runtime.currentAttempt?.levelId).toBe('level-002');
    expect(state.runtime.currentAttempt?.run.characterPosition.kind).toBe('waiting');
    expect(f.run({ kind: 'replay', expectedRevision: 2, expectedRunId: 'run-2', creation: creation('run-3', 8) }).status).toBe('rejected');
  });

  it('commit failure returns no candidate, keeps old snapshot and deterministic retry result', () => {
    const f = fixture();
    f.setFailure(true);
    const intent = { kind: 'start' as const, expectedRevision: null, expectedRunId: null, levelId: 'level-001', creation: creation('stable', 42) };
    const failed = f.run(intent);
    expect(failed).toEqual({ status: 'rejected', reason: 'commit-injected-failure' });
    expect('runtime' in failed).toBe(false);
    expect(f.current().revision).toBeNull();
    f.setFailure(false);
    const succeeded = f.run(intent);
    expect(succeeded.status).toBe('committed');
    if (succeeded.status !== 'committed') return;
    const mapped = mapStage4RuntimeToSaveV3(succeeded.runtime, succeeded.revision);
    expect(mapped.status).toBe('mapped');
    expect(f.current().runtime.currentAttempt?.runId).toBe('stable');
  });

  it('waiting Detection is a zero-write rejection and revision/runId gates precede composition', () => {
    const f = fixture();
    f.start();
    const count = f.commits;
    expect(f.run({ kind: 'detection', expectedRevision: 0, expectedRunId: 'run-1', initializeSeed: 3 })).toEqual({ status: 'rejected', reason: 'waiting' });
    expect(f.run({ kind: 'abandon', expectedRevision: 9, expectedRunId: 'run-1' })).toEqual({ status: 'rejected', reason: 'revision-conflict' });
    expect(f.run({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'wrong' })).toEqual({ status: 'rejected', reason: 'run-id-conflict' });
    expect(f.run({ kind: 'abandon', expectedRevision: 9, expectedRunId: 'wrong' })).toEqual({ status: 'rejected', reason: 'revision-conflict' });
    expect(f.commits).toBe(count);
  });

  it('revisiting an explored Safe moves character without paying its Reward twice', () => {
    const f = fixture();
    f.start();
    const reward = f.current().runtime.currentAttempt!.rewards[0]!;
    expect(f.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: reward.coordinate }).status).toBe('committed');
    const claimed = f.current().runtime;
    const other = coordinates(claimed, 'safe').find(({ x, y }) => x !== reward.coordinate.x || y !== reward.coordinate.y)!;
    expect(f.run({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-1', coordinate: other }).status).toBe('committed');
    const accountBeforeRevisit = f.current().runtime.account;
    expect(f.run({ kind: 'move', expectedRevision: 2, expectedRunId: 'run-1', coordinate: reward.coordinate }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.account).toEqual(accountBeforeRevisit);
    expect(after.currentAttempt?.rewards[0]?.claimed).toBe(true);
    expect(after.currentAttempt?.run.characterPosition).toEqual({ kind: 'on-board', coordinate: reward.coordinate });
  });

  it('pays last Safe Reward before terminal settlement in waiting Airplane and preserves Account inventory arithmetic', () => {
    const f = fixture(smallCatalog(1));
    f.start();
    const before = f.current();
    const safe = coordinates(before.runtime, 'safe')[0]!;
    expect(before.runtime.currentAttempt?.rewards).toHaveLength(1);
    expect(f.run({ kind: 'airplane', expectedRevision: 0, expectedRunId: 'run-1', coordinate: safe }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.currentAttempt?.run.phase.kind).toBe('won');
    expect(after.currentAttempt?.terminalDisposition).toBe('settled');
    expect(after.currentAttempt?.rewards[0]?.claimed).toBe(true);
    expect(after.account.coins).toBe(1);
    expect(after.account.inventory.airplane).toBe(0);
    expect(after.currentAttempt?.runItems.successfulAirplaneUses).toBe(1);
    expect(after.currentAttempt?.run.hasTakenStep).toBe(false);
  });

  it('ordinary Safe movement claims Reward and wins without a separate terminal write', () => {
    const f = fixture(smallCatalog(1));
    f.start();
    const safe = coordinates(f.current().runtime, 'safe')[0]!;
    const moved = f.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: safe });
    expect(moved.status).toBe('committed');
    const after = f.current().runtime;
    expect(after.account.coins).toBe(1);
    expect(after.currentAttempt?.rewards[0]?.claimed).toBe(true);
    expect(after.currentAttempt?.terminalDisposition).toBe('settled');
    expect(after.currentAttempt?.run.phase.kind).toBe('won');
    expect(f.commits).toBe(2);
  });

  it('Restart from waiting changes actual layout, preserves Account, and stale old run cannot act', () => {
    const f = fixture(smallCatalog());
    const old = f.start();
    const oldMine = coordinates(old.runtime, 'mine');
    expect(f.run({ kind: 'restart', expectedRevision: 0, expectedRunId: 'run-1', creation: creation('run-2', 77) }).status).toBe('committed');
    const next = f.current();
    expect(next.runtime.currentAttempt?.runId).toBe('run-2');
    expect(coordinates(next.runtime, 'mine')).not.toEqual(oldMine);
    expect(next.runtime.currentAttempt?.run.characterPosition.kind).toBe('waiting');
    expect(next.runtime.currentAttempt?.runItems.successfulAirplaneUses).toBe(0);
    expect(f.run({ kind: 'flag', expectedRevision: 1, expectedRunId: 'run-1', coordinate: oldMine[0]!, flagged: true })).toEqual({ status: 'rejected', reason: 'run-id-conflict' });
  });

  it('Restart skips a changed seed that collides with the previous actual Mine set', () => {
    const candidates = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    function selected(seed: number) {
      const result = selectMineCoordinates(candidates, 1, createSeededRandomSource(seed));
      if (result.status !== 'selected') throw new Error('selection fixture');
      return result.coordinates[0]!;
    }
    const collidingSeed = Array.from({ length: 100 }, (_, index) => index).find((seed) => JSON.stringify(selected(seed)) === JSON.stringify(selected(seed + 1)));
    if (collidingSeed === undefined) throw new Error('collision fixture');
    const f = fixture(smallCatalog());
    const old = f.start('run-1', collidingSeed);
    expect(coordinates(old.runtime, 'mine')).toEqual([selected(collidingSeed)]);
    expect(f.run({ kind: 'restart', expectedRevision: 0, expectedRunId: 'run-1', creation: creation('run-2', 99) }).status).toBe('committed');
    const next = f.current().runtime.currentAttempt!;
    expect(next.generationProvenance?.seed).toBeGreaterThan(collidingSeed + 1);
    expect(coordinates(f.current().runtime, 'mine')).not.toEqual(coordinates(old.runtime, 'mine'));
  });

  it('Retry from failed is new Attempt, while failure settlement is not repeated', () => {
    const f = fixture(smallCatalog());
    f.start();
    const mine = coordinates(f.current().runtime, 'mine')[0]!;
    const safe = coordinates(f.current().runtime, 'safe')[0]!;
    expect(f.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: safe }).status).toBe('committed');
    // This tiny level already won; use the full catalog for the failed path below.
    const g = fixture();
    g.start();
    const firstSafe = coordinates(g.current().runtime, 'safe')[0]!;
    expect(g.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: firstSafe }).status).toBe('committed');
    const firstMine = coordinates(g.current().runtime, 'mine')[0]!;
    expect(g.run({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-1', coordinate: firstMine }).status).toBe('committed');
    expect(g.run({ kind: 'failure', expectedRevision: 2, expectedRunId: 'run-1' }).status).toBe('committed');
    const oldStreak = g.current().runtime.account.benbenByLevel[0]?.failureStreak;
    expect(g.run({ kind: 'retry', expectedRevision: 3, expectedRunId: 'run-1', creation: creation('run-2', 90) }).status).toBe('committed');
    expect(g.current().runtime.currentAttempt?.runId).toBe('run-2');
    expect(g.current().runtime.account.benbenByLevel[0]?.failureStreak).toBe(oldStreak);
    expect(g.current().runtime.currentAttempt?.run.phase.kind).toBe('active');
    expect(mine).toBeDefined();
  });

  it('Revive uses existing survival primitive after a later-step encounter', () => {
    const f = fixture();
    f.start();
    const safe = coordinates(f.current().runtime, 'safe')[0]!;
    const mine = coordinates(f.current().runtime, 'mine')[0]!;
    expect(f.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: safe }).status).toBe('committed');
    expect(f.run({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-1', coordinate: mine }).status).toBe('committed');
    expect(f.run({ kind: 'revive', expectedRevision: 2, expectedRunId: 'run-1' }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.currentAttempt?.run.phase.kind).toBe('active');
    expect(after.currentAttempt?.run.characterPosition.kind).toBe('revealed-mine-occupancy');
    expect(after.currentAttempt?.runItems.successfulReviveUses).toBe(1);
    expect(after.account.inventory.revive).toBe(0);
    expect(after.account.inventory.lucky).toBe(1);
  });

  it('Revive cannot bypass Lucky priority on a restored first-step pending encounter', () => {
    const f = fixture();
    const started = f.start().runtime;
    const pending = moveCharacter(started.currentAttempt!.run, firstMine(f));
    if (pending.outcome !== 'requires-resolution') throw new Error('first-step pending fixture');
    const old = serializeSaveDocumentV2({
      revision: 1,
      activeRun: { runId: 'legacy-pending', levelId: 'level-001', gameState: createGameState({ account: createAccountState(started.account.inventory), run: pending.state, runItems: started.currentAttempt!.runItems }) },
    });
    if (old.status !== 'serialized') throw new Error('v2 pending fixture');
    expect(commitSnapshot(f.storage, JSON.stringify(old.document), 1).status).toBe('committed');
    const before = f.current();
    const commits = f.commits;
    expect(f.run({ kind: 'revive', expectedRevision: 1, expectedRunId: 'legacy-pending' })).toEqual({ status: 'rejected', reason: 'lucky-priority' });
    expect(f.commits).toBe(commits);
    expect(f.current()).toEqual(before);
  });

  it('Detection reveals one real neighboring Mine and advances its seed exactly once', () => {
    const f = fixture();
    f.start();
    const board = f.current().runtime.currentAttempt!.run.board;
    const mine = coordinates(f.current().runtime, 'mine')[0]!;
    const safe = coordinates(f.current().runtime, 'safe').find(({ x, y }) => Math.abs(x - mine.x) <= 1 && Math.abs(y - mine.y) <= 1)!;
    expect(safe).toBeDefined();
    expect(f.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: safe }).status).toBe('committed');
    expect(f.run({ kind: 'detection', expectedRevision: 1, expectedRunId: 'run-1', initializeSeed: 3 }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.currentAttempt?.runItems.successfulDetectionUses).toBe(1);
    expect(after.currentAttempt?.runItems.detectionRandomSeed).toBe(4);
    expect(after.account.inventory.detection).toBe(1);
    expect(after.currentAttempt?.run.board).not.toEqual(board);
  });

  it('Benben Claim is waiting-only, deterministic and turns available into a temporary card', () => {
    const f = fixture();
    const original = f.start().runtime;
    const available = createStage4GameState({
      account: createStage4AccountState({ ...original.account, benbenByLevel: [{ levelId: 'level-001', status: 'available', failureStreak: 0 }] }),
      currentAttempt: original.currentAttempt,
    });
    f.persist(available, 1);
    expect(f.run({ kind: 'claim-benben', expectedRevision: 1, expectedRunId: 'run-1' }).status).toBe('committed');
    const after = f.current().runtime;
    expect(after.account.benbenByLevel[0]?.status).toBe('used');
    expect(after.currentAttempt?.temporaryBenbenCard).toMatchObject({ consumed: false });
    expect(f.run({ kind: 'claim-benben', expectedRevision: 2, expectedRunId: 'run-1' }).status).toBe('rejected');
  });

  it('terminal Replay requires exact completion, and commit failure retains the old terminal', () => {
    const f = fixture(smallCatalog());
    f.start();
    const safe = coordinates(f.current().runtime, 'safe')[0]!;
    expect(f.run({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-1', coordinate: safe }).status).toBe('committed');
    const terminal = f.current().runtime;
    f.setFailure(true);
    const intent = { kind: 'replay' as const, expectedRevision: 1, expectedRunId: 'run-1', creation: creation('run-2', 55) };
    const rejected = f.run(intent);
    expect(rejected).toEqual({ status: 'rejected', reason: 'commit-injected-failure' });
    expect(f.current().runtime).toEqual(terminal);
    const firstCandidate = f.attempts.at(-1);
    f.setFailure(false);
    expect(f.run(intent).status).toBe('committed');
    expect(f.attempts.at(-1)).toBe(firstCandidate);
    expect(f.current().runtime.currentAttempt?.runId).toBe('run-2');
  });

  it('Next is catalog-derived and unavailable after the actual final level', () => {
    const f = fixture(smallCatalog());
    f.start();
    expect(f.run({ kind: 'airplane', expectedRevision: 0, expectedRunId: 'run-1', coordinate: firstSafe(f) }).status).toBe('committed');
    expect(f.run({ kind: 'next', expectedRevision: 1, expectedRunId: 'run-1', creation: creation('run-2', 7) }).status).toBe('committed');
    expect(f.run({ kind: 'move', expectedRevision: 2, expectedRunId: 'run-2', coordinate: firstSafe(f) }).status).toBe('committed');
    const before = f.current();
    const count = f.commits;
    expect(f.run({ kind: 'next', expectedRevision: 3, expectedRunId: 'run-2', creation: creation('run-3', 8) })).toEqual({ status: 'rejected', reason: 'next-unavailable' });
    expect(f.commits).toBe(count);
    expect(f.current()).toEqual(before);
  });

  it('legacy failed v2 migration with null provenance can Retry using stable base seed, not fake old seed', () => {
    const f = fixture();
    const started = f.start().runtime;
    const mine = coordinates(started, 'mine')[0]!;
    const pending = moveCharacter(started.currentAttempt!.run, mine);
    if (pending.outcome !== 'requires-resolution') throw new Error('pending fixture');
    const failed = settleMineEncounterAsFailure(pending.state);
    if (failed.outcome !== 'failed') throw new Error('failed fixture');
    const old = serializeSaveDocumentV2({
      revision: 1,
      activeRun: {
        runId: 'legacy-run', levelId: 'level-001',
        gameState: createGameState({ account: createAccountState(started.account.inventory), run: failed.state, runItems: started.currentAttempt!.runItems }),
      },
    });
    if (old.status !== 'serialized') throw new Error('v2 fixture');
    expect(commitSnapshot(f.storage, JSON.stringify(old.document), 1).status).toBe('committed');
    const loaded = f.current();
    expect(loaded.runtime.currentAttempt?.generationProvenance).toBeNull();
    expect(loaded.runtime.currentAttempt?.terminalDisposition).toBe('legacy-excluded');
    expect(mapStage4RuntimeToSaveV3(loaded.runtime, 2)).toEqual({ status: 'not-writable', reason: 'legacy-excluded-attempt' });
    const intent = { kind: 'retry' as const, expectedRevision: 1, expectedRunId: 'legacy-run', creation: creation('run-new', 17) };
    f.setFailure(true);
    expect(f.run(intent).status).toBe('rejected');
    const firstCandidate = f.attempts.at(-1);
    f.setFailure(false);
    expect(f.run(intent).status).toBe('committed');
    expect(f.attempts.at(-1)).toBe(firstCandidate);
    expect(f.current().runtime.currentAttempt?.terminalDisposition).toBe('not-applicable');
    expect(f.current().runtime.currentAttempt?.generationProvenance?.seed).toBeGreaterThanOrEqual(17);
  });

  it('legacy active v2 migration with null provenance can Restart without fabricating a previous seed', () => {
    const f = fixture();
    const original = f.start().runtime;
    const legacy = serializeSaveDocumentV2({
      revision: 1,
      activeRun: { runId: 'legacy-active', levelId: 'level-001', gameState: createGameState({ account: createAccountState(original.account.inventory), run: original.currentAttempt!.run, runItems: original.currentAttempt!.runItems }) },
    });
    if (legacy.status !== 'serialized') throw new Error('legacy active fixture');
    expect(commitSnapshot(f.storage, JSON.stringify(legacy.document), 1).status).toBe('committed');
    expect(f.current().runtime.currentAttempt?.generationProvenance).toBeNull();
    const intent = { kind: 'restart' as const, expectedRevision: 1, expectedRunId: 'legacy-active', creation: creation('new-run', 23) };
    const oldMines = coordinates(f.current().runtime, 'mine');
    f.setFailure(true);
    expect(f.run(intent).status).toBe('rejected');
    const firstCandidate = f.attempts.at(-1);
    f.setFailure(false);
    expect(f.run(intent).status).toBe('committed');
    expect(f.attempts.at(-1)).toBe(firstCandidate);
    expect(coordinates(f.current().runtime, 'mine')).not.toEqual(oldMines);
    expect(f.current().runtime.currentAttempt?.generationProvenance?.seed).toBeGreaterThanOrEqual(23);
  });

  it('trusted legacy won never gains Replay or Next entitlement from the terminal phase alone', () => {
    const f = fixture(smallCatalog());
    f.start();
    expect(f.run({ kind: 'airplane', expectedRevision: 0, expectedRunId: 'run-1', coordinate: firstSafe(f) }).status).toBe('committed');
    const won = f.current().runtime.currentAttempt!;
    const legacy = serializeSaveDocumentV2({
      revision: 2,
      activeRun: { runId: 'legacy-won', levelId: 'level-001', gameState: createGameState({ account: createAccountState(f.current().runtime.account.inventory), run: won.run, runItems: won.runItems }) },
    });
    if (legacy.status !== 'serialized') throw new Error('legacy won fixture');
    expect(commitSnapshot(f.storage, JSON.stringify(legacy.document), 2).status).toBe('committed');
    const loaded = f.current();
    expect(loaded.runtime.currentAttempt?.terminalDisposition).toBe('legacy-excluded');
    expect(loaded.runtime.account.completedLevelIds).toEqual([]);
    const count = f.commits;
    expect(f.run({ kind: 'replay', expectedRevision: 2, expectedRunId: 'legacy-won', creation: creation('new-run', 5) })).toEqual({ status: 'rejected', reason: 'replay-not-entitled' });
    expect(f.run({ kind: 'next', expectedRevision: 2, expectedRunId: 'legacy-won', creation: creation('new-run', 5) }).status).toBe('rejected');
    expect(f.commits).toBe(count);
    expect(f.current().runtime.account.completedLevelIds).toEqual([]);
    expect(f.run({ kind: 'dismiss', expectedRevision: 2, expectedRunId: 'legacy-won' }).status).toBe('committed');
    expect(f.current().runtime.currentAttempt).toBeNull();
  });
});
