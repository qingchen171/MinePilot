import type { SanitizedPublicFacts } from './public-facts';
import type { PresentationCopyKey } from '../../config/presentation-copy';
import type { ValidatedShopCatalog } from '../../core/shop';
import { copyKeyForResult } from './copy-key';
import { sanitizeStage4Runtime } from './public-facts';
import { classifyProductionReason, type ResultPolicy } from './result-policy';
import { GENERATION_VERSION, RNG_VERSION } from './technical-facts';
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
  | { readonly status: 'committed'; readonly snapshot: PublicSnapshot; readonly copyKey: PresentationCopyKey }
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

function publicSnapshot(load: SessionRead, shopCatalog: ValidatedShopCatalog | null): PublicSnapshot {
  return available(load)
    ? { status: load.status, facts: sanitizeStage4Runtime(load.runtime, shopCatalog) }
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
  } else {
    intent = { kind: choice.kind, ...expected };
  }
  return Object.freeze({ intent: freezeIntent(intent), expectedRevision: revision, expectedRunId: runId });
}

/** A session-adjacent command adapter, not a second Runtime owner. */
export function createPresentationAdapter(session: PresentationSessionPort, technical: TechnicalFactsSource,
  shopCatalog: ValidatedShopCatalog | null = null) {
  let unresolved: OperationEnvelope | null = null;
  let executing = false;
  let reloadRequired = false;

  function execute(envelope: OperationEnvelope): PresentationOutcome {
    executing = true;
    try {
      const result = session.execute(envelope.intent);
      if (result.status === 'committed') {
        unresolved = null;
        return { status: 'committed', snapshot: publicSnapshot(session.read(), shopCatalog), copyKey: 'status.committed' };
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
    read(): PublicSnapshot { return publicSnapshot(session.read(), shopCatalog); },
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
      return execute(envelope);
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
      return execute(envelope);
    },
    reload(): PublicSnapshot {
      unresolved = null;
      const load = session.reload();
      reloadRequired = !available(load);
      return publicSnapshot(load, shopCatalog);
    },
    cancelRetained(): void { unresolved = null; },
  });
}
