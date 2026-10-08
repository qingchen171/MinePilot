import { describe, expect, it, vi } from 'vitest';
import { createLevelCatalog, PRODUCTION_LEVEL_CATALOG } from '../../../../src/core/level-catalog';
import { createCompleteAttempt } from '../../../../src/core/stage4-attempt-factory';
import { createInitialStage4GameState, createStage4GameState } from '../../../../src/core/stage4-game-state';
import { validateShopCatalog } from '../../../../src/core/shop';
import { SHOP_PRICES } from '../../../../src/config/shop-prices';
import { createPresentationAdapter } from '../../../../src/systems/presentation/adapter';
import { createNavigationControl } from '../../../../src/systems/presentation/navigation-control';
import { projectLevelList } from '../../../../src/systems/presentation/level-list';
import { sanitizeStage4Runtime } from '../../../../src/systems/presentation/public-facts';
import { createPresentationRoot } from '../../../../src/presentation-root';
import { createRunState, createWaitingPosition } from '../../../../src/core/run';
import { createBoard } from '../../../../src/core/board';
import type { PresentationSessionPort, SessionIntent, SessionRead } from '../../../../src/systems/presentation/session-port';

const made = createLevelCatalog([
  PRODUCTION_LEVEL_CATALOG.levels[0]!,
  { ...PRODUCTION_LEVEL_CATALOG.levels[0]!, levelId: 'level-002' },
]);
if (made.status !== 'created') throw new Error('catalog fixture');
const catalog = made.catalog;
const shop = validateShopCatalog(SHOP_PRICES);
if (shop.status !== 'valid') throw new Error('shop fixture');
const shopCatalog = shop.catalog;
const tech = () => ({ nextRunId: vi.fn(() => 'next-run'), nextGenerationSeed: vi.fn(() => 11), nextDetectionSeed: vi.fn(() => 12) });

function attempt(levelId = 'level-001') {
  const level = catalog.levels.find((entry) => entry.levelId === levelId)!;
  const result = createCompleteAttempt({ level, runId: 'old-run', generationProvenance: {
    seed: 10, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1',
  } });
  if (result.status !== 'created') throw new Error('attempt fixture');
  return result.attempt;
}
function asEncounter(base: ReturnType<typeof attempt>, phase: 'pending-mine-encounter' | 'failed') {
  const index = base.run.board.cells.findIndex((cell) => cell.kind === 'mine');
  const target = { x: index % base.run.board.dimensions.width,
    y: Math.floor(index / base.run.board.dimensions.width) };
  return { ...base,
    run: createRunState(base.run.board, createWaitingPosition(), { hasTakenStep: true,
      phase: { kind: phase, encounter: { target, occurredOnFirstStep: true } } }),
    terminalDisposition: phase === 'failed' ? 'settled' as const : 'not-applicable' as const };
}
function encountered(phase: 'pending-mine-encounter' | 'failed') { return asEncounter(attempt(), phase); }
function won() {
  const base = attempt();
  const board = createBoard(base.run.board.dimensions,
    base.run.board.cells.map((cell) => cell.kind === 'safe'
      ? { kind: 'safe' as const, exploration: 'explored' as const, flagged: false as const } : cell));
  return { ...base, run: createRunState(board, createWaitingPosition(), { phase: { kind: 'won' } }),
    rewards: base.rewards.map((reward) => ({ ...reward, claimed: true })), terminalDisposition: 'settled' as const };
}
function loaded(current = attempt(), revision = 5, completedLevelIds: readonly string[] = ['level-001']): SessionRead {
  return { status: 'loaded', persistence: { kind: 'committed', revision, source: 'head', sourceSaveVersion: 4 },
    runtime: createStage4GameState({ ...createInitialStage4GameState(),
      account: { ...createInitialStage4GameState().account, completedLevelIds }, currentAttempt: current }) };
}
function accountOnly(revision: number, completedLevelIds: readonly string[] = ['level-001']): SessionRead {
  return { status: 'loaded', persistence: { kind: 'committed', revision, source: 'head', sourceSaveVersion: 4 },
    runtime: createStage4GameState({ ...createInitialStage4GameState(),
      account: { ...createInitialStage4GameState().account, completedLevelIds }, currentAttempt: null }) };
}
function fixture(initial: SessionRead = loaded()) {
  let authority = initial;
  const intents: SessionIntent[] = [];
  let reloadCount = 0;
  let onReload: ((count: number) => void) | null = null;
  const reload = vi.fn(() => { reloadCount++; onReload?.(reloadCount); return authority; });
  let fail: { reason: string; kind: SessionIntent['kind'] } | null = null;
  const port: PresentationSessionPort = {
    read: () => authority, reload,
    execute(intent) {
      intents.push(intent);
      if (fail !== null && fail.kind === intent.kind) { const { reason } = fail; fail = null; return { status: 'rejected', reason }; }
      const current = authority;
      if (current.status !== 'loaded' && current.status !== 'fresh') throw new Error('recovery fixture');
      const next = intent.kind === 'start' ? attempt(intent.levelId) : null;
      const runtime = createStage4GameState({ ...current.runtime, currentAttempt: next });
      const revision = current.status === 'loaded' ? current.persistence.revision + 1 : 0;
      authority = { status: 'loaded', persistence: { kind: 'committed', revision,
        source: 'head', sourceSaveVersion: 4 }, runtime };
      return { status: 'committed', revision, runtime };
    },
  };
  const technical = tech();
  const adapter = createPresentationAdapter(port, technical, shopCatalog);
  const exit = vi.fn();
  const nav = createNavigationControl(adapter, catalog, exit);
  return { nav, adapter, technical, intents, reload, exit, setAuthority: (read: SessionRead) => { authority = read; },
    onReload: (hook: (count: number) => void) => { onReload = hook; },
    failNext: (kind: SessionIntent['kind'], reason: string) => { fail = { kind, reason }; }, authority: () => authority };
}

