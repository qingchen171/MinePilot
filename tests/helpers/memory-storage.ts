import {
  type StorageFailure,
  type StorageOperation,
  type StorageReadResult,
  type StorageWriteResult,
  type StringKeyValueStorage,
} from '../../src/systems/persistence/key-value-storage';

interface FailurePlan {
  readonly operation: StorageOperation;
  readonly key: string;
  remainingMatches: number;
}

export class MemoryStorage implements StringKeyValueStorage {
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
