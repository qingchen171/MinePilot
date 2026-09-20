import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION } from '../../src/core/persistence/save-dispatcher';

const productionFiles = [
  'src/main.ts',
  'src/core/persistence/save-dispatcher.ts',
  'src/systems/persistence/persistence-coordinator.ts',
  'src/systems/persistence/new-attempt.ts',
  'src/systems/persistence/lucky.ts',
  'src/systems/persistence/detection.ts',
  'src/systems/persistence/revive.ts',
  'src/systems/persistence/airplane.ts',
];

describe('S4-08.2 production isolation', () => {
  it('keeps CURRENT_SAVE_VERSION at 2', () => {
    expect(CURRENT_SAVE_VERSION).toBe(2);
  });

  it.each(productionFiles)('%s does not import dormant Stage4 Runtime or reader', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/stage4-(?:account|game-state|attempt-factory|runtime-mapping)|attempt-state|dormant-stage4-reader/);
  });

  it('keeps the current production Account and GameState shapes unchanged', async () => {
    const account = await import('../../src/core/account');
    const game = await import('../../src/core/game-state');
    expect(account.createAccountState({ lucky: 0, detection: 0, airplane: 0, revive: 0 })).toEqual({
      inventory: { lucky: 0, detection: 0, airplane: 0, revive: 0 },
    });
    expect(game.createGameState).toBeTypeOf('function');
  });

  it('has no production v3 guarded commit activation', () => {
    const source = productionFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toContain('SaveDocumentV3');
    expect(source).not.toContain('commitCandidateSaveV3');
  });
});
