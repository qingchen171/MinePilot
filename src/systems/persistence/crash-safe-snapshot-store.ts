import {
  type StorageFailure,
  type StringKeyValueStorage,
} from './key-value-storage';

export type SnapshotSlot = 'A' | 'B';

export const SNAPSHOT_STORAGE_KEYS = Object.freeze({
  slotA: 'minepilot:persistence:slot:A',
  slotB: 'minepilot:persistence:slot:B',
  head: 'minepilot:persistence:head',
  headBackup: 'minepilot:persistence:head-backup',
});

interface SnapshotEnvelope {
  readonly formatVersion: 1;
  readonly slot: SnapshotSlot;
  readonly revision: number;
  readonly serializedPayload: string;
}

interface HeadRecord {
  readonly formatVersion: 1;
  readonly slot: SnapshotSlot;
  readonly revision: number;
}

export type LoadCommittedSnapshotResult =
  | {
      readonly status: 'loaded';
      readonly source: 'head';
      readonly slot: SnapshotSlot;
      readonly revision: number;
      readonly serializedPayload: string;
    }
  | {
      readonly status: 'recovered-from-backup';
      readonly source: 'head-backup';
      readonly slot: SnapshotSlot;
      readonly revision: number;
      readonly serializedPayload: string;
    }
  | { readonly status: 'no-save' }
  | {
      readonly status: 'corrupt';
      readonly reason: 'no-provable-committed-snapshot';
    }
  | { readonly status: 'storage-failure'; readonly failure: StorageFailure };

export type SnapshotCommitStage =
  | 'load-current'
  | 'slot-write'
  | 'slot-read-back'
  | 'backup-head-write'
  | 'new-head-write';

export type CommitSnapshotResult =
  | {
      readonly status: 'committed';
      readonly slot: SnapshotSlot;
      readonly revision: number;
      readonly backupUpdate: 'updated' | 'failed';
      readonly backupFailure?: StorageFailure;
    }
  | { readonly status: 'invalid-revision' }
  | {
      readonly status: 'corrupt';
      readonly reason: 'no-provable-committed-snapshot';
    }
  | {
      readonly status: 'verification-failure';
      readonly slot: SnapshotSlot;
    }
  | {
      readonly status: 'storage-failure';
      readonly stage: SnapshotCommitStage;
      readonly failure: StorageFailure;
    };

