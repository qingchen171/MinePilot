import { describe, expect, it, vi } from 'vitest';
import { createInitialStage4GameState } from '../../../../src/core/stage4-game-state';
import { createPresentationAdapter } from '../../../../src/systems/presentation/adapter';
import type { PresentationSessionPort, SessionIntent, SessionRead, SessionMutationResult } from '../../../../src/systems/presentation/session-port';

const runtime = createInitialStage4GameState();
const fresh: SessionRead = { status: 'fresh', persistence: { kind: 'no-save' }, runtime };
const technical = () => ({
  nextRunId: vi.fn(() => 'run-fixed'),
  nextGenerationSeed: vi.fn(() => 17),
  nextDetectionSeed: vi.fn(() => 29),
});

describe('S5-02 presentation operation envelopes', () => {
  it('captures authority at dispatch, deeply freezes facts and retains exactly the same intent for proven precommit retry', () => {
    const intents: SessionIntent[] = [];
    let calls = 0;
    let authority: SessionRead = fresh;
    const port: PresentationSessionPort = {
      read: () => authority,
      reload: () => authority,
      execute(intent) {
        intents.push(intent);
        calls++;
        if (calls === 1) return { status: 'rejected', reason: 'storage-failure' };
        authority = { status: 'loaded', runtime, persistence: { kind: 'committed', revision: 0, source: 'head', sourceSaveVersion: 3 } };
        return { status: 'committed', revision: 0, runtime };
      },
    };
    const source = technical();
    const adapter = createPresentationAdapter(port, source);
    expect(adapter.submit({ kind: 'start', levelId: 'level-001' })).toMatchObject({
      status: 'rejected', policy: { category: 'pre-commit-retainable', retainEnvelope: true },
    });
    expect(adapter.submit({ kind: 'start', levelId: 'level-001' })).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
    expect(adapter.retryRetained()).toMatchObject({ status: 'committed', snapshot: { status: 'loaded' } });
    expect(intents).toHaveLength(2);
    expect(intents[1]).toBe(intents[0]);
    expect(intents[0]).toMatchObject({
      kind: 'start', expectedRevision: null, expectedRunId: null,
      creation: { runId: 'run-fixed', baseSeed: 17, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' },
    });
    expect(Object.isFrozen(intents[0])).toBe(true);
    expect(Object.isFrozen((intents[0] as Extract<SessionIntent, { kind: 'start' }>).creation)).toBe(true);
    expect(source.nextRunId).toHaveBeenCalledTimes(1);
    expect(source.nextGenerationSeed).toHaveBeenCalledTimes(1);
    expect(source.nextDetectionSeed).not.toHaveBeenCalled();
  });

  it('discards a retained envelope if reload finds changed revision/run identity', () => {
    const execute = vi.fn((): SessionMutationResult => ({ status: 'rejected', reason: 'verification-failure' }));
    const port: PresentationSessionPort = {
      read: () => fresh,
      reload: () => ({ status: 'loaded', runtime, persistence: { kind: 'committed', revision: 1, source: 'head', sourceSaveVersion: 3 } }),
      execute,
    };
    const adapter = createPresentationAdapter(port, technical());
    expect(adapter.submit({ kind: 'detection' })).toMatchObject({ status: 'rejected' });
    expect(adapter.retryRetained()).toMatchObject({ status: 'rejected', reason: 'revision-conflict' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('never replays uncertain or unknown commit outcomes, even after reload', () => {
    for (const reason of ['commit-commit-outcome-uncertain', 'commit-new-future-status']) {
      const execute = vi.fn((): SessionMutationResult => ({ status: 'rejected', reason }));
      const port: PresentationSessionPort = { read: () => fresh, reload: () => fresh, execute };
      const adapter = createPresentationAdapter(port, technical());
      expect(adapter.submit({ kind: 'abandon' })).toMatchObject({ status: 'rejected', policy: { retainEnvelope: false, retryUseful: false } });
      expect(adapter.retryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
      expect(adapter.submit({ kind: 'abandon' })).toMatchObject({ status: 'unavailable', reason: 'reload-required' });
      expect(adapter.reload().status).toBe('fresh');
      expect(adapter.retryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
      expect(execute).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps invalid secure entropy and corrupt read non-destructive', () => {
    const execute = vi.fn((): SessionMutationResult => ({ status: 'rejected', reason: 'unused' }));
    const adapter = createPresentationAdapter({ read: () => fresh, reload: () => fresh, execute }, {
      nextRunId: () => { throw new Error('crypto unavailable'); },
      nextGenerationSeed: () => 1, nextDetectionSeed: () => 1,
    });
    expect(adapter.submit({ kind: 'start', levelId: 'level-001' })).toMatchObject({ status: 'unavailable', reason: 'entropy-unavailable', copyKey: 'error.entropy' });
    expect(execute).not.toHaveBeenCalled();
    const corrupt = createPresentationAdapter({ read: () => ({ status: 'invalid-save' }), reload: () => ({ status: 'invalid-save' }), execute }, technical());
    expect(corrupt.read()).toEqual({ status: 'recovery', reason: 'invalid-save' });
    expect(corrupt.submit({ kind: 'start', levelId: 'level-001' })).toMatchObject({ status: 'rejected', policy: { category: 'recovery' } });
    expect(execute).not.toHaveBeenCalled();
  });

  it('suppresses reentrant submissions without drawing a second seed', () => {
    const source = technical();
    let adapter!: ReturnType<typeof createPresentationAdapter>;
    const port: PresentationSessionPort = {
      read: () => fresh, reload: () => fresh,
      execute: () => {
        expect(adapter.submit({ kind: 'detection' })).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
        return { status: 'rejected', reason: 'no-attempt' };
      },
    };
    adapter = createPresentationAdapter(port, source);
    expect(adapter.submit({ kind: 'detection' })).toMatchObject({ status: 'rejected', reason: 'no-attempt' });
    expect(source.nextDetectionSeed).toHaveBeenCalledTimes(1);
  });
});