describe('S5-05 trusted navigation and replacement', () => {
  it('projects one validated catalog with no LevelDefinition, Reward or generation data', () => {
    const facts = sanitizeStage4Runtime((loaded() as Extract<SessionRead, { status: 'loaded' }>).runtime);
    const levels = projectLevelList(catalog, facts);
    expect(levels).toEqual([
      { levelId: 'level-001', order: 0, access: 'completed', current: true },
      { levelId: 'level-002', order: 1, access: 'available', current: false },
    ]);
    expect(JSON.stringify(levels)).not.toMatch(/rewards|payload|mineCount|generation|seed|runId/);
    expect(Object.isFrozen(levels)).toBe(true);
  });

  it('keeps Shop account-only and menu navigation read-only', () => {
    const f = fixture();
    expect(f.nav.navigate('shop')).toMatchObject({ status: 'blocked' });
    for (const route of ['home', 'levels', 'game', 'settings', 'feedback'] as const) {
      expect(f.nav.navigate(route).status).toBe('navigated');
    }
    expect(f.intents).toHaveLength(0);
    expect(f.nav.leaveAttemptForShop().status).toBe('committed');
    expect(f.intents.map((value) => value.kind)).toEqual(['abandon']);
    expect(f.nav.route()).toBe('shop');
  });

  it('blocks Shop for pending and failed attempts and uses their legal replacement command', () => {
    for (const phase of ['pending-mine-encounter', 'failed', 'won'] as const) {
      const f = fixture(loaded(phase === 'won' ? won() : encountered(phase)));
      expect(f.nav.navigate('shop')).toMatchObject({ status: 'blocked' });
      expect(f.nav.selectLevel('level-002').status).toBe('confirmation-required');
      expect(f.nav.confirmReplacement().status).toBe('committed');
      expect(f.intents[0]?.kind).toBe(phase === 'failed' || phase === 'won' ? 'dismiss' : 'abandon');
    }
  });

  it('binds confirmation, rereads both times, and commits abandon then Start exactly once', () => {
    const f = fixture();
    f.nav.navigate('levels');
    expect(f.nav.selectLevel('level-002').status).toBe('confirmation-required');
    expect(f.nav.confirmReplacement().status).toBe('committed');
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'blocked' });
    expect(f.intents.map((value) => value.kind)).toEqual(['abandon', 'start']);
    expect(f.intents[0]).toMatchObject({ expectedRevision: 5, expectedRunId: 'old-run' });
    expect(f.intents[1]).toMatchObject({ levelId: 'level-002', expectedRevision: 6, expectedRunId: null });
    expect(f.reload).toHaveBeenCalledTimes(2);
    expect(f.nav.route()).toBe('game');
  });

  it('stops on changed authority before first mutation; invalid, same-level and cancellation do not write', () => {
    const f = fixture();
    expect(f.nav.selectLevel('missing')).toMatchObject({ status: 'blocked' });
    expect(f.nav.selectLevel('level-001').status).toBe('navigated');
    expect(f.nav.selectLevel('level-002').status).toBe('confirmation-required');
    f.nav.cancelSelection();
    expect(f.intents).toHaveLength(0);
    expect(f.nav.selectLevel('level-002').status).toBe('confirmation-required');
    f.setAuthority(loaded(attempt(), 6));
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'blocked', reason: 'authority-changed' });
    expect(f.intents).toHaveLength(0);
  });

  it('does not mutate for a locked target, yet permits Continue of a historical current attempt', () => {
    const f = fixture(loaded(attempt(), 5, []));
    expect(f.nav.selectLevel('level-002')).toMatchObject({ status: 'blocked', reason: 'level-unavailable' });
    expect(f.nav.selectLevel('level-001')).toMatchObject({ status: 'navigated' });
    expect(f.intents).toHaveLength(0);
  });

  it('keeps a missing-catalog historical Attempt out of the list but permits Continue and legal replacement', () => {
    const retiredLevel = { ...catalog.levels[0]!, levelId: 'retired-level' };
    const made = createCompleteAttempt({ level: retiredLevel, runId: 'old-run', generationProvenance: {
      seed: 10, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1',
    } });
    if (made.status !== 'created') throw new Error('historical fixture');
    const f = fixture(loaded(made.attempt));
    expect(f.nav.levelList()?.some((level) => level.levelId === 'retired-level')).toBe(false);
    expect(f.nav.selectLevel('retired-level')).toMatchObject({ status: 'navigated' });
    expect(f.nav.selectLevel('level-002').status).toBe('confirmation-required');
    expect(f.nav.confirmReplacement().status).toBe('committed');
    expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon', 'start']);
  });

  it('legally dismisses a historical terminal Attempt absent from the current catalog', () => {
    const retiredLevel = { ...catalog.levels[0]!, levelId: 'retired-level' };
    const made = createCompleteAttempt({ level: retiredLevel, runId: 'old-run', generationProvenance: {
      seed: 10, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1',
    } });
    if (made.status !== 'created') throw new Error('historical fixture');
    const f = fixture(loaded(asEncounter(made.attempt, 'failed')));
    expect(f.nav.selectLevel('level-002').status).toBe('confirmation-required');
    expect(f.nav.confirmReplacement().status).toBe('committed');
    expect(f.intents.map((intent) => intent.kind)).toEqual(['dismiss', 'start']);
  });

  it('preserves the committed account-only gap when Start fails; never fabricates rollback', () => {
    const f = fixture();
    f.nav.selectLevel('level-002');
    f.failNext('start', 'commit-persistence-commit-failure');
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'rejected', priorCommit: true,
      outcome: { reason: 'commit-persistence-commit-failure' } });
    expect(f.intents.map((value) => value.kind)).toEqual(['abandon', 'start']);
    expect(f.authority()).toMatchObject({ runtime: { currentAttempt: null }, persistence: { revision: 6 } });
    expect(f.nav.pendingSelection()).toBeNull();
  });

  it('stops after a committed first step if a competing Attempt appears before the second reload', () => {
    const f = fixture();
    f.nav.selectLevel('level-002');
    f.onReload((count) => { if (count === 2) f.setAuthority(loaded(attempt('level-002'), 7)); });
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'blocked', reason: 'authority-changed' });
    expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon']);
    expect(f.authority()).toMatchObject({ persistence: { revision: 7 }, runtime: { currentAttempt: { levelId: 'level-002' } } });
  });

  it('stops at recovery if the committed reread after abandon fails', () => {
    const f = fixture();
    f.nav.selectLevel('level-002');
    f.onReload((count) => { if (count === 2) f.setAuthority({ status: 'unavailable-snapshot' }); });
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'recovery', priorCommit: true });
    expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon']);
  });

  it('Continue rereads committed authority and cannot display an obsolete cached Attempt', () => {
    const f = fixture();
    f.onReload((count) => { if (count === 1) f.setAuthority(accountOnly(6)); });
    expect(f.nav.navigate('game')).toMatchObject({ status: 'blocked', reason: 'no-attempt' });
    expect(f.nav.route()).toBe('home');
    expect(f.intents).toHaveLength(0);
  });

  it('same-level selection also rereads rather than continuing a stale cached Attempt', () => {
    const f = fixture();
    f.onReload((count) => { if (count === 1) f.setAuthority(accountOnly(6)); });
    expect(f.nav.selectLevel('level-001')).toMatchObject({ status: 'blocked', reason: 'no-attempt' });
    expect(f.intents).toHaveLength(0);
  });

  it('does not Start when the target becomes locked after the first committed step', () => {
    const f = fixture();
    f.nav.selectLevel('level-002');
    f.onReload((count) => { if (count === 2) f.setAuthority(accountOnly(6, [])); });
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'blocked', reason: 'level-unavailable' });
    expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon']);
    expect(f.authority()).toMatchObject({ runtime: { currentAttempt: null } });
  });

  it('keeps the account-only gap on second-step secure entropy failure', () => {
    const f = fixture();
    f.technical.nextRunId.mockImplementationOnce(() => { throw new Error('unavailable'); });
    f.nav.selectLevel('level-002');
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'rejected', outcome: { reason: 'entropy-unavailable' } });
    expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon']);
    expect(f.authority()).toMatchObject({ runtime: { currentAttempt: null } });
  });

  it('allows only user-triggered retry of the exact second-step Start envelope', () => {
    const f = fixture();
    f.failNext('start', 'storage-failure');
    f.nav.selectLevel('level-002');
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'rejected', outcome: { policy: { retainEnvelope: true } } });
    const firstStart = f.intents[1];
    expect(f.nav.retryReplacement().status).toBe('committed');
    expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon', 'start', 'start']);
    expect(f.intents[2]).toBe(firstStart);
    expect(f.nav.route()).toBe('game');
  });

  it('retries a proven pre-commit first step without creating another lifecycle envelope', () => {
    const f = fixture();
    f.failNext('abandon', 'storage-failure');
    f.nav.selectLevel('level-002');
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'rejected', outcome: { policy: { retainEnvelope: true } } });
    const first = f.intents[0];
    expect(f.nav.retryReplacement().status).toBe('committed');
    expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon', 'abandon', 'start']);
    expect(f.intents[1]).toBe(first);
    expect(f.technical.nextRunId).toHaveBeenCalledTimes(1);
  });

  it('never replays an uncertain second-step Start or rebuilds its creation facts', () => {
    const f = fixture();
    f.failNext('start', 'commit-commit-outcome-uncertain');
    f.nav.selectLevel('level-002');
    expect(f.nav.confirmReplacement()).toMatchObject({ status: 'rejected', outcome: {
      reason: 'commit-commit-outcome-uncertain', policy: { retainEnvelope: false },
    } });
    expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon', 'start']);
    expect(f.nav.retryReplacement()).toMatchObject({ status: 'blocked' });
    expect(f.technical.nextRunId).toHaveBeenCalledTimes(1);
    expect(f.authority()).toMatchObject({ runtime: { currentAttempt: null } });
  });

  it('keeps the committed first step and rejects stale, lost-lease, or invalid second-step Start', () => {
    for (const reason of ['revision-conflict', 'commit-writer-not-owner', 'invalid-candidate']) {
      const f = fixture();
      f.failNext('start', reason);
      f.nav.selectLevel('level-002');
      expect(f.nav.confirmReplacement()).toMatchObject({ status: 'rejected', priorCommit: true,
        outcome: { reason, policy: { retainEnvelope: false } } });
      expect(f.authority()).toMatchObject({ runtime: { currentAttempt: null }, persistence: { revision: 6 } });
      expect(f.nav.retryReplacement()).toMatchObject({ status: 'blocked' });
    }
  });

  it('never continues to Start after first-step uncertainty or ownership loss', () => {
    for (const reason of ['commit-commit-outcome-uncertain', 'owned-by-another-session']) {
      const f = fixture();
      f.failNext('abandon', reason);
      f.nav.selectLevel('level-002');
      expect(f.nav.confirmReplacement()).toMatchObject({ status: 'rejected', outcome: { reason } });
      expect(f.intents.map((intent) => intent.kind)).toEqual(['abandon']);
      expect(f.nav.pendingSelection()).toBeNull();
      expect(f.nav.retryReplacement()).toMatchObject({ status: 'blocked' });
    }
  });

  it('does not turn a recovery read into a fresh route or Start', () => {
    const f = fixture({ status: 'invalid-save' });
    expect(f.nav.navigate('levels')).toMatchObject({ status: 'recovery' });
    expect(f.nav.navigate('feedback')).toMatchObject({ status: 'navigated' });
    expect(f.nav.selectLevel('level-001')).toMatchObject({ status: 'recovery' });
    expect(f.intents).toHaveLength(0);
  });

  it('exits Shop by cancelling only a retained purchase and keeping the receipt disarmed', () => {
    const fresh: SessionRead = { status: 'fresh', persistence: { kind: 'no-save' }, runtime: createInitialStage4GameState() };
    const execute = vi.fn(() => ({ status: 'rejected' as const, reason: 'storage-failure' }));
    const root = createPresentationRoot({ read: () => fresh, reload: () => fresh, execute }, tech(), shopCatalog, catalog);
    expect(root.navigation.navigate('shop').status).toBe('navigated');
    expect(root.shopPurchase('lucky')).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    expect(root.shopActions().retry).toBe(true);
    expect(root.navigation.navigate('home').status).toBe('navigated');
    expect(root.navigation.navigate('shop').status).toBe('navigated');
    expect(root.shopActions()).toMatchObject({ retry: false, reload: true, buyAgain: false });
    expect(root.shopBuyAgain()).toBe(false);
    expect(root.shopRetryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
    root.shopReload();
    expect(root.shopBuyAgain()).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('a global reload into recovery clears purchase Retry and Shop-exit latch consistently', () => {
    const fresh: SessionRead = { status: 'fresh', persistence: { kind: 'no-save' }, runtime: createInitialStage4GameState() };
    let read: SessionRead = fresh;
    let reloadValue: SessionRead = fresh;
    const root = createPresentationRoot({ read: () => read,
      reload: () => { read = reloadValue; return read; },
      execute: () => ({ status: 'rejected', reason: 'storage-failure' }) }, tech(), shopCatalog, catalog);
    root.navigation.navigate('shop');
    root.shopPurchase('lucky');
    expect(root.shopActions().retry).toBe(true);
    reloadValue = { status: 'invalid-save' };
    expect(root.reload().status).toBe('recovery');
    expect(root.navigation.route()).toBe('recovery');
    expect(root.shopActions()).toMatchObject({ retry: false, reload: true, buyAgain: false });
    expect(root.navigation.navigate('home').status).toBe('recovery');
    reloadValue = fresh;
    expect(root.reload().status).toBe('fresh');
    expect(root.navigation.navigate('shop').status).toBe('navigated');
    expect(root.shopActions().retry).toBe(false);
  });

  it.each(['active', 'pending-mine-encounter', 'failed', 'won'] as const)(
    'exits a resident Shop after committed reload discovers a %s Attempt without mutating it', (phase) => {
      const original = accountOnly(4);
      let cached: SessionRead = original;
      let committed: SessionRead = original;
      const execute = vi.fn(() => ({ status: 'rejected' as const, reason: 'unexpected-mutation' }));
      const root = createPresentationRoot({ read: () => cached,
        reload: () => { cached = committed; return cached; }, execute }, tech(), shopCatalog, catalog);
      expect(root.navigation.navigate('shop').status).toBe('navigated');
      committed = loaded(phase === 'active' ? attempt() : phase === 'won' ? won() : encountered(phase), 5);
      expect(root.reload()).toMatchObject({ status: 'loaded', view: { attempt: { phase } } });
      expect(root.navigation.route()).toBe('home');
      expect(root.read()).toMatchObject({ status: 'loaded', view: { attempt: { phase } } });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('Shop-specific reload also exits for a competing committed Attempt and preserves a disarmed receipt', () => {
    const original = accountOnly(4);
    let cached: SessionRead = original;
    let committed: SessionRead = original;
    const execute = vi.fn(() => ({ status: 'rejected' as const, reason: 'storage-failure' }));
    const root = createPresentationRoot({ read: () => cached,
      reload: () => { cached = committed; return cached; }, execute }, tech(), shopCatalog, catalog);
    root.navigation.navigate('shop');
    expect(root.shopPurchase('lucky')).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    expect(root.shopActions().retry).toBe(true);
    committed = loaded(attempt(), 5);
    expect(root.shopReload()).toMatchObject({ status: 'loaded', view: { attempt: { phase: 'active' } } });
    expect(root.navigation.route()).toBe('home');
    expect(root.shopActions()).toMatchObject({ retry: false, buyAgain: false });
    expect(root.shopBuyAgain()).toBe(false);
    expect(root.shopRetryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('a retained Shop retry that rereads a competing Attempt exits Shop without replaying the purchase', () => {
    const original = accountOnly(4);
    let cached: SessionRead = original;
    let committed: SessionRead = original;
    const execute = vi.fn(() => ({ status: 'rejected' as const, reason: 'storage-failure' }));
    const root = createPresentationRoot({ read: () => cached,
      reload: () => { cached = committed; return cached; }, execute }, tech(), shopCatalog, catalog);
    root.navigation.navigate('shop');
    root.shopPurchase('lucky');
    expect(root.shopActions().retry).toBe(true);
    committed = loaded(attempt(), 5);
    expect(root.shopRetryRetained()).toMatchObject({ status: 'rejected', reason: 'revision-conflict' });
    expect(root.navigation.route()).toBe('home');
    expect(root.shopActions()).toMatchObject({ retry: false, buyAgain: false });
    expect(root.read()).toMatchObject({ status: 'loaded', view: { attempt: { phase: 'active' } } });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('account-only reload keeps Shop; unavailable reload enters Recovery without a mutation', () => {
    const original = accountOnly(4);
    let cached: SessionRead = original;
    let committed: SessionRead = original;
    const execute = vi.fn(() => ({ status: 'rejected' as const, reason: 'unexpected-mutation' }));
    const root = createPresentationRoot({ read: () => cached,
      reload: () => { cached = committed; return cached; }, execute }, tech(), shopCatalog, catalog);
    root.navigation.navigate('shop');
    committed = accountOnly(5);
    expect(root.reload().status).toBe('loaded');
    expect(root.navigation.route()).toBe('shop');
    committed = { status: 'unavailable-snapshot' };
    expect(root.shopReload().status).toBe('recovery');
    expect(root.navigation.route()).toBe('recovery');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not cancel an unrelated retained operation when exiting Shop', () => {
    const fresh: SessionRead = { status: 'fresh', persistence: { kind: 'no-save' }, runtime: createInitialStage4GameState() };
    const execute = vi.fn(() => ({ status: 'rejected' as const, reason: 'storage-failure' }));
    const root = createPresentationRoot({ read: () => fresh, reload: () => fresh, execute }, tech(), shopCatalog, catalog);
    root.navigation.navigate('shop');
    expect(root.submit({ kind: 'start', levelId: 'level-001' })).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    root.navigation.navigate('home');
    expect(root.retryRetained()).toMatchObject({ status: 'rejected', reason: 'storage-failure' });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('never passes confirmation run identity into the UI-facing root result', () => {
    const read = loaded();
    const root = createPresentationRoot({ read: () => read, reload: () => read,
      execute: () => ({ status: 'rejected', reason: 'unused' }) }, tech(), shopCatalog, catalog);
    expect(root.navigation.selectLevel('level-002').status).toBe('confirmation-required');
    expect(root.navigation.pendingSelection()).toEqual({ target: 'level-002', phase: 'confirm' });
    expect(JSON.stringify(root.navigation.pendingSelection())).not.toContain('old-run');
  });
});
