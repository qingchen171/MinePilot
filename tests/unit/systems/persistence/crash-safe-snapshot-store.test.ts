import { describe, expect, it } from 'vitest';
import {
  commitSnapshot,
  loadCommittedSnapshot,
  SNAPSHOT_STORAGE_KEYS,
} from '../../../../src/systems/persistence/crash-safe-snapshot-store';
import {
  type StorageFailure,
  type StorageOperation,
  type StorageReadResult,
  type StorageWriteResult,
  type StringKeyValueStorage,
} from '../../../../src/systems/persistence/key-value-storage';

interface FailurePlan {
  readonly operation: StorageOperation;
  readonly key: string;
  remainingMatches: number;
}

class MemoryStorage implements StringKeyValueStorage {
  readonly data = new Map<string, string>();
  readonly operations: string[] = [];
  private failures: FailurePlan[] = [];
  private writeTransforms = new Map<string, (value: string) => string>();

  failNext(operation: StorageOperation, key: string): void {
    this.failOnOccurrence(operation, key, 1);
  }

  failOnOccurrence(operation: StorageOperation, key: string, occurrence: number): void {
    this.failures.push({ operation, key, remainingMatches: occurrence });
  }

  transformNextWrite(key: string, transform: (value: string) => string): void {
    this.writeTransforms.set(key, transform);
  }

  read(key: string): StorageReadResult {
    this.operations.push(`read:${key}`);
    const failure = this.takeFailure('read', key);
    return failure ?? { status: 'success', value: this.data.get(key) ?? null };
  }

  write(key: string, value: string): StorageWriteResult {
    this.operations.push(`write:${key}`);
    const failure = this.takeFailure('write', key);
    if (failure !== undefined) return failure;
    const transform = this.writeTransforms.get(key);
    this.writeTransforms.delete(key);
    this.data.set(key, transform?.(value) ?? value);
    return { status: 'success' };
  }

  remove(key: string): StorageWriteResult {
    this.operations.push(`remove:${key}`);
    const failure = this.takeFailure('remove', key);
    if (failure !== undefined) return failure;
    this.data.delete(key);
    return { status: 'success' };
  }

  private takeFailure(operation: StorageOperation, key: string): StorageFailure | undefined {
    const index = this.failures.findIndex(
      (failure) => failure.operation === operation && failure.key === key,
    );
    if (index === -1) return undefined;
    if (this.failures[index].remainingMatches > 1) {
      this.failures[index].remainingMatches -= 1;
      return undefined;
    }
    this.failures.splice(index, 1);
    return {
      status: 'failure',
      operation,
      reason: 'exception',
      key,
      cause: new Error('injected storage failure'),
    };
  }
}

function expectCommitted(
  storage: MemoryStorage,
  payload: string,
  revision: number,
): void {
  expect(commitSnapshot(storage, payload, revision)).toMatchObject({ status: 'committed' });
}

function head(slot: 'A' | 'B', revision: number): string {
  return JSON.stringify({ formatVersion: 1, slot, revision });
}

function snapshot(slot: 'A' | 'B', revision: number, serializedPayload: string): string {
  return JSON.stringify({ formatVersion: 1, slot, revision, serializedPayload });
}

