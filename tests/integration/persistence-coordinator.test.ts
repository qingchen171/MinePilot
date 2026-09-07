import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
  type BoardState,
} from '../../src/core/board';
import { type SaveDocumentPersistenceInputV1 } from '../../src/core/persistence/save-v1';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingPosition,
  type RunPhase,
  type RunState,
} from '../../src/core/run';
import {
  commitSnapshot,
  SNAPSHOT_STORAGE_KEYS,
} from '../../src/systems/persistence/crash-safe-snapshot-store';
import {
  commitCandidateSaveV1,
  loadPersistedSave,
} from '../../src/systems/persistence/persistence-coordinator';
import { MemoryStorage } from '../helpers/memory-storage';

function activeBoard(): BoardState {
  return createBoard(createBoardDimensions({ width: 2, height: 1 }), [
    createCellState({
      terrain: 'playable',
      containsMine: false,
      explored: true,
      mineRevealed: false,
      flagged: false,
    }),
    createCellState({
      terrain: 'playable',
      containsMine: true,
      explored: false,
      mineRevealed: false,
      flagged: false,
    }),
  ]);
}

function runForPhase(phase: RunPhase): RunState {
  return createRunState(
    activeBoard(),
    phase.kind === 'pending-mine-encounter'
      ? createWaitingPosition()
      : createOnBoardPosition(createCoordinate(0, 0)),
    { hasTakenStep: true, phase },
  );
}

function candidateForRun(run: RunState, revision = 1): SaveDocumentPersistenceInputV1 {
  return {
    revision,
    activeRun: {
      runId: 'run-integration',
      levelId: 'level-integration',
      run,
      generationProvenance: {
        seed: 123456789,
        rngVersion: 'mulberry32-v1',
        generationVersion: 'initial-board-v1',
      },
    },
  };
}

function rawHead(slot: 'A' | 'B', revision: number): string {
  return JSON.stringify({ formatVersion: 1, slot, revision });
}

function loadRoundTrip(candidate: SaveDocumentPersistenceInputV1): ReturnType<typeof loadPersistedSave> {
  const storage = new MemoryStorage();
  expect(commitCandidateSaveV1(storage, candidate).status).toBe('committed');
  return loadPersistedSave(storage);
}

describe('Stage 2 persistence coordinator integration', () => {
  it.each([
    ['active on-board', { kind: 'active' }],
    [
      'pending mine encounter',
      {
        kind: 'pending-mine-encounter',
        encounter: { target: createCoordinate(1, 0), occurredOnFirstStep: true },
      },
    ],
    [
      'failed terminal',
      {
        kind: 'failed',
        encounter: { target: createCoordinate(1, 0), occurredOnFirstStep: false },
      },
    ],
  ] as const)('round-trips a %s authoritative Run through every frozen boundary', (_name, phase) => {
    const candidate = candidateForRun(runForPhase(phase));
    const result = loadRoundTrip(candidate);

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded' || result.save.activeRun === null) {
      throw new Error('Expected a loaded active Run.');
    }
    expect(result.source).toBe('head');
    expect(result.revision).toBe(candidate.revision);
    expect(result.save.activeRun.gameState.run).toEqual(candidate.activeRun?.run);
    expect(result.save.activeRun.generationProvenance).toEqual(
      candidate.activeRun?.generationProvenance,
    );
    expect(result.save.activeRun.gameState.run).not.toBe(candidate.activeRun?.run);
  });

  it('distinguishes malformed committed JSON from storage-envelope corruption', () => {
    const malformed = new MemoryStorage();
    expect(commitSnapshot(malformed, '{not-json', 1).status).toBe('committed');
    expect(loadPersistedSave(malformed)).toMatchObject({
      status: 'malformed-json',
      source: 'head',
      revision: 1,
    });

    const corruptEnvelope = new MemoryStorage();
    corruptEnvelope.data.set(SNAPSHOT_STORAGE_KEYS.slotA, '{bad-envelope');
    corruptEnvelope.data.set(SNAPSHOT_STORAGE_KEYS.head, rawHead('A', 1));
    expect(loadPersistedSave(corruptEnvelope)).toEqual({
      status: 'corrupt',
      reason: 'no-provable-committed-snapshot',
    });
  });

  it.each([
    ['missing version', { revision: 1, activeRun: null }, 'missing-version'],
    ['future version', { saveVersion: 3, revision: 1, activeRun: null }, 'unsupported-future-version'],
    [
      'v1 structural corruption',
      { saveVersion: 1, revision: 1, activeRun: null, unexpected: true },
      'invalid-old-version-document',
    ],
  ] as const)('preserves %s classification after storage and JSON boundaries', (_name, payload, status) => {
    const storage = new MemoryStorage();
    expect(commitSnapshot(storage, JSON.stringify(payload), 1).status).toBe('committed');

    expect(loadPersistedSave(storage)).toMatchObject({ status, source: 'head', revision: 1 });
  });

  it('preserves v1 inconsistent-Run issues from the authoritative loader', () => {
    const valid = loadRoundTrip(candidateForRun(runForPhase({ kind: 'active' })));
    if (valid.status !== 'loaded') throw new Error('Expected valid fixture.');
    const validDocument = valid.save.document;
    if (validDocument.activeRun === null) throw new Error('Expected active Run DTO.');
    const document = {
      ...structuredClone(validDocument),
      activeRun: {
        ...structuredClone(validDocument.activeRun),
        characterPosition: {
          kind: 'on-board' as const,
          coordinate: { x: 1, y: 0 },
        },
      },
    };
    const storage = new MemoryStorage();
    expect(commitSnapshot(storage, JSON.stringify(document), 1).status).toBe('committed');

    expect(loadPersistedSave(storage)).toMatchObject({
      status: 'invalid-current-version-document',
      issues: [{ code: 'inconsistent-run', path: 'activeRun' }],
    });
  });

  it('preserves successful backup recovery instead of reporting an ordinary load', () => {
    const storage = new MemoryStorage();
    expect(commitCandidateSaveV1(storage, candidateForRun(runForPhase({ kind: 'active' }))).status)
      .toBe('committed');
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{broken-head');

    const result = loadPersistedSave(storage);

    expect(result).toMatchObject({
      status: 'recovered-from-backup',
      source: 'head-backup',
      revision: 1,
    });
  });

  it('does not call invalid backup payload a successful recovery', () => {
    const storage = new MemoryStorage();
    expect(commitSnapshot(storage, '{broken-payload', 1).status).toBe('committed');
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{broken-head');

    expect(loadPersistedSave(storage)).toMatchObject({
      status: 'malformed-json',
      source: 'head-backup',
      revision: 1,
    });
  });

  it('rejects disagreement between the storage revision and Save document revision', () => {
    const valid = loadRoundTrip(candidateForRun(runForPhase({ kind: 'active' }), 1));
    if (valid.status !== 'loaded') throw new Error('Expected valid fixture.');
    const storage = new MemoryStorage();
    expect(commitSnapshot(storage, JSON.stringify(valid.save.document), 2).status).toBe('committed');

    expect(loadPersistedSave(storage)).toMatchObject({
      status: 'revision-mismatch',
      revision: 2,
      documentRevision: 1,
    });
  });
});
