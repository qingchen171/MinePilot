import type { StringKeyValueStorage } from './key-value-storage';
import { inspectWriterLease, type Clock, type WriterIdentity } from './writer-lease';

export type OwnershipFailure =
  | { readonly status: 'writer-not-owner'; readonly reason: 'no-lease' | 'different-owner' | 'invalid-lease' }
  | { readonly status: 'lease-expired' }
  | { readonly status: 'lease-storage-failure'; readonly failure: unknown };

/** Shared Stage 2 lease fact check; both historical and active writers use it. */
export function checkWriterOwnership(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
): OwnershipFailure | undefined {
  const lease = inspectWriterLease(storage, clock);
  if (lease.status === 'storage-failure') return { status: 'lease-storage-failure', failure: lease.failure };
  if (lease.status === 'no-lease') return { status: 'writer-not-owner', reason: 'no-lease' };
  if (lease.status === 'invalid-lease') return { status: 'writer-not-owner', reason: 'invalid-lease' };
  if (lease.status === 'expired') return { status: 'lease-expired' };
  if (lease.lease.sessionId !== identity.sessionId || lease.lease.leaseToken !== identity.leaseToken) {
    return { status: 'writer-not-owner', reason: 'different-owner' };
  }
  return undefined;
}
