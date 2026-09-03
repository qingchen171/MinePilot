import { describe, expect, it } from 'vitest';
import { BASELINE_MESSAGE } from '../../src/baseline';

describe('engineering baseline', () => {
  it('exposes a stable readiness message', () => {
    expect(BASELINE_MESSAGE).toBe('Phaser 3 engineering baseline ready');
  });
});
