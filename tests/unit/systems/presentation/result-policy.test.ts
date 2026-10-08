import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyProductionReason, REASONS } from '../../../../src/systems/presentation/result-policy';
import { copyKeyForResult } from '../../../../src/systems/presentation/copy-key';
import { PRESENTATION_COPY, presentationCopy } from '../../../../src/config/presentation-copy';

describe('S5-02 exact production result classification', () => {
  it('matches every reason in the frozen document exactly once', () => {
    const document = readFileSync('docs/12_S5-02_Presentation_Foundation_Design_Contract.md', 'utf8');
    const rows = document.split('\n').filter((line) => line.startsWith('| ') && line.includes('`'));
    const frozen = rows.flatMap((row) => [...row.split('|')[2].matchAll(/`([^`]+)`/g)].map((match) => match[1]));
    const shopDocument = readFileSync('docs/13_S5-03_Functional_Shop_Design_Contract.md', 'utf8');
    const shopRows = shopDocument.split('\n').filter((line) => /^\| `(?:shop-requires-account-only|invalid-shop-item|insufficient-coins|inventory-overflow)`/.test(line));
    const shopReasons = shopRows.map((row) => row.match(/`([^`]+)`/)?.[1]);
    const implementation = Object.values(REASONS).flat();
    expect(new Set(implementation).size).toBe(implementation.length);
    expect(implementation.slice().sort()).toEqual([...frozen, ...shopReasons, 'settings-unchanged', 'tutorial-already-acknowledged'].sort());
    expect(implementation.length).toBeGreaterThan(70);
  });

  it('does not infer behavior from a status prefix or make uncertain commits replayable', () => {
    expect(classifyProductionReason('commit-commit-outcome-uncertain')).toMatchObject({
      category: 'uncertain', committedByThisSubmission: 'uncertain', retainEnvelope: false, retryUseful: false,
    });
    expect(classifyProductionReason('commit-persistence-commit-failure')).toMatchObject({
      category: 'pre-commit-discard', retainEnvelope: false, retryUseful: false, reloadRequired: true,
    });
    expect(classifyProductionReason('commit-future-status')).toMatchObject({
      category: 'unknown', committedByThisSubmission: 'uncertain', retainEnvelope: false, retryUseful: false,
    });
    expect(classifyProductionReason('storage-failure')).toMatchObject({ category: 'pre-commit-retainable', retainEnvelope: true });
  });

  it('maps categories to centralized semantic copy keys with no missing resource', () => {
    for (const reasons of Object.values(REASONS)) {
      for (const reason of reasons) {
        const key = copyKeyForResult(classifyProductionReason(reason).category);
        expect(presentationCopy(key)).toBe(PRESENTATION_COPY[key]);
      }
    }
    expect(presentationCopy(copyKeyForResult('unknown'))).toBeTruthy();
    expect(copyKeyForResult('domain', 'insufficient-coins')).toBe('shop.insufficient-coins');
    expect(copyKeyForResult('domain', 'invalid-shop-item')).toBe('shop.invalid-item');
    expect(copyKeyForResult('technical', 'inventory-overflow')).toBe('shop.inventory-unavailable');
    expect(copyKeyForResult('unknown', 'insufficient-coins-future')).toBe('error.unknown');
  });
});
