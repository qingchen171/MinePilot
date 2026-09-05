import { describe, expect, it } from 'vitest';
import {
  commitSnapshot,
  SNAPSHOT_STORAGE_KEYS,
} from '../../../../src/systems/persistence/crash-safe-snapshot-store';
import {
  createLocalStorageAdapter,
  type BrowserStringStorage,
} from '../../../../src/systems/persistence/key-value-storage';

class BrowserStorageFake implements BrowserStringStorage {
  readonly data = new Map<string, string>();
  throwOn: 'get' | 'set' | 'remove' | undefined;

  getItem(key: string): string | null {
    if (this.throwOn === 'get') throw new Error('get failed');
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOn === 'set') throw new Error('quota exceeded');
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOn === 'remove') throw new Error('remove failed');
    this.data.delete(key);
  }
}

describe('localStorage adapter', () => {
  it('preserves string get, set, and remove semantics', () => {
    const browserStorage = new BrowserStorageFake();
    const storage = createLocalStorageAdapter(browserStorage);

    expect(storage.read('minepilot:test')).toEqual({ status: 'success', value: null });
    expect(storage.write('minepilot:test', 'payload')).toEqual({ status: 'success' });
    expect(storage.read('minepilot:test')).toEqual({ status: 'success', value: 'payload' });
    expect(storage.remove('minepilot:test')).toEqual({ status: 'success' });
    expect(storage.read('minepilot:test')).toEqual({ status: 'success', value: null });
  });

  it('does not touch keys outside those explicitly requested', () => {
    const browserStorage = new BrowserStorageFake();
    browserStorage.data.set('other-application:key', 'keep');
    const storage = createLocalStorageAdapter(browserStorage);

    storage.write('minepilot:persistence:head', 'head');
    storage.remove('minepilot:persistence:head');

    expect(browserStorage.data).toEqual(new Map([['other-application:key', 'keep']]));
  });

  it('uses only fixed MinePilot namespaced keys for a real adapter commit', () => {
    const browserStorage = new BrowserStorageFake();
    const storage = createLocalStorageAdapter(browserStorage);

    expect(commitSnapshot(storage, 'opaque payload', 1)).toMatchObject({
      status: 'committed',
    });
    expect([...browserStorage.data.keys()].sort()).toEqual([
      SNAPSHOT_STORAGE_KEYS.head,
      SNAPSHOT_STORAGE_KEYS.headBackup,
      SNAPSHOT_STORAGE_KEYS.slotA,
    ].sort());
    expect([...browserStorage.data.keys()].every((key) => key.startsWith('minepilot:'))).toBe(
      true,
    );
  });

  it.each([
    ['read', 'get'],
    ['write', 'set'],
    ['remove', 'remove'],
  ] as const)('converts %s exceptions into structured failures', (operation, throwOn) => {
    const browserStorage = new BrowserStorageFake();
    browserStorage.throwOn = throwOn;
    const storage = createLocalStorageAdapter(browserStorage);
    const result = operation === 'read'
      ? storage.read('minepilot:test')
      : operation === 'write'
        ? storage.write('minepilot:test', 'value')
        : storage.remove('minepilot:test');

    expect(result).toMatchObject({
      status: 'failure',
      operation,
      reason: 'exception',
      key: 'minepilot:test',
    });
    expect(result).toHaveProperty('cause');
  });

  it.each(['read', 'write', 'remove'] as const)(
    'reports unavailable storage for %s',
    (operation) => {
      const storage = createLocalStorageAdapter(undefined);
      const result = operation === 'read'
        ? storage.read('minepilot:test')
        : operation === 'write'
          ? storage.write('minepilot:test', 'value')
          : storage.remove('minepilot:test');
      expect(result).toEqual({
        status: 'failure',
        operation,
        reason: 'unavailable',
        key: 'minepilot:test',
      });
    },
  );
});
