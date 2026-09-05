import {
  type StorageFailure,
  type StringKeyValueStorage,
} from './key-value-storage';

export const WRITER_LEASE_STORAGE_KEY = 'minepilot:persistence:writer-lease';
export const DEFAULT_WRITER_LEASE_DURATION_MS = 30_000;

export interface Clock {
  nowMs(): number;
}

export interface RandomUuidSource {
  randomUUID(): string;
}

export interface WriterIdentity {
  readonly sessionId: string;
  readonly leaseToken: string;
}

export interface WriterLeaseRecord extends WriterIdentity {
  readonly formatVersion: 1;
  readonly expiresAtMs: number;
}

export type InspectWriterLeaseResult =
  | { readonly status: 'no-lease' }
  | { readonly status: 'active'; readonly lease: WriterLeaseRecord }
  | { readonly status: 'expired'; readonly lease: WriterLeaseRecord }
  | { readonly status: 'invalid-lease' }
  | { readonly status: 'storage-failure'; readonly failure: StorageFailure };

export type AcquireWriterLeaseResult =
  | {
      readonly status: 'acquired' | 'renewed';
      readonly lease: WriterLeaseRecord;
    }
  | {
      readonly status: 'owned-by-another-session';
      readonly ownerSessionId: string;
      readonly expiresAtMs: number;
    }
  | { readonly status: 'invalid-lease' }
  | { readonly status: 'invalid-request'; readonly reason: 'identity' | 'duration' | 'clock' }
  | { readonly status: 'verification-failure' }
  | { readonly status: 'storage-failure'; readonly failure: StorageFailure };

export type RenewWriterLeaseResult =
  | { readonly status: 'renewed'; readonly lease: WriterLeaseRecord }
  | { readonly status: 'not-owner' }
  | { readonly status: 'lease-expired' }
  | { readonly status: 'no-lease' | 'invalid-lease' }
  | { readonly status: 'invalid-request'; readonly reason: 'identity' | 'duration' | 'clock' }
  | { readonly status: 'verification-failure' }
  | { readonly status: 'storage-failure'; readonly failure: StorageFailure };

export type ReleaseWriterLeaseResult =
  | { readonly status: 'released' }
  | { readonly status: 'not-owner' }
  | { readonly status: 'lease-expired' }
  | { readonly status: 'no-lease' | 'invalid-lease' }
  | { readonly status: 'invalid-request'; readonly reason: 'identity' | 'clock' }
  | { readonly status: 'storage-failure'; readonly failure: StorageFailure };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function isNonEmptyIdentityPart(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseLease(raw: string): WriterLeaseRecord | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (
    !isRecord(value) ||
    !hasExactFields(value, ['formatVersion', 'sessionId', 'leaseToken', 'expiresAtMs']) ||
    value.formatVersion !== 1 ||
    !isNonEmptyIdentityPart(value.sessionId) ||
    !isNonEmptyIdentityPart(value.leaseToken) ||
    !isValidTimestamp(value.expiresAtMs)
  ) {
    return undefined;
  }
  return {
    formatVersion: 1,
    sessionId: value.sessionId,
    leaseToken: value.leaseToken,
    expiresAtMs: value.expiresAtMs,
  };
}

function sameLease(left: WriterLeaseRecord, right: WriterLeaseRecord): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.leaseToken === right.leaseToken &&
    left.expiresAtMs === right.expiresAtMs
  );
}

function now(clock: Clock): number | undefined {
  const value = clock.nowMs();
  return isValidTimestamp(value) ? value : undefined;
}

function validIdentity(identity: WriterIdentity): boolean {
  return isNonEmptyIdentityPart(identity.sessionId) && isNonEmptyIdentityPart(identity.leaseToken);
}

function validDuration(durationMs: number): boolean {
  return Number.isSafeInteger(durationMs) && durationMs > 0;
}

function expiresAt(nowMs: number, durationMs: number): number | undefined {
  const value = nowMs + durationMs;
  return Number.isSafeInteger(value) ? value : undefined;
}

function writeAndVerifyLease(
  storage: StringKeyValueStorage,
  lease: WriterLeaseRecord,
):
  | { readonly status: 'verified' }
  | { readonly status: 'verification-failure' }
  | { readonly status: 'storage-failure'; readonly failure: StorageFailure } {
  const written = storage.write(WRITER_LEASE_STORAGE_KEY, JSON.stringify(lease));
  if (written.status === 'failure') return { status: 'storage-failure', failure: written };
  const readBack = storage.read(WRITER_LEASE_STORAGE_KEY);
  if (readBack.status === 'failure') return { status: 'storage-failure', failure: readBack };
  const verified = readBack.value === null ? undefined : parseLease(readBack.value);
  return verified !== undefined && sameLease(verified, lease)
    ? { status: 'verified' }
    : { status: 'verification-failure' };
}

