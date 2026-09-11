import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, loadSaveDocument } from '../../../../src/core/persistence/save-dispatcher';
import { migrateOldSaveDocumentToV3, validateSaveDocumentV3 } from '../../../../src/core/persistence/save-v3';

function cell(containsMine = false, explored = false) {
  return { terrain: 'playable', containsMine, explored, mineRevealed: false, flagged: false };
}
function v2() {
  return {
    saveVersion: 2, revision: 9,
    account: { inventory: { lucky: 1, detection: 2, airplane: 3, revive: 4 } },
    activeRun: {
      runId: ' run-1 ', levelId: ' level-1 ',
      board: { dimensions: { width: 3, height: 1 }, cells: [cell(), cell(true), cell()] },
      characterPosition: { kind: 'waiting' }, hasTakenStep: false, phase: { kind: 'active' },
      runItems: { successfulDetectionUses: 0, successfulAirplaneUses: 0, successfulReviveUses: 0, detectionRandomSeed: null },
    },
  };
}
function v3() {
  const old = v2();
  return {
    saveVersion: 3, revision: old.revision,
    account: { ...old.account, coins: 0, completedLevelIds: [] as string[], oneTimeClaimIds: [] as string[], benbenByLevel: [] as { levelId: string; status: string; failureStreak: number }[] },
    currentAttempt: {
      runId: old.activeRun.runId, levelId: old.activeRun.levelId, generationProvenance: null,
      run: { board: old.activeRun.board, characterPosition: old.activeRun.characterPosition, hasTakenStep: false, phase: old.activeRun.phase },
      runItems: old.activeRun.runItems, rewards: [] as ReturnType<typeof reward>[], terminalDisposition: 'not-applicable',
    },
  };
}
function reward() {
  return { coordinate: { x: 0, y: 0 }, payload: { kind: 'coins', amount: 2 }, claimed: false, oneTimeClaimId: null as string | null };
}
function setPath(input: object, path: string, value: unknown): void {
  const parts = path.split('.');
  let target = input as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
  target[parts[parts.length - 1]!] = value;
}
function phaseFixture(kind: string) {
  const input = v2();
  if (kind === 'won') input.activeRun.board.cells = [cell(false, true), cell(true), cell(false, true)];
  if (kind === 'failed' || kind === 'pending-mine-encounter') {
    input.activeRun.hasTakenStep = true;
    setPath(input, 'activeRun.phase', { kind, encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: true } });
  } else input.activeRun.phase.kind = kind;
  return input;
}

