export type StorageOperation = 'read' | 'write' | 'remove';

export interface StorageFailure {
  readonly status: 'failure';
  readonly operation: StorageOperation;
  readonly reason: 'unavailable' | 'exception';
  readonly key: string;
  readonly cause?: unknown;
}

export type StorageReadResult =
  | { readonly status: 'success'; readonly value: string | null }
  | StorageFailure;

export type StorageWriteResult = { readonly status: 'success' } | StorageFailure;

export interface StringKeyValueStorage {
  read(key: string): StorageReadResult;
  write(key: string, value: string): StorageWriteResult;
  remove(key: string): StorageWriteResult;
}

export interface BrowserStringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function unavailable(operation: StorageOperation, key: string): StorageFailure {
  return { status: 'failure', operation, reason: 'unavailable', key };
}

function exception(
  operation: StorageOperation,
  key: string,
  cause: unknown,
): StorageFailure {
  return { status: 'failure', operation, reason: 'exception', key, cause };
}

export function createLocalStorageAdapter(
  storage: BrowserStringStorage | null | undefined,
): StringKeyValueStorage {
  return {
    read(key) {
      if (storage == null) return unavailable('read', key);
      try {
        return { status: 'success', value: storage.getItem(key) };
      } catch (cause) {
        return exception('read', key, cause);
      }
    },
    write(key, value) {
      if (storage == null) return unavailable('write', key);
      try {
        storage.setItem(key, value);
        return { status: 'success' };
      } catch (cause) {
        return exception('write', key, cause);
      }
    },
    remove(key) {
      if (storage == null) return unavailable('remove', key);
      try {
        storage.removeItem(key);
        return { status: 'success' };
      } catch (cause) {
        return exception('remove', key, cause);
      }
    },
  };
}