export function createSystemClock(): Clock {
  return { nowMs: () => Date.now() };
}

export function createWriterIdentity(
  uuidSource: RandomUuidSource = globalThis.crypto,
): WriterIdentity {
  const sessionId = uuidSource.randomUUID();
  const leaseToken = uuidSource.randomUUID();
  if (!isNonEmptyIdentityPart(sessionId) || !isNonEmptyIdentityPart(leaseToken)) {
    throw new Error('Writer identity generation returned an invalid UUID.');
  }
  return Object.freeze({ sessionId, leaseToken });
}

export function inspectWriterLease(
  storage: StringKeyValueStorage,
  clock: Clock,
): InspectWriterLeaseResult {
  const nowMs = now(clock);
  if (nowMs === undefined) return { status: 'invalid-lease' };
  const result = storage.read(WRITER_LEASE_STORAGE_KEY);
  if (result.status === 'failure') return { status: 'storage-failure', failure: result };
  if (result.value === null) return { status: 'no-lease' };
  const lease = parseLease(result.value);
  if (lease === undefined) return { status: 'invalid-lease' };
  return lease.expiresAtMs <= nowMs
    ? { status: 'expired', lease }
    : { status: 'active', lease };
}

export function acquireWriterLease(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  durationMs = DEFAULT_WRITER_LEASE_DURATION_MS,
): AcquireWriterLeaseResult {
  if (!validIdentity(identity)) return { status: 'invalid-request', reason: 'identity' };
  if (!validDuration(durationMs)) return { status: 'invalid-request', reason: 'duration' };
  const nowMs = now(clock);
  if (nowMs === undefined) return { status: 'invalid-request', reason: 'clock' };
  const expiry = expiresAt(nowMs, durationMs);
  if (expiry === undefined) return { status: 'invalid-request', reason: 'duration' };

  const current = inspectWriterLease(storage, { nowMs: () => nowMs });
  if (current.status === 'storage-failure' || current.status === 'invalid-lease') return current;
  if (current.status === 'active' && !sameLease(current.lease, {
    formatVersion: 1,
    ...identity,
    expiresAtMs: current.lease.expiresAtMs,
  })) {
    return {
      status: 'owned-by-another-session',
      ownerSessionId: current.lease.sessionId,
      expiresAtMs: current.lease.expiresAtMs,
    };
  }

  const lease: WriterLeaseRecord = { formatVersion: 1, ...identity, expiresAtMs: expiry };
  const verified = writeAndVerifyLease(storage, lease);
  if (verified.status !== 'verified') return verified;
  return {
    status: current.status === 'active' ? 'renewed' : 'acquired',
    lease,
  };
}

export function renewWriterLease(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  durationMs = DEFAULT_WRITER_LEASE_DURATION_MS,
): RenewWriterLeaseResult {
  if (!validIdentity(identity)) return { status: 'invalid-request', reason: 'identity' };
  if (!validDuration(durationMs)) return { status: 'invalid-request', reason: 'duration' };
  const nowMs = now(clock);
  if (nowMs === undefined) return { status: 'invalid-request', reason: 'clock' };
  const expiry = expiresAt(nowMs, durationMs);
  if (expiry === undefined) return { status: 'invalid-request', reason: 'duration' };
  const current = inspectWriterLease(storage, { nowMs: () => nowMs });
  if (current.status === 'storage-failure' || current.status === 'invalid-lease' || current.status === 'no-lease') {
    return current;
  }
  if (current.status === 'expired') return { status: 'lease-expired' };
  if (
    current.lease.sessionId !== identity.sessionId ||
    current.lease.leaseToken !== identity.leaseToken
  ) {
    return { status: 'not-owner' };
  }
  const lease: WriterLeaseRecord = { formatVersion: 1, ...identity, expiresAtMs: expiry };
  const verified = writeAndVerifyLease(storage, lease);
  return verified.status === 'verified' ? { status: 'renewed', lease } : verified;
}

export function releaseWriterLease(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
): ReleaseWriterLeaseResult {
  if (!validIdentity(identity)) return { status: 'invalid-request', reason: 'identity' };
  const nowMs = now(clock);
  if (nowMs === undefined) return { status: 'invalid-request', reason: 'clock' };
  const current = inspectWriterLease(storage, { nowMs: () => nowMs });
  if (current.status === 'storage-failure' || current.status === 'invalid-lease' || current.status === 'no-lease') {
    return current;
  }
  if (current.status === 'expired') return { status: 'lease-expired' };
  if (
    current.lease.sessionId !== identity.sessionId ||
    current.lease.leaseToken !== identity.leaseToken
  ) {
    return { status: 'not-owner' };
  }
  const removed = storage.remove(WRITER_LEASE_STORAGE_KEY);
  return removed.status === 'failure'
    ? { status: 'storage-failure', failure: removed }
    : { status: 'released' };
}
