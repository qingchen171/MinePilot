import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION } from '../../src/core/persistence/save-dispatcher';
import { executeProductionStage4Mutation, loadProductionStage4Runtime } from '../../src/systems/persistence/production-stage4-runtime';

describe('S4-08.4 atomic production activation guard', () => {
  it('uses v3 as the only current Save version', () => {
    expect(CURRENT_SAVE_VERSION).toBe(3);
  });
  it('exposes the Stage 4 reader and mutation surface', () => {
    expect(loadProductionStage4Runtime).toBeTypeOf('function');
    expect(executeProductionStage4Mutation).toBeTypeOf('function');
  });
  it('routes production mutations through the real v3 guarded writer', () => {
    const facade = readFileSync('src/systems/persistence/production-stage4-runtime.ts', 'utf8');
    const guard = readFileSync('src/systems/persistence/guarded-persistence-v3.ts', 'utf8');
    expect(facade).toContain('commitCandidateWithWriterLeaseV3');
    expect(guard).toContain('commitCandidateSaveV3');
    expect(facade).not.toContain('commitCandidateWithWriterLease(');
    expect(facade).not.toContain('commitCandidateSaveV2');
  });
  it('keeps old v2 gameplay wrappers unreachable from production entrypoints', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    const facade = readFileSync('src/systems/persistence/production-stage4-runtime.ts', 'utf8');
    expect(main).toContain('createProductionStage4Session(');
    expect(main).toContain('productionSession =');
    expect(main).not.toContain('productionAuthority =');
    expect(facade).toContain('executeProductionStage4Mutation(storage, identity, clock, intent)');
    expect(facade).toContain("if (result.status === 'committed')");
    expect(facade).toContain('authority = {');
    expect(main + facade).not.toMatch(/persistence\/(?:lucky|detection|revive|airplane|new-attempt)['"]/);
    expect(main + facade).not.toContain('commitCandidateWithWriterLease(');
    expect(main + facade).not.toContain('commitCandidateSaveV2');
  });
});
