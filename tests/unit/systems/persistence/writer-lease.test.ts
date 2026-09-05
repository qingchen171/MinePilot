import { describe, expect, it } from 'vitest';
import {
  acquireWriterLease,
  createWriterIdentity,
  inspectWriterLease,
  releaseWriterLease,
  renewWriterLease,
  WRITER_LEASE_STORAGE_KEY,
  type Clock,
  type WriterIdentity,
} from '../../../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../../../helpers/memory-storage';

class FakeClock implements Clock {
  constructor(private value: number) {}
  nowMs(): number { return this.value; }
  advance(milliseconds: number): void { this.value += milliseconds; }
}

const writerA: WriterIdentity = { sessionId: 'session-a', leaseToken: 'token-a' };
const writerB: WriterIdentity = { sessionId: 'session-b', leaseToken: 'token-b' };

describe('best-effort writer lease', () => {
  it('acquires a fresh lease and verifies the exact record by reading it back', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock(1_000);

    expect(acquireWriterLease(storage, writerA, clock)).toEqual({
      status: 'acquired',
      lease: { formatVersion: 1, ...writerA, expiresAtMs: 31_000 },
    });
    expect(storage.operations.slice(-2)).toEqual([
      `write:${WRITER_LEASE_STORAGE_KEY}`,
      `read:${WRITER_LEASE_STORAGE_KEY}`,
    ]);
  });

  it('rejects another session while the current lease is active', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock(0);
    expect(acquireWriterLease(storage, writerA, clock).status).toBe('acquired');

    expect(acquireWriterLease(storage, writerB, clock)).toEqual({
      status: 'owned-by-another-session',
      ownerSessionId: 'session-a',
      expiresAtMs: 30_000,
    });
  });

  it('renews only the same session and lease token', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock(0);
    expect(acquireWriterLease(storage, writerA, clock).status).toBe('acquired');
    clock.advance(5_000);

    expect(renewWriterLease(storage, writerA, clock)).toMatchObject({
      status: 'renewed',
      lease: { expiresAtMs: 35_000 },
    });
    expect(renewWriterLease(storage, { ...writerA, leaseToken: 'old-token' }, clock)).toEqual({
      status: 'not-owner',
    });
  });

  it('allows expired takeover and prevents the old owner from renewing or releasing', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock(0);
    expect(acquireWriterLease(storage, writerA, clock, 100).status).toBe('acquired');
    clock.advance(100);

    expect(acquireWriterLease(storage, writerB, clock, 100).status).toBe('acquired');
    expect(renewWriterLease(storage, writerA, clock, 100)).toEqual({ status: 'not-owner' });
    expect(releaseWriterLease(storage, writerA, clock)).toEqual({ status: 'not-owner' });
    expect(inspectWriterLease(storage, clock)).toMatchObject({
      status: 'active',
      lease: writerB,
    });
  });

  it('treats expiresAtMs equal to now as expired authority', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock(0);
    expect(acquireWriterLease(storage, writerA, clock, 10).status).toBe('acquired');
    clock.advance(10);

    expect(inspectWriterLease(storage, clock).status).toBe('expired');
    expect(renewWriterLease(storage, writerA, clock)).toEqual({ status: 'lease-expired' });
    expect(releaseWriterLease(storage, writerA, clock)).toEqual({ status: 'lease-expired' });
  });

  it('returns structured acquire write and read-back failures', () => {
    const clock = new FakeClock(0);
    const writeFailure = new MemoryStorage();
    writeFailure.failNext('write', WRITER_LEASE_STORAGE_KEY);
    expect(acquireWriterLease(writeFailure, writerA, clock)).toMatchObject({
      status: 'storage-failure',
      failure: { operation: 'write' },
    });

    const readFailure = new MemoryStorage();
    readFailure.failOnOccurrence('read', WRITER_LEASE_STORAGE_KEY, 2);
    expect(acquireWriterLease(readFailure, writerA, clock)).toMatchObject({
      status: 'storage-failure',
      failure: { operation: 'read' },
    });
  });

  it('rejects acquire and renew read-back mismatches', () => {
    const clock = new FakeClock(0);
    const acquireStorage = new MemoryStorage();
    acquireStorage.transformNextWrite(WRITER_LEASE_STORAGE_KEY, (raw) =>
      raw.replace('token-a', 'token-racer'),
    );
    expect(acquireWriterLease(acquireStorage, writerA, clock)).toEqual({
      status: 'verification-failure',
    });

    const renewStorage = new MemoryStorage();
    expect(acquireWriterLease(renewStorage, writerA, clock, 100).status).toBe('acquired');
    clock.advance(1);
    renewStorage.transformNextWrite(WRITER_LEASE_STORAGE_KEY, (raw) =>
      raw.replace('token-a', 'token-racer'),
    );
    expect(renewWriterLease(renewStorage, writerA, clock, 100)).toEqual({
      status: 'verification-failure',
    });
  });

  it('reports release storage failure and only removes a matching live lease', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock(0);
    expect(acquireWriterLease(storage, writerA, clock).status).toBe('acquired');
    storage.failNext('remove', WRITER_LEASE_STORAGE_KEY);

    expect(releaseWriterLease(storage, writerA, clock)).toMatchObject({
      status: 'storage-failure',
      failure: { operation: 'remove' },
    });
    expect(releaseWriterLease(storage, writerB, clock)).toEqual({ status: 'not-owner' });
    expect(releaseWriterLease(storage, writerA, clock)).toEqual({ status: 'released' });
  });

  it('uses injected UUID capability for production-independent session identity', () => {
    const values = ['fixed-session', 'fixed-token'];
    const identity = createWriterIdentity({ randomUUID: () => values.shift() ?? '' });

    expect(identity).toEqual({ sessionId: 'fixed-session', leaseToken: 'fixed-token' });
  });
});