type ResolvedPointer =
  | { readonly status: 'valid'; readonly head: HeadRecord; readonly snapshot: SnapshotEnvelope }
  | { readonly status: 'invalid' }
  | { readonly status: 'storage-failure'; readonly failure: StorageFailure };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isSlot(value: unknown): value is SnapshotSlot {
  return value === 'A' || value === 'B';
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseHead(raw: string): HeadRecord | undefined {
  const value = parseJson(raw);
  if (
    !isRecord(value) ||
    !hasExactFields(value, ['formatVersion', 'slot', 'revision']) ||
    value.formatVersion !== 1 ||
    !isSlot(value.slot) ||
    !isRevision(value.revision)
  ) {
    return undefined;
  }
  return { formatVersion: 1, slot: value.slot, revision: value.revision };
}

function parseSnapshot(raw: string): SnapshotEnvelope | undefined {
  const value = parseJson(raw);
  if (
    !isRecord(value) ||
    !hasExactFields(value, ['formatVersion', 'slot', 'revision', 'serializedPayload']) ||
    value.formatVersion !== 1 ||
    !isSlot(value.slot) ||
    !isRevision(value.revision) ||
    typeof value.serializedPayload !== 'string'
  ) {
    return undefined;
  }
  return {
    formatVersion: 1,
    slot: value.slot,
    revision: value.revision,
    serializedPayload: value.serializedPayload,
  };
}

function slotKey(slot: SnapshotSlot): string {
  return slot === 'A' ? SNAPSHOT_STORAGE_KEYS.slotA : SNAPSHOT_STORAGE_KEYS.slotB;
}

function serializeHead(head: HeadRecord): string {
  return JSON.stringify(head);
}

function serializeSnapshot(snapshot: SnapshotEnvelope): string {
  return JSON.stringify(snapshot);
}

function resolvePointer(
  storage: StringKeyValueStorage,
  rawHead: string | null,
): ResolvedPointer {
  if (rawHead === null) return { status: 'invalid' };
  const head = parseHead(rawHead);
  if (head === undefined) return { status: 'invalid' };
  const stored = storage.read(slotKey(head.slot));
  if (stored.status === 'failure') return { status: 'storage-failure', failure: stored };
  if (stored.value === null) return { status: 'invalid' };
  const snapshot = parseSnapshot(stored.value);
  if (
    snapshot === undefined ||
    snapshot.slot !== head.slot ||
    snapshot.revision !== head.revision
  ) {
    return { status: 'invalid' };
  }
  return { status: 'valid', head, snapshot };
}

export function loadCommittedSnapshot(
  storage: StringKeyValueStorage,
): LoadCommittedSnapshotResult {
  const headRead = storage.read(SNAPSHOT_STORAGE_KEYS.head);
  if (headRead.status === 'failure') {
    return { status: 'storage-failure', failure: headRead };
  }
  const head = resolvePointer(storage, headRead.value);
  if (head.status === 'storage-failure') return head;
  if (head.status === 'valid') {
    return {
      status: 'loaded',
      source: 'head',
      slot: head.snapshot.slot,
      revision: head.snapshot.revision,
      serializedPayload: head.snapshot.serializedPayload,
    };
  }

  const backupRead = storage.read(SNAPSHOT_STORAGE_KEYS.headBackup);
  if (backupRead.status === 'failure') {
    return { status: 'storage-failure', failure: backupRead };
  }
  const backup = resolvePointer(storage, backupRead.value);
  if (backup.status === 'storage-failure') return backup;
  if (backup.status === 'valid') {
    return {
      status: 'recovered-from-backup',
      source: 'head-backup',
      slot: backup.snapshot.slot,
      revision: backup.snapshot.revision,
      serializedPayload: backup.snapshot.serializedPayload,
    };
  }

  const slotA = storage.read(SNAPSHOT_STORAGE_KEYS.slotA);
  if (slotA.status === 'failure') return { status: 'storage-failure', failure: slotA };
  const slotB = storage.read(SNAPSHOT_STORAGE_KEYS.slotB);
  if (slotB.status === 'failure') return { status: 'storage-failure', failure: slotB };
  return headRead.value === null &&
    backupRead.value === null &&
    slotA.value === null &&
    slotB.value === null
    ? { status: 'no-save' }
    : { status: 'corrupt', reason: 'no-provable-committed-snapshot' };
}

export function commitSnapshot(
  storage: StringKeyValueStorage,
  serializedPayload: string,
  revision: number,
): CommitSnapshotResult {
  if (!isRevision(revision)) return { status: 'invalid-revision' };

  const current = loadCommittedSnapshot(storage);
  if (current.status === 'storage-failure') {
    return { status: 'storage-failure', stage: 'load-current', failure: current.failure };
  }
  if (current.status === 'corrupt') return current;

  const currentHead: HeadRecord | undefined = current.status === 'no-save'
    ? undefined
    : { formatVersion: 1, slot: current.slot, revision: current.revision };
  const targetSlot: SnapshotSlot = currentHead?.slot === 'A' ? 'B' : 'A';
  const nextHead: HeadRecord = { formatVersion: 1, slot: targetSlot, revision };
  const snapshot: SnapshotEnvelope = {
    formatVersion: 1,
    slot: targetSlot,
    revision,
    serializedPayload,
  };

  const slotWrite = storage.write(slotKey(targetSlot), serializeSnapshot(snapshot));
  if (slotWrite.status === 'failure') {
    return { status: 'storage-failure', stage: 'slot-write', failure: slotWrite };
  }
  const slotRead = storage.read(slotKey(targetSlot));
  if (slotRead.status === 'failure') {
    return { status: 'storage-failure', stage: 'slot-read-back', failure: slotRead };
  }
  const verified = slotRead.value === null ? undefined : parseSnapshot(slotRead.value);
  if (
    verified === undefined ||
    verified.slot !== snapshot.slot ||
    verified.revision !== snapshot.revision ||
    verified.serializedPayload !== snapshot.serializedPayload
  ) {
    return { status: 'verification-failure', slot: targetSlot };
  }

  if (currentHead !== undefined) {
    const backupWrite = storage.write(
      SNAPSHOT_STORAGE_KEYS.headBackup,
      serializeHead(currentHead),
    );
    if (backupWrite.status === 'failure') {
      return {
        status: 'storage-failure',
        stage: 'backup-head-write',
        failure: backupWrite,
      };
    }
  }

  const headWrite = storage.write(SNAPSHOT_STORAGE_KEYS.head, serializeHead(nextHead));
  if (headWrite.status === 'failure') {
    return { status: 'storage-failure', stage: 'new-head-write', failure: headWrite };
  }

  const backupUpdate = storage.write(
    SNAPSHOT_STORAGE_KEYS.headBackup,
    serializeHead(nextHead),
  );
  return backupUpdate.status === 'failure'
    ? {
        status: 'committed',
        slot: targetSlot,
        revision,
        backupUpdate: 'failed',
        backupFailure: backupUpdate,
      }
    : { status: 'committed', slot: targetSlot, revision, backupUpdate: 'updated' };
}
