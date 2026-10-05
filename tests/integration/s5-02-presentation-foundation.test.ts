import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createPresentationRoot } from '../../src/presentation-root';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { SNAPSHOT_STORAGE_KEYS, loadCommittedSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { WRITER_LEASE_STORAGE_KEY } from '../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../helpers/memory-storage';
import { validateDependency } from '../../scripts/check-architecture.mjs';

const owner = { sessionId: 'presentation-owner', leaseToken: 'presentation-token' };
const clock = { nowMs: () => 100 };
const choice = { kind: 'start' as const, levelId: 'level-001' };

function technical() {
  return {
    nextRunId: vi.fn(() => 'stable-run-id'),
    nextGenerationSeed: vi.fn(() => 123456789),
    nextDetectionSeed: vi.fn(() => 47),
  };
}

function fixture(storage = new MemoryStorage()) {
  const session = createProductionStage4Session(storage, owner, clock);
  const facts = technical();
  const presentation = createPresentationRoot(session, facts);
  return { storage, session, facts, presentation };
}

describe('S5-02 real production session bridge', () => {
  it('reads without writes, then publishes only the committed v3 authority as sanitized ViewModel', () => {
    const f = fixture();
    expect(f.presentation.read()).toMatchObject({ status: 'fresh', view: { attempt: null } });
    expect(f.storage.operations.every((operation) => operation.startsWith('read:'))).toBe(true);
    const result = f.presentation.submit(choice);
    expect(result).toMatchObject({ status: 'committed', snapshot: { status: 'loaded', view: { attempt: { levelId: 'level-001' } } } });
    expect(f.session.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0, sourceSaveVersion: 3 } });
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 0 });
    const view = f.presentation.read();
    expect(JSON.stringify(view)).not.toContain('stable-run-id');
    expect(JSON.stringify(view)).not.toContain('123456789');
    expect(JSON.stringify(view)).not.toContain('rewards');
    expect(f.facts.nextRunId).toHaveBeenCalledTimes(1);
    expect(f.facts.nextGenerationSeed).toHaveBeenCalledTimes(1);
    expect(f.facts.nextDetectionSeed).not.toHaveBeenCalled();
    expect(createProductionStage4Session(f.storage, owner, clock).read()).toMatchObject({ status: 'loaded', persistence: { revision: 0 } });
  });

  it('keeps exact creation facts through a real pre-commit lease-read failure and user-initiated retry', () => {
    const f = fixture();
    f.storage.failNext('read', WRITER_LEASE_STORAGE_KEY);
    expect(f.presentation.submit(choice)).toMatchObject({ status: 'rejected', reason: 'storage-failure', policy: { retainEnvelope: true } });
    expect(loadCommittedSnapshot(f.storage).status).toBe('no-save');
    expect(f.presentation.retryRetained()).toMatchObject({ status: 'committed', snapshot: { status: 'loaded' } });
    expect(f.session.read()).toMatchObject({ status: 'loaded', runtime: { currentAttempt: { runId: 'stable-run-id', generationProvenance: { seed: 123456789 } } } });
    expect(f.facts.nextRunId).toHaveBeenCalledTimes(1);
    expect(f.facts.nextGenerationSeed).toHaveBeenCalledTimes(1);
  });

  it('discards stale revision/run authority and active competing lease without publishing', () => {
    const storage = new MemoryStorage();
    const stale = fixture(storage);
    expect(fixture(storage).presentation.submit(choice).status).toBe('committed');
    expect(stale.presentation.submit(choice)).toMatchObject({ status: 'rejected', reason: 'revision-conflict', policy: { category: 'stale' } });
    expect(stale.presentation.retryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
    expect(stale.session.read().status).toBe('fresh');
    expect(loadCommittedSnapshot(storage)).toMatchObject({ status: 'loaded', revision: 0 });
    const other = createProductionStage4Session(storage, { sessionId: 'other', leaseToken: 'other' }, clock);
    expect(other.execute({ kind: 'dismiss', expectedRevision: 0, expectedRunId: 'stable-run-id' })).toMatchObject({ status: 'rejected', reason: 'owned-by-another-session' });
  });

  it('never replays a new-head-write uncertain commit and keeps reload non-destructive', () => {
    const f = fixture();
    f.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    expect(f.presentation.submit(choice)).toMatchObject({ status: 'rejected', reason: 'commit-commit-outcome-uncertain', policy: { retainEnvelope: false } });
    expect(f.presentation.retryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
    expect(f.presentation.submit(choice)).toMatchObject({ status: 'unavailable', reason: 'reload-required' });
    expect(f.facts.nextRunId).toHaveBeenCalledTimes(1);
    expect(f.presentation.reload()).toMatchObject({ status: 'recovery' });
    expect(f.storage.operations.filter((operation) => operation.startsWith('write:')).length).toBeGreaterThan(0);
    expect(f.facts.nextRunId).toHaveBeenCalledTimes(1);
  });

  it('keeps the entire commit-persistence-commit-failure reason conservative across pre-head failures', () => {
    const slot = fixture();
    slot.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotA);
    expect(slot.presentation.submit(choice)).toMatchObject({
      status: 'rejected', reason: 'commit-persistence-commit-failure',
      policy: { category: 'pre-commit-discard', retainEnvelope: false, retryUseful: false },
    });
    expect(slot.presentation.retryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
    expect(loadCommittedSnapshot(slot.storage).status).toBe('no-save');

    const existing = fixture();
    expect(existing.presentation.submit(choice).status).toBe('committed');
    const before = loadCommittedSnapshot(existing.storage);
    existing.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.headBackup);
    expect(existing.presentation.submit({ kind: 'flag', coordinate: { x: 0, y: 0 }, flagged: true })).toMatchObject({
      status: 'rejected', reason: 'commit-persistence-commit-failure', policy: { retainEnvelope: false },
    });
    expect(loadCommittedSnapshot(existing.storage)).toEqual(before);
  });

  it('guards the one composition-root session and legal bootstrap-only projector handoff', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main.match(/createProductionStage4Session\(/g)).toHaveLength(1);
    expect(main).toContain('createPresentationRoot(productionSession');
    expect(validateDependency('src/systems/presentation/adapter.ts', '../persistence/production-stage4-runtime', true)).toMatch(/must not import persistence/);
    expect(validateDependency('src/systems/presentation/adapter.ts', '../../ui/presentation-projection', true)).toMatch(/systems must not import ui/);
    expect(validateDependency('src/ui/presentation-projection.ts', '../systems/presentation/adapter', true)).toMatch(/ui may import only/);
    expect(validateDependency('src/ui/presentation-projection.ts', '../core/current-cell-mine-count', false)).toMatch(/ui may import only/);
    const presentationSources = ['adapter.ts', 'technical-facts.ts', 'public-facts.ts', 'session-port.ts'];
    for (const file of presentationSources) {
      const source = readFileSync(`src/systems/presentation/${file}`, 'utf8');
      expect(source).not.toMatch(/Math\.random\s*\(/);
      expect(source).not.toMatch(/(?:\.\.\/persistence|\.\.\/\.\.\/ui|\bCrypto\b|\bgetRandomValues\b)/);
    }
  });
});