describe('crash-safe A/B snapshot store', () => {
  it('distinguishes fresh storage from corruption', () => {
    expect(loadCommittedSnapshot(new MemoryStorage())).toEqual({ status: 'no-save' });
  });

  it('commits the first save to slot A and makes head the commit point', () => {
    const storage = new MemoryStorage();

    expect(commitSnapshot(storage, 'first', 10)).toEqual({
      status: 'committed',
      slot: 'A',
      revision: 10,
      backupUpdate: 'updated',
    });
    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'loaded',
      source: 'head',
      slot: 'A',
      revision: 10,
      serializedPayload: 'first',
    });
  });

  it('alternates A to B to A without creating history slots', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'one', 1);
    expect(commitSnapshot(storage, 'two', 2)).toMatchObject({ status: 'committed', slot: 'B' });
    expect(commitSnapshot(storage, 'three', 3)).toMatchObject({ status: 'committed', slot: 'A' });
    expect([...storage.data.keys()].sort()).toEqual(Object.values(SNAPSHOT_STORAGE_KEYS).sort());
  });

  it('uses a valid head even when the other slot has a higher revision', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'committed', 3);
    storage.data.set(SNAPSHOT_STORAGE_KEYS.slotB, snapshot('B', 99, 'staged'));

    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'loaded',
      slot: 'A',
      revision: 3,
      serializedPayload: 'committed',
    });
  });

  it.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
    ['NaN', Number.NaN],
  ])('rejects a %s caller-provided revision', (_description, revision) => {
    expect(commitSnapshot(new MemoryStorage(), 'payload', revision)).toEqual({
      status: 'invalid-revision',
    });
  });

  it('does not overwrite the committed slot when the inactive slot write fails', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'old', 1);
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);

    expect(commitSnapshot(storage, 'new', 2)).toMatchObject({
      status: 'storage-failure',
      stage: 'slot-write',
    });
    expect(loadCommittedSnapshot(storage)).toMatchObject({ serializedPayload: 'old' });
  });

  it('keeps the old head authoritative when inactive read-back fails', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'old', 1);
    storage.failNext('read', SNAPSHOT_STORAGE_KEYS.slotB);

    expect(commitSnapshot(storage, 'new', 2)).toMatchObject({
      status: 'storage-failure',
      stage: 'slot-read-back',
    });
    expect(loadCommittedSnapshot(storage)).toMatchObject({ serializedPayload: 'old' });
  });

  it.each([
    ['slot identity', (raw: string) => raw.replace('"slot":"B"', '"slot":"A"')],
    ['revision', (raw: string) => raw.replace('"revision":2', '"revision":3')],
    ['payload', (raw: string) => raw.replace('"new"', '"altered"')],
  ] as const)('refuses to commit a read-back %s mismatch', (_description, transform) => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'old', 1);
    storage.transformNextWrite(SNAPSHOT_STORAGE_KEYS.slotB, transform);

    expect(commitSnapshot(storage, 'new', 2)).toEqual({
      status: 'verification-failure',
      slot: 'B',
    });
    expect(loadCommittedSnapshot(storage)).toMatchObject({ serializedPayload: 'old' });
  });

  it('does not write new head when preserving old committed backup fails', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'old', 1);
    const oldHead = storage.data.get(SNAPSHOT_STORAGE_KEYS.head);
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.headBackup);

    expect(commitSnapshot(storage, 'new', 2)).toMatchObject({
      status: 'storage-failure',
      stage: 'backup-head-write',
    });
    expect(storage.data.get(SNAPSHOT_STORAGE_KEYS.head)).toBe(oldHead);
    expect(loadCommittedSnapshot(storage)).toMatchObject({ serializedPayload: 'old' });
  });

  it('keeps old committed data readable when new-head write fails', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'old', 1);
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);

    expect(commitSnapshot(storage, 'new', 2)).toMatchObject({
      status: 'storage-failure',
      stage: 'new-head-write',
    });
    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'loaded',
      slot: 'A',
      serializedPayload: 'old',
    });
  });

  it('treats a backup update after head as best-effort because commit already occurred', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'old', 1);
    storage.failOnOccurrence('write', SNAPSHOT_STORAGE_KEYS.headBackup, 2);
    const result = commitSnapshot(storage, 'new', 2);
    expect(result).toMatchObject({
      status: 'committed',
      slot: 'B',
      revision: 2,
      backupUpdate: 'failed',
    });
    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'loaded',
      slot: 'B',
      serializedPayload: 'new',
    });
  });

  it('does not promote a staged slot after a crash before head write', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'old', 1);
    storage.data.set(SNAPSHOT_STORAGE_KEYS.slotB, snapshot('B', 2, 'staged'));

    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'loaded',
      slot: 'A',
      revision: 1,
      serializedPayload: 'old',
    });
  });

  it('loads the new snapshot immediately after successful head commit', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'old', 1);
    expectCommitted(storage, 'new', 2);

    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'loaded',
      slot: 'B',
      revision: 2,
      serializedPayload: 'new',
    });
  });

  it('recovers through a valid backup when head is malformed', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'committed', 4);
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{broken');

    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'recovered-from-backup',
      slot: 'A',
      revision: 4,
      serializedPayload: 'committed',
    });
  });

  it('recovers through backup when head points to a missing slot', () => {
    const storage = new MemoryStorage();
    storage.data.set(SNAPSHOT_STORAGE_KEYS.slotA, snapshot('A', 1, 'old'));
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, head('B', 2));
    storage.data.set(SNAPSHOT_STORAGE_KEYS.headBackup, head('A', 1));

    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'recovered-from-backup',
      serializedPayload: 'old',
    });
  });

  it('recovers through backup when head revision does not match its slot', () => {
    const storage = new MemoryStorage();
    storage.data.set(SNAPSHOT_STORAGE_KEYS.slotA, snapshot('A', 1, 'old'));
    storage.data.set(SNAPSHOT_STORAGE_KEYS.slotB, snapshot('B', 2, 'staged'));
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, head('B', 3));
    storage.data.set(SNAPSHOT_STORAGE_KEYS.headBackup, head('A', 1));

    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'recovered-from-backup',
      slot: 'A',
      serializedPayload: 'old',
    });
  });

  it('ignores malformed backup while a valid head exists', () => {
    const storage = new MemoryStorage();
    expectCommitted(storage, 'committed', 1);
    storage.data.set(SNAPSHOT_STORAGE_KEYS.headBackup, '{bad');

    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'loaded',
      serializedPayload: 'committed',
    });
  });

  it.each([
    ['both heads malformed', '{bad', '{bad'],
    ['head missing and backup malformed', undefined, '{bad'],
    ['head malformed and backup missing', '{bad', undefined],
  ] as const)('reports corruption when %s', (_description, currentHead, backupHead) => {
    const storage = new MemoryStorage();
    storage.data.set(SNAPSHOT_STORAGE_KEYS.slotA, snapshot('A', 1, 'diagnostic-data'));
    if (currentHead !== undefined) storage.data.set(SNAPSHOT_STORAGE_KEYS.head, currentHead);
    if (backupHead !== undefined) {
      storage.data.set(SNAPSHOT_STORAGE_KEYS.headBackup, backupHead);
    }

    expect(loadCommittedSnapshot(storage)).toEqual({
      status: 'corrupt',
      reason: 'no-provable-committed-snapshot',
    });
    expect(storage.data.get(SNAPSHOT_STORAGE_KEYS.slotA)).toContain('diagnostic-data');
  });

  it('never adopts a higher-revision slot when both pointers are unusable', () => {
    const storage = new MemoryStorage();
    storage.data.set(SNAPSHOT_STORAGE_KEYS.slotA, snapshot('A', 5, 'staged'));
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{bad');

    expect(loadCommittedSnapshot(storage)).toEqual({
      status: 'corrupt',
      reason: 'no-provable-committed-snapshot',
    });
  });

  it.each([
    ['head read', SNAPSHOT_STORAGE_KEYS.head],
    ['backup read', SNAPSHOT_STORAGE_KEYS.headBackup],
    ['slot scan', SNAPSHOT_STORAGE_KEYS.slotA],
  ] as const)('returns structured storage failure for %s exceptions', (_description, key) => {
    const storage = new MemoryStorage();
    if (key !== SNAPSHOT_STORAGE_KEYS.head) {
      storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{bad');
    }
    if (key === SNAPSHOT_STORAGE_KEYS.slotA) {
      storage.data.set(SNAPSHOT_STORAGE_KEYS.headBackup, '{bad');
    }
    storage.failNext('read', key);

    expect(loadCommittedSnapshot(storage)).toMatchObject({
      status: 'storage-failure',
      failure: { operation: 'read', key },
    });
  });

  it('refuses to commit over corruption and does not delete diagnostic data', () => {
    const storage = new MemoryStorage();
    storage.data.set(SNAPSHOT_STORAGE_KEYS.slotB, snapshot('B', 9, 'orphan'));
    const before = new Map(storage.data);

    expect(commitSnapshot(storage, 'new', 10)).toEqual({
      status: 'corrupt',
      reason: 'no-provable-committed-snapshot',
    });
    expect(storage.data).toEqual(before);
    expect(storage.operations.every((operation) => !operation.startsWith('remove:'))).toBe(true);
  });

  it('stores payload as opaque text without inspecting Save or gameplay fields', () => {
    const storage = new MemoryStorage();
    const opaquePayload = 'not JSON and not a SaveDocument';

    expectCommitted(storage, opaquePayload, 1);
    expect(loadCommittedSnapshot(storage)).toMatchObject({
      serializedPayload: opaquePayload,
    });
  });
});
