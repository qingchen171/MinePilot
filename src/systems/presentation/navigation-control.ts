import type { LevelCatalog } from '../../core/level-catalog';
import type { createPresentationAdapter, PresentationOutcome, PublicSnapshot } from './adapter';
import { canSelectLevel, projectLevelList } from './level-list';

export type PageRoute = 'home' | 'levels' | 'game' | 'shop' | 'settings' | 'feedback' | 'recovery';
type Adapter = ReturnType<typeof createPresentationAdapter>;
type Stamp = { readonly revision: number | null; readonly runId: string | null };
type Selection = { readonly target: string; readonly observed: Stamp; readonly phase: 'confirm' | 'first-retry' | 'second-retry' };
export type NavigationResult = (
  | { readonly status: 'navigated' | 'confirmation-required' | 'cancelled' | 'blocked' | 'recovery'; readonly reason?: string }
  | { readonly status: 'committed'; readonly outcome: PresentationOutcome }
  | { readonly status: 'rejected'; readonly outcome: PresentationOutcome }) & { readonly priorCommit?: boolean };

/** Ephemeral route/confirmation flow; only the injected adapter may submit a mutation. */
export function createNavigationControl(adapter: Adapter, catalog: LevelCatalog,
  leaveShop: () => void) {
  let route: PageRoute = 'home';
  let selection: Selection | null = null;
  let submitting = false;

  const stamp = (read: Stamp) => ({ revision: read.revision, runId: read.runId });
  const same = (a: Stamp, b: Stamp) => a.revision === b.revision && a.runId === b.runId;
  function cancelSelection(): void {
    if (selection?.phase === 'first-retry') {
      adapter.cancelRetainedKind('abandon');
      adapter.cancelRetainedKind('dismiss');
    }
    if (selection?.phase === 'second-retry') adapter.cancelRetainedKind('start');
    selection = null;
  }
  /** Reconcile the ephemeral route with one newly read committed authority. */
  function reconcileReloaded(snapshot: PublicSnapshot): void {
    if (snapshot.status === 'recovery') {
      if (route === 'shop') leaveShop();
      selection = null;
      route = 'recovery';
    } else if (route === 'shop' && (snapshot.facts.attempt !== null || snapshot.facts.shop.status !== 'available')) {
      leaveShop();
      route = 'home';
    }
  }
  function navigate(next: PageRoute): NavigationResult {
    if (submitting) return { status: 'blocked', reason: 'submitting' };
    // Entering Shop proves current account-only authority from committed storage.
    // Never let that reload silently discard an unrelated retained envelope.
    if ((next === 'shop' || next === 'game') && route !== next && adapter.retainedKind() !== null) {
      return { status: 'blocked', reason: 'operation-unresolved' };
    }
    const read = (next === 'shop' || next === 'game') && route !== next
      ? adapter.reloadAuthority() : adapter.readAuthority();
    if (read.status === 'recovery' && next !== 'recovery' && next !== 'feedback') {
      if (route === 'shop') leaveShop();
      route = 'recovery';
      return { status: 'recovery', reason: read.reason };
    }
    if (next === 'game' && read.status === 'available' && read.facts.attempt === null) {
      return { status: 'blocked', reason: 'no-attempt' };
    }
    if (next === 'shop' && read.status === 'available' && read.facts.attempt !== null) {
      return { status: 'blocked', reason: 'shop.account-only' };
    }
    if (next === 'shop' && (read.status !== 'available' || read.facts.shop.status !== 'available')) {
      return { status: 'blocked', reason: 'shop.unavailable' };
    }
    if (route === 'shop' && next !== 'shop') leaveShop();
    if (next !== 'levels') cancelSelection();
    route = next;
    return { status: 'navigated' };
  }
  function levelList() {
    const read = adapter.readAuthority();
    return read.status === 'available' ? projectLevelList(catalog, read.facts) : null;
  }
  function afterFirst(target: string, priorCommit: boolean): NavigationResult {
    const reread = adapter.reloadAuthority();
    if (reread.status !== 'available') return { status: 'recovery', reason: reread.reason, priorCommit };
    if (reread.facts.attempt !== null) return { status: 'blocked', reason: 'authority-changed', priorCommit };
    if (!canSelectLevel(catalog, reread.facts, target)) return { status: 'blocked', reason: 'level-unavailable', priorCommit };
    const result = adapter.submit({ kind: 'start', levelId: target });
    if (result.status === 'committed') { route = 'game'; selection = null; return { status: 'committed', outcome: result }; }
    if (result.status === 'rejected' && result.policy.retainEnvelope) {
      selection = { target, observed: stamp(reread), phase: 'second-retry' };
    } else selection = null;
    return { status: 'rejected', outcome: result, priorCommit };
  }
  function selectLevel(target: string): NavigationResult {
    if (submitting || selection !== null || adapter.retainedKind() !== null) return { status: 'blocked', reason: 'operation-unresolved' };
    const read = adapter.readAuthority();
    if (read.status !== 'available') return { status: 'recovery', reason: read.reason };
    if (read.facts.attempt?.levelId === target) return navigate('game');
    if (!canSelectLevel(catalog, read.facts, target)) return { status: 'blocked', reason: 'level-unavailable' };
    if (read.facts.attempt !== null) {
      selection = { target, observed: stamp(read), phase: 'confirm' };
      return { status: 'confirmation-required' };
    }
    submitting = true;
    try {
      const reread = adapter.reloadAuthority();
      if (reread.status !== 'available') return { status: 'recovery', reason: reread.reason };
      if (!same(read, reread) || reread.facts.attempt !== null) return { status: 'blocked', reason: 'authority-changed' };
      return afterFirst(target, false);
    } finally { submitting = false; }
  }
  function confirmReplacement(): NavigationResult {
    if (submitting || selection?.phase !== 'confirm') return { status: 'blocked', reason: 'no-confirmation' };
    const bound = selection;
    selection = null; // Disarm duplicate activation before any synchronous commit.
    submitting = true;
    try {
      const read = adapter.reloadAuthority();
      if (read.status !== 'available') return { status: 'recovery', reason: read.reason };
      if (!same(read, bound.observed)) return { status: 'blocked', reason: 'authority-changed' };
      if (!canSelectLevel(catalog, read.facts, bound.target)) return { status: 'blocked', reason: 'level-unavailable' };
      const phase = read.facts.attempt?.phase;
      if (phase === undefined) return { status: 'blocked', reason: 'authority-changed' };
      const kind = phase === 'active' || phase === 'pending-mine-encounter' ? 'abandon' : 'dismiss';
      const first = adapter.submit({ kind });
      if (first.status !== 'committed') {
        if (first.status === 'rejected' && first.policy.retainEnvelope) {
          selection = { ...bound, phase: 'first-retry' };
        }
        return { status: 'rejected', outcome: first };
      }
      return afterFirst(bound.target, true);
    } finally { submitting = false; }
  }
  function retryReplacement(): NavigationResult {
    if (submitting || (selection?.phase !== 'first-retry' && selection?.phase !== 'second-retry')) {
      return { status: 'blocked', reason: 'no-retry' };
    }
    const bound = selection;
    submitting = true;
    try {
      const result = adapter.retryRetained();
      if (result.status !== 'committed') {
        if (!(result.status === 'rejected' && result.policy.retainEnvelope)) selection = null;
        return { status: 'rejected', outcome: result, priorCommit: bound.phase === 'second-retry' };
      }
      if (bound.phase === 'first-retry') { selection = null; return afterFirst(bound.target, true); }
      selection = null;
      route = 'game';
      return { status: 'committed', outcome: result };
    } finally { submitting = false; }
  }
  function leaveAttemptForShop(): NavigationResult {
    if (submitting || adapter.retainedKind() !== null) return { status: 'blocked', reason: 'operation-unresolved' };
    const read = adapter.readAuthority();
    if (read.status !== 'available') return { status: 'recovery', reason: read.reason };
    if (read.facts.shop.status === 'unavailable') return { status: 'blocked', reason: 'shop.unavailable' };
    const phase = read.facts.attempt?.phase;
    if (phase === undefined) return navigate('shop');
    const kind = phase === 'active' || phase === 'pending-mine-encounter' ? 'abandon' : 'dismiss';
    submitting = true;
    try {
      const result = adapter.submit({ kind });
      if (result.status !== 'committed') return { status: 'rejected', outcome: result };
      const reread = adapter.reloadAuthority();
      if (reread.status !== 'available') return { status: 'recovery', reason: reread.reason };
      if (reread.facts.attempt !== null) return { status: 'blocked', reason: 'authority-changed' };
      if (reread.facts.shop.status !== 'available') { route = 'home'; return { status: 'blocked', reason: 'shop.unavailable' }; }
      route = 'shop';
      return { status: 'committed', outcome: result };
    } finally { submitting = false; }
  }
  return Object.freeze({ route: () => route, pendingSelection: () => selection,
    navigate, reconcileReloaded, levelList, selectLevel, confirmReplacement, cancelSelection,
    retryReplacement, leaveAttemptForShop });
}
