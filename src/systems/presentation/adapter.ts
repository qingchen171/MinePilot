import type { SanitizedPublicFacts } from './public-facts';
import type { PresentationCopyKey } from '../../config/presentation-copy';
import type { ValidatedShopCatalog } from '../../core/shop';
import { PRODUCTION_LEVEL_CATALOG, type LevelCatalog } from '../../core/level-catalog';
import { inspectItemResource } from '../../core/item-resource';
import { copyKeyForResult } from './copy-key';
import { sanitizeStage4Runtime } from './public-facts';
import { classifyProductionReason, type ResultPolicy } from './result-policy';
import { GENERATION_VERSION, RNG_VERSION } from './technical-facts';
import { proveCommittedRewardReceipt, type RewardReceiptProof } from './reward-receipt';
import type { PresentationSessionPort, SemanticIntent, SessionIntent, SessionRead, TechnicalFactsSource } from './session-port';

export interface OperationEnvelope {
  readonly intent: SessionIntent;
  readonly expectedRevision: number | null;
  readonly expectedRunId: string | null;
}

export type PublicSnapshot =
  | { readonly status: 'fresh' | 'loaded'; readonly facts: SanitizedPublicFacts }
  | { readonly status: 'recovery'; readonly reason: string };

export type PresentationOutcome =
  | { readonly status: 'committed'; readonly snapshot: PublicSnapshot; readonly copyKey: PresentationCopyKey;
      readonly rewardReceipt?: RewardReceiptProof; readonly firstLucky?: boolean }
  | { readonly status: 'rejected'; readonly reason: string; readonly policy: ResultPolicy; readonly copyKey: PresentationCopyKey }
  | { readonly status: 'unavailable'; readonly reason: 'entropy-unavailable' | 'operation-unresolved' | 'reload-required'; readonly copyKey: PresentationCopyKey };

function unavailable(reason: 'entropy-unavailable' | 'operation-unresolved' | 'reload-required'): PresentationOutcome {
  return { status: 'unavailable', reason, copyKey: reason === 'entropy-unavailable' ? 'error.entropy' : 'error.recovery' };
}

function rejected(reason: string): PresentationOutcome {
  const policy = classifyProductionReason(reason);
  return { status: 'rejected', reason, policy, copyKey: copyKeyForResult(policy.category, reason) };
}

function available(load: SessionRead): load is Extract<SessionRead, { readonly runtime: unknown }> {
  return load.status === 'fresh' || load.status === 'loaded';
}

function authority(load: Extract<SessionRead, { readonly runtime: unknown }>) {
  return {
    revision: load.status === 'fresh' ? null : load.persistence.revision,
    runId: load.runtime.currentAttempt?.runId ?? null,
  };
}

function publicSnapshot(load: SessionRead, shopCatalog: ValidatedShopCatalog | null, catalog: LevelCatalog): PublicSnapshot {
  return available(load)
    ? { status: load.status, facts: sanitizeStage4Runtime(load.runtime, shopCatalog, catalog) }
    : { status: 'recovery', reason: load.status };
}

function freezeIntent(intent: SessionIntent): SessionIntent {
  if ('creation' in intent) return Object.freeze({
    ...intent, creation: Object.freeze({ ...intent.creation }),
  });
  if ('coordinate' in intent) return Object.freeze({
    ...intent, coordinate: Object.freeze({ x: intent.coordinate.x, y: intent.coordinate.y }),
  });
  return Object.freeze({ ...intent });
}

function makeEnvelope(choice: SemanticIntent, load: Extract<SessionRead, { readonly runtime: unknown }>,
  technical: TechnicalFactsSource): OperationEnvelope {
  const { revision, runId } = authority(load);
  const expected = { expectedRevision: revision, expectedRunId: runId };
  let intent: SessionIntent;
  if (choice.kind === 'start' || choice.kind === 'restart' || choice.kind === 'retry' || choice.kind === 'replay' || choice.kind === 'next') {
    const creation = {
      runId: technical.nextRunId(), baseSeed: technical.nextGenerationSeed(),
      rngVersion: RNG_VERSION, generationVersion: GENERATION_VERSION,
    };
    intent = choice.kind === 'start'
      ? { kind: 'start', levelId: choice.levelId, creation, ...expected }
      : { kind: choice.kind, creation, ...expected };
  } else if (choice.kind === 'detection') {
    intent = { kind: 'detection', initializeSeed: technical.nextDetectionSeed(), ...expected };
  } else if (choice.kind === 'move' || choice.kind === 'airplane') {
    intent = { kind: choice.kind, coordinate: choice.coordinate, ...expected };
  } else if (choice.kind === 'flag') {
    intent = { kind: 'flag', coordinate: choice.coordinate, flagged: choice.flagged, ...expected };
  } else if (choice.kind === 'purchase') {
    intent = { kind: 'purchase', item: choice.item, ...expected };
  } else if (choice.kind === 'set-setting') {
    intent = { kind: choice.kind, key: choice.key, enabled: choice.enabled, ...expected };
  } else if (choice.kind === 'acknowledge-tutorial') {
    intent = { kind: choice.kind, milestoneId: choice.milestoneId, ...expected };
  } else {
    intent = { kind: choice.kind, ...expected };
  }
  return Object.freeze({ intent: freezeIntent(intent), expectedRevision: revision, expectedRunId: runId });
}