describe('Save v3 isolated DTO validation and migration', () => {
  it('validates account-only without fabricating an attempt', () => {
    expect(validateSaveDocumentV3({ ...v3(), currentAttempt: null })).toMatchObject({ status: 'validated', document: { currentAttempt: null } });
    expect(migrateOldSaveDocumentToV3({ ...v2(), activeRun: null })).toMatchObject({ status: 'validated', document: { currentAttempt: null } });
  });
  it('validates a normal attempt and safe reward without changing input', () => {
    const input = v3(); input.currentAttempt.rewards.push(reward());
    const before = structuredClone(input);
    expect(validateSaveDocumentV3(input)).toEqual({ status: 'validated', document: input });
    expect(input).toEqual(before);
  });
  it.each(['', ' ', '   ', '\t', '\n'])('rejects nonblank ID violation %j', (id) => {
    const input = v3(); input.account.completedLevelIds = [id];
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it.each(['account.completedLevelIds.0', 'account.oneTimeClaimIds.0', 'account.benbenByLevel.0.levelId', 'currentAttempt.runId', 'currentAttempt.levelId', 'currentAttempt.generationProvenance.rngVersion', 'currentAttempt.generationProvenance.generationVersion', 'currentAttempt.rewards.0.oneTimeClaimId'])('uses nonblank semantics at %s', (path) => {
    const input = v3();
    input.account.completedLevelIds = ['a']; input.account.oneTimeClaimIds = ['b'];
    input.account.benbenByLevel = [{ levelId: 'c', status: 'unavailable', failureStreak: 0 }];
    input.currentAttempt.rewards.push(reward());
    setPath(input, 'currentAttempt.generationProvenance', { seed: 0, rngVersion: 'rng', generationVersion: 'gen' });
    setPath(input, path, '   ');
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it('preserves padded IDs and exact uniqueness, including migration', () => {
    const input = v3(); input.account.completedLevelIds = ['level-1', ' level-1 '];
    expect(validateSaveDocumentV3(input)).toEqual({ status: 'validated', document: input });
    expect(migrateOldSaveDocumentToV3(v2())).toMatchObject({ document: { currentAttempt: { runId: ' run-1 ', levelId: ' level-1 ' } } });
    input.account.completedLevelIds = ['level-1', 'level-1'];
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it.each(['', 'account', 'account.inventory', 'account.benbenByLevel.0', 'currentAttempt', 'currentAttempt.generationProvenance', 'currentAttempt.run', 'currentAttempt.run.board', 'currentAttempt.run.board.dimensions', 'currentAttempt.run.board.cells.0', 'currentAttempt.run.characterPosition', 'currentAttempt.run.phase', 'currentAttempt.runItems', 'currentAttempt.rewards.0', 'currentAttempt.rewards.0.coordinate', 'currentAttempt.rewards.0.payload'])('rejects unknown field at %s', (path) => {
    const input = v3(); input.currentAttempt.rewards.push(reward());
    input.account.benbenByLevel.push({ levelId: 'x', status: 'unavailable', failureStreak: 0 });
    setPath(input, 'currentAttempt.generationProvenance', { seed: 1, rngVersion: 'rng', generationVersion: 'gen' });
    setPath(input, path ? `${path}.extra` : 'extra', true);
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it.each([NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1', null])('rejects invalid numbers %j', (value) => {
    for (const path of ['revision', 'account.coins', 'account.inventory.lucky', 'currentAttempt.runItems.successfulDetectionUses']) {
      const input = v3(); setPath(input, path, value);
      expect(validateSaveDocumentV3(input).status).toBe('invalid');
    }
  });
  it('rejects missing required fields, sparse arrays and invalid enums', () => {
    for (const path of ['account.coins', 'currentAttempt.generationProvenance', 'currentAttempt.run.hasTakenStep', 'currentAttempt.terminalDisposition']) {
      const input = v3(); setPath(input, path, undefined);
      expect(validateSaveDocumentV3(input).status).toBe('invalid');
    }
    const input = v3(); input.account.completedLevelIds = new Array(2);
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
    setPath(input, 'account.completedLevelIds', []); setPath(input, 'currentAttempt.run.board.cells', new Array(3));
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it.each(['available', 'used'])('enforces canonical Benben %s streak', (status) => {
    const input = v3(); input.account.benbenByLevel.push({ levelId: 'unknown', status, failureStreak: 0 });
    expect(validateSaveDocumentV3(input).status).toBe('validated');
    input.account.benbenByLevel[0]!.failureStreak = 1;
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it('rejects duplicate claims/Benben IDs without normalizing', () => {
    const input = v3(); input.account.oneTimeClaimIds = ['x', 'x'];
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
    input.account.oneTimeClaimIds = ['x', ' x '];
    input.account.benbenByLevel = [{ levelId: 'x', status: 'unavailable', failureStreak: 2 }, { levelId: 'x', status: 'unavailable', failureStreak: 2 }];
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it.each(['mine', 'obstacle', 'out-of-bounds', 'duplicate', 'payload', 'claimed', 'account-claim', 'duplicate-claim'])('rejects reward conflict %s', (kind) => {
    const input = v3(); const entry = reward(); input.currentAttempt.rewards.push(entry);
    if (kind === 'mine') entry.coordinate.x = 1;
    if (kind === 'obstacle') input.currentAttempt.run.board.cells[0]!.terrain = 'obstacle';
    if (kind === 'out-of-bounds') entry.coordinate.x = 3;
    if (kind === 'duplicate') input.currentAttempt.rewards.push(reward());
    if (kind === 'payload') entry.payload.amount = 0;
    if (kind === 'claimed') entry.claimed = true;
    if (kind === 'account-claim') { entry.oneTimeClaimId = 'a'; input.account.oneTimeClaimIds.push('a'); }
    if (kind === 'duplicate-claim') { entry.oneTimeClaimId = 'a'; input.currentAttempt.rewards.push({ ...reward(), coordinate: { x: 2, y: 0 }, oneTimeClaimId: 'a' }); }
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it('requires explored rewards to be claimed and one-time claims recorded', () => {
    const input = v3(); input.currentAttempt.run.board.cells[0]!.explored = true;
    input.currentAttempt.rewards.push(reward());
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
    input.currentAttempt.rewards[0]!.claimed = true;
    input.currentAttempt.rewards[0]!.oneTimeClaimId = 'fixed';
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
    input.account.oneTimeClaimIds.push('fixed');
    expect(validateSaveDocumentV3(input).status).toBe('validated');
  });
  it.each(['active', 'pending-mine-encounter', 'failed', 'won'])('migrates phase %s without retrospective settlement or history', (kind) => {
    const input = phaseFixture(kind); const before = structuredClone(input);
    const result = migrateOldSaveDocumentToV3(input);
    expect(result).toMatchObject({ status: 'validated', document: { revision: 9, account: { coins: 0, completedLevelIds: [], oneTimeClaimIds: [], benbenByLevel: [], inventory: input.account.inventory }, currentAttempt: { rewards: [], generationProvenance: null, runItems: { detectionRandomSeed: null }, run: { phase: input.activeRun.phase }, terminalDisposition: kind === 'failed' || kind === 'won' ? 'legacy-excluded' : 'not-applicable' } } });
    expect(input).toEqual(before);
    if (result.status !== 'validated') throw new Error('Expected migrated DTO');
    expect(validateSaveDocumentV3(result.document).status).toBe(kind === 'failed' || kind === 'won' ? 'invalid' : 'validated');
  });
  it('settled won requires completion and cleared failure streak; never repairs', () => {
    const input = v3(); input.currentAttempt.run.phase.kind = 'won';
    input.currentAttempt.run.board.cells = [cell(false, true), cell(true), cell(false, true)];
    input.currentAttempt.terminalDisposition = 'settled';
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
    input.account.completedLevelIds.push(input.currentAttempt.levelId);
    expect(validateSaveDocumentV3(input).status).toBe('validated');
    input.account.benbenByLevel.push({ levelId: input.currentAttempt.levelId, status: 'unavailable', failureStreak: 1 });
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it.each(['active', 'pending-mine-encounter', 'won', 'failed'])('validates all disposition combinations for %s', (kind) => {
    const migrated = migrateOldSaveDocumentToV3(phaseFixture(kind));
    if (migrated.status !== 'validated' || migrated.document.currentAttempt === null) throw new Error('fixture');
    for (const disposition of ['not-applicable', 'settled', 'legacy-excluded', 'other']) {
      const input = structuredClone(migrated.document);
      setPath(input, 'currentAttempt.terminalDisposition', disposition);
      setPath(input, 'account.completedLevelIds', [input.currentAttempt!.levelId]);
      const terminal = kind === 'won' || kind === 'failed';
      expect(validateSaveDocumentV3(input).status).toBe(disposition === (terminal ? 'settled' : 'not-applicable') ? 'validated' : 'invalid');
    }
  });
  it('does not alias mutable migration input in either direction', () => {
    const input = v2(); const result = migrateOldSaveDocumentToV3(input);
    if (result.status !== 'validated' || result.document.currentAttempt === null) throw new Error('fixture');
    input.account.inventory.lucky = 90; input.activeRun.board.cells[0]!.flagged = true;
    expect(result.document.account.inventory.lucky).toBe(1);
    expect(result.document.currentAttempt.run.board.cells[0]!.flagged).toBe(false);
    setPath(result.document, 'currentAttempt.run.board.dimensions.width', 90);
    expect(input.activeRun.board.dimensions.width).toBe(3);
    expect(Object.isFrozen(input.activeRun.board)).toBe(false);
  });
  it('does not alias reward coordinate or payload in either direction', () => {
    const input = v3(); input.currentAttempt.rewards.push(reward());
    const result = validateSaveDocumentV3(input);
    if (result.status !== 'validated' || result.document.currentAttempt === null) throw new Error('fixture');
    input.currentAttempt.rewards[0]!.payload.amount = 90;
    expect(result.document.currentAttempt.rewards[0]!.payload).toEqual({ kind: 'coins', amount: 2 });
    setPath(result.document, 'currentAttempt.rewards.0.coordinate.x', 90);
    expect(input.currentAttempt.rewards[0]!.coordinate.x).toBe(0);
  });
  it('preserves v1 chain golden defaults and null provenance without fake zero', () => {
    const old = v2(); const { runItems: _items, ...activeRun } = old.activeRun;
    const input = { saveVersion: 1, revision: 9, activeRun };
    const current = loadSaveDocument(input);
    const target = migrateOldSaveDocumentToV3(input);
    expect(current.status).toBe('loaded');
    expect(target).toMatchObject({ status: 'validated', document: { revision: 9, account: { inventory: { lucky: 0, detection: 0, airplane: 0, revive: 0 } }, currentAttempt: { generationProvenance: null, runItems: { detectionRandomSeed: null } } } });
  });
  it('keeps production dispatcher at v2 and refuses v3 as old migration input', () => {
    expect(CURRENT_SAVE_VERSION).toBe(2);
    expect(loadSaveDocument(v3()).status).toBe('unsupported-future-version');
    expect(migrateOldSaveDocumentToV3(v3()).status).toBe('invalid');
  });
  it.each(['on-board', 'revealed-mine-occupancy'])('strictly validates %s position and coordinate fields', (kind) => {
    const input = v3(); input.currentAttempt.run.hasTakenStep = true;
    if (kind === 'on-board') input.currentAttempt.run.board.cells[0]!.explored = true;
    else { input.currentAttempt.run.board.cells[0]!.containsMine = true; input.currentAttempt.run.board.cells[0]!.mineRevealed = true; }
    setPath(input, 'currentAttempt.run.characterPosition', { kind, coordinate: { x: 0, y: 0 } });
    expect(validateSaveDocumentV3(input).status).toBe('validated');
    for (const path of ['currentAttempt.run.characterPosition.extra', 'currentAttempt.run.characterPosition.coordinate.extra']) {
      const changed = structuredClone(input); setPath(changed, path, true);
      expect(validateSaveDocumentV3(changed).status).toBe('invalid');
    }
  });
  it.each(['pending-mine-encounter', 'failed'])('strictly validates %s encounter fields', (kind) => {
    const migrated = migrateOldSaveDocumentToV3(phaseFixture(kind));
    if (migrated.status !== 'validated') throw new Error('fixture');
    const input = structuredClone(migrated.document);
    setPath(input, 'currentAttempt.terminalDisposition', kind === 'failed' ? 'settled' : 'not-applicable');
    expect(validateSaveDocumentV3(input).status).toBe('validated');
    for (const path of ['currentAttempt.run.phase.extra', 'currentAttempt.run.phase.encounter.extra', 'currentAttempt.run.phase.encounter.target.extra']) {
      const changed = structuredClone(input); setPath(changed, path, true);
      expect(validateSaveDocumentV3(changed).status).toBe('invalid');
    }
  });
  it.each(['lucky', 'detection', 'airplane', 'revive'])('validates strict positive %s reward payload', (item) => {
    const input = v3(); input.currentAttempt.rewards.push(reward());
    setPath(input, 'currentAttempt.rewards.0.payload', { kind: 'item', item, quantity: 1 });
    expect(validateSaveDocumentV3(input).status).toBe('validated');
    for (const change of [{ kind: 'item', item, quantity: 1, extra: true }, { kind: 'item', item, quantity: 0 }, { kind: 'item', item, quantity: Number.MAX_SAFE_INTEGER + 1 }, { kind: 'item', item: 'future', quantity: 1 }]) {
      setPath(input, 'currentAttempt.rewards.0.payload', change);
      expect(validateSaveDocumentV3(input).status).toBe('invalid');
    }
  });
  it.each([-1, 0.5, 4294967296, NaN, Infinity, '1'])('rejects invalid uint32 %j', (seed) => {
    const input = v3(); setPath(input, 'currentAttempt.runItems.detectionRandomSeed', seed);
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
    setPath(input, 'currentAttempt.runItems.detectionRandomSeed', null);
    setPath(input, 'currentAttempt.generationProvenance', { seed, rngVersion: 'r', generationVersion: 'g' });
    expect(validateSaveDocumentV3(input).status).toBe('invalid');
  });
  it('preserves explicit provenance and all run item facts without nested aliasing', () => {
    const input = phaseFixture('pending-mine-encounter');
    setPath(input, 'activeRun.generationProvenance', { seed: 4294967295, rngVersion: ' rng ', generationVersion: ' gen ' });
    setPath(input, 'activeRun.runItems', { successfulDetectionUses: 2, successfulAirplaneUses: 1, successfulReviveUses: 1, detectionRandomSeed: 4294967295 });
    const result = migrateOldSaveDocumentToV3(input);
    if (result.status !== 'validated' || result.document.currentAttempt === null) throw new Error('fixture');
    expect(result.document.currentAttempt.generationProvenance).toEqual({ seed: 4294967295, rngVersion: ' rng ', generationVersion: ' gen ' });
    expect(result.document.currentAttempt.runItems).toEqual(input.activeRun.runItems);
    setPath(input, 'activeRun.phase.encounter.target.x', 2);
    setPath(input, 'activeRun.generationProvenance.seed', 0);
    expect(result.document.currentAttempt.run.phase).toMatchObject({ encounter: { target: { x: 1, y: 0 } } });
    expect(result.document.currentAttempt.generationProvenance?.seed).toBe(4294967295);
  });
});