function provedFirstLucky(pre: Extract<SessionRead, { readonly runtime: unknown }>['runtime'],
  post: Extract<SessionRead, { readonly runtime: unknown }>['runtime'], envelope: OperationEnvelope): boolean {
  if (envelope.intent.kind !== 'move' || pre.currentAttempt === null || post.currentAttempt === null) return false;
  const before = pre.currentAttempt;
  const after = post.currentAttempt;
  const target = envelope.intent.coordinate;
  const width = before.run.board.dimensions.width;
  const priorCell = before.run.board.cells[target.y * width + target.x];
  const nextCell = after.run.board.cells[target.y * width + target.x];
  const resource = inspectItemResource('lucky', pre.account.inventory, before.temporaryBenbenCard);
  const consumed = resource.status === 'available' && (resource.source === 'account'
    ? post.account.inventory.lucky === pre.account.inventory.lucky - 1
    : before.temporaryBenbenCard?.item === 'lucky' && !before.temporaryBenbenCard.consumed &&
      after.temporaryBenbenCard?.consumed === true);
  return before.runId === after.runId && !before.run.hasTakenStep && before.run.phase.kind === 'active' &&
    priorCell?.kind === 'mine' && priorCell.revelation === 'hidden' && nextCell?.kind === 'mine' &&
    nextCell.revelation === 'revealed' && after.run.phase.kind === 'active' && after.run.hasTakenStep &&
    after.run.characterPosition.kind === 'revealed-mine-occupancy' &&
    after.run.characterPosition.coordinate.x === target.x &&
    after.run.characterPosition.coordinate.y === target.y && consumed;
}

/** A session-adjacent command adapter, not a second Runtime owner. */
export function createPresentationAdapter(session: PresentationSessionPort, technical: TechnicalFactsSource,
  shopCatalog: ValidatedShopCatalog | null = null, catalog: LevelCatalog = PRODUCTION_LEVEL_CATALOG) {
  let unresolved: OperationEnvelope | null = null;
  let executing = false;
  let reloadRequired = false;

  function execute(envelope: OperationEnvelope, pre: Extract<SessionRead, { readonly runtime: unknown }>): PresentationOutcome {
    executing = true;
    try {
      const result = session.execute(envelope.intent);
      if (result.status === 'committed') {
        unresolved = null;
        const rewardReceipt = proveCommittedRewardReceipt(pre.runtime, result.runtime, envelope.intent.kind,
          envelope.expectedRunId, envelope.expectedRevision, result.revision);
        const firstLucky = provedFirstLucky(pre.runtime, result.runtime, envelope);
        return { status: 'committed', snapshot: {
          status: 'loaded', facts: sanitizeStage4Runtime(result.runtime, shopCatalog, catalog),
        }, copyKey: 'status.committed', rewardReceipt, firstLucky };
      }
      const policy = classifyProductionReason(result.reason);
      unresolved = policy.retainEnvelope ? envelope : null;
      if (policy.reloadRequired && !policy.retainEnvelope) reloadRequired = true;
      return rejected(result.reason);
    } catch {
      // An exception after invoking execute has no proven commit outcome.
      unresolved = null;
      reloadRequired = true;
      return rejected('unknown-execution-outcome');
    } finally {
      executing = false;
    }
  }

  return Object.freeze({
    read(): PublicSnapshot { return publicSnapshot(session.read(), shopCatalog, catalog); },
    /** Trusted application coordination only; never handed to ui or a Scene. */
    readAuthority() {
      const load = session.read();
      return available(load) ? { status: 'available' as const, ...authority(load),
        facts: sanitizeStage4Runtime(load.runtime, shopCatalog, catalog) }
        : { status: 'recovery' as const, reason: load.status };
    },
    submit(choice: SemanticIntent): PresentationOutcome {
      if (executing || unresolved !== null) return unavailable('operation-unresolved');
      if (reloadRequired) return unavailable('reload-required');
      const load = session.read();
      if (!available(load)) {
        reloadRequired = true;
        return rejected(load.status);
      }
      let envelope: OperationEnvelope;
      try { envelope = makeEnvelope(choice, load, technical); }
      catch { return unavailable('entropy-unavailable'); }
      return execute(envelope, load);
    },
    retryRetained(): PresentationOutcome {
      if (executing || unresolved === null) return unavailable('operation-unresolved');
      const envelope = unresolved;
      unresolved = null;
      const load = session.reload();
      if (!available(load)) {
        reloadRequired = true;
        return rejected(load.status);
      }
      const current = authority(load);
      if (current.revision !== envelope.expectedRevision || current.runId !== envelope.expectedRunId) {
        reloadRequired = true;
        return rejected('revision-conflict');
      }
      return execute(envelope, load);
    },
    reload(): PublicSnapshot {
      unresolved = null;
      const load = session.reload();
      reloadRequired = !available(load);
      return publicSnapshot(load, shopCatalog, catalog);
    },
    reloadAuthority() {
      unresolved = null;
      const load = session.reload();
      reloadRequired = !available(load);
      return available(load) ? { status: 'available' as const, ...authority(load),
        facts: sanitizeStage4Runtime(load.runtime, shopCatalog, catalog) }
        : { status: 'recovery' as const, reason: load.status };
    },
    retainedKind(): SessionIntent['kind'] | null { return unresolved?.intent.kind ?? null; },
    retainedToken(): OperationEnvelope | null { return unresolved; },
    cancelRetainedToken(token: OperationEnvelope): boolean {
      if (unresolved !== token) return false;
      unresolved = null;
      return true;
    },
    cancelRetainedKind(kind: SessionIntent['kind']): boolean {
      if (unresolved?.intent.kind !== kind) return false;
      unresolved = null;
      return true;
    },
    cancelRetained(): void { unresolved = null; },
  });
}
